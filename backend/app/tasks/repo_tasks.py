"""
DevLens AI — Repo Ingestion Celery Task
This is the background job that runs when a user submits a GitHub repo URL.

Pipeline:
  1. Fetch repo metadata from GitHub API
  2. Validate size/file count limits
  3. Get file tree, filter to indexable files
  4. Check incremental indexing (skip if commit SHA unchanged)
  5. Fetch file contents concurrently
  6. Chunk each file (AST-aware)
  7. Batch embed all chunks → store in pgvector
  8. Build dependency graph → cache in repo row
  9. Generate language stats + monorepo flag
  10. Stream progress events via Redis pub/sub → WebSocket

Progress is broadcast to Redis channel `job:{job_id}` as JSON events.
The WebSocket route subscribes to this channel and forwards to the client.
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Callable

import redis
import structlog
from celery import shared_task
from sqlalchemy import select, update

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.repository import Repository, RepoStatus
from app.models.analysis_job import AnalysisJob, JobStatus
from app.models.session import Session
from app.core.github_client import GitHubClient, parse_github_url
from app.core.file_utils import filter_file_tree, is_binary_content, truncate_content
from app.core.language_detector import detect_language, detect_monorepo, detect_entry_points
from app.core.chunker import chunk_file
from app.core.graph_builder import GraphBuilder
from app.rag.vector_store import VectorStore

logger = structlog.get_logger(__name__)
settings = get_settings()

PROCESSING_STEPS = [
    "Cloning repo",           # 0
    "Parsing file tree",      # 1
    "Building dependency graph",  # 2
    "Generating architecture map",  # 3
    "Indexing for Q&A",       # 4
]


def _publish_event(r: redis.Redis, job_id: str, event: dict) -> None:
    """Publish a progress event to the Redis pub/sub channel for this job."""
    channel = f"job:{job_id}"
    r.publish(channel, json.dumps(event))


def _run_async(coro):
    """Run an async coroutine from a synchronous Celery task context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@shared_task(
    bind=True,
    name="app.tasks.repo_tasks.ingest_repository",
    max_retries=1,
    queue="ingestion",
    acks_late=True,
)
def ingest_repository(
    self,
    job_id: str,
    repo_id: str,
    session_id: str,
    repo_url: str,
    branch: str,
    user_github_token: str | None = None,
) -> dict:
    """
    Main Celery task. Runs the entire ingestion pipeline for one repo.
    Publishes progress events to Redis so the WebSocket can stream them.
    """
    r = redis.from_url(settings.redis_url, decode_responses=True)
    log = logger.bind(job_id=job_id, repo_url=repo_url)

    def emit(event: dict) -> None:
        _publish_event(r, job_id, event)
        log.info("progress_event", event_type=event.get("type"), step=event.get("step"))

    try:
        result = _run_async(
            _ingest_pipeline(
                job_id=job_id,
                repo_id=uuid.UUID(repo_id),
                session_id=uuid.UUID(session_id),
                repo_url=repo_url,
                branch=branch,
                user_github_token=user_github_token,
                emit=emit,
            )
        )
        return result

    except Exception as exc:
        log.exception("ingestion_failed")
        emit({"type": "error", "message": str(exc)})
        _run_async(_mark_job_failed(job_id, uuid.UUID(repo_id), str(exc)))
        raise


async def _ingest_pipeline(
    job_id: str,
    repo_id: uuid.UUID,
    session_id: uuid.UUID,
    repo_url: str,
    branch: str,
    user_github_token: str | None,
    emit: Callable,
) -> dict:
    """Async pipeline — called from the sync Celery task via _run_async."""

    async with AsyncSessionLocal() as db:
        # ── Step 0: Cloning repo (fetch metadata + file tree) ─────────────
        emit({"type": "step_start", "step": PROCESSING_STEPS[0], "step_index": 0})

        owner, name = parse_github_url(repo_url)
        async with GitHubClient(user_token=user_github_token) as gh:
            meta = await gh.get_repo_meta(owner, name)

            # Validate size limits
            if meta.size_kb > settings.max_repo_size_mb * 1024:
                raise ValueError(
                    f"Repo is {meta.size_kb // 1024}MB, exceeds {settings.max_repo_size_mb}MB limit."
                )

            # Incremental indexing: check if we already have this commit
            result = await db.execute(select(Repository).where(Repository.id == repo_id))
            repo = result.scalar_one()

            if (
                repo.status == RepoStatus.READY
                and repo.latest_commit_sha == meta.latest_commit_sha
            ):
                # Nothing changed — return cached session immediately
                emit({
                    "type": "complete",
                    "session_id": str(session_id),
                    "job_id": job_id,
                })
                return {"cached": True, "session_id": str(session_id)}

            # Fetch full file tree
            tree = await gh.get_file_tree(owner, name, branch)

        file_paths_all = [item["path"] for item in tree if item["type"] == "blob"]

        emit({
            "type": "step_done",
            "step": PROCESSING_STEPS[0],
            "step_index": 0,
            "meta": {
                "files": len(file_paths_all),
                "size_mb": round(meta.size_kb / 1024, 1),
                "stars": meta.stars,
            },
        })

        # ── Step 1: Parsing file tree ─────────────────────────────────────
        emit({"type": "step_start", "step": PROCESSING_STEPS[1], "step_index": 1})

        # Build size map from tree
        size_map = {item["path"]: item.get("size", 0) for item in tree}
        allowed_paths, skipped = filter_file_tree(tree)

        if len(allowed_paths) > settings.max_file_count:
            allowed_paths = allowed_paths[:settings.max_file_count]
            logger.warning("file_count_truncated", limit=settings.max_file_count)

        is_monorepo = detect_monorepo(file_paths_all)
        entry_points = detect_entry_points(allowed_paths, meta.languages)

        emit({
            "type": "step_done",
            "step": PROCESSING_STEPS[1],
            "step_index": 1,
            "meta": {
                "indexable_files": len(allowed_paths),
                "skipped": len(skipped),
                "is_monorepo": is_monorepo,
                "languages": meta.languages,
            },
        })

        # ── Fetch all file contents ────────────────────────────────────────
        file_contents: dict[str, str] = {}
        async with GitHubClient(user_token=user_github_token) as gh:
            async for repo_file in gh.iter_repo_files(owner, name, branch, allowed_paths):
                if not is_binary_content(repo_file.content):
                    lang = detect_language(repo_file.path)
                    repo_file.language = lang
                    file_contents[repo_file.path] = truncate_content(repo_file.content)

        # ── Step 2: Building dependency graph ─────────────────────────────
        emit({"type": "step_start", "step": PROCESSING_STEPS[2], "step_index": 2})

        builder = GraphBuilder(file_contents)
        graph_data = builder.build()
        # Set meta fields populated after build (languages, monorepo, commit)
        graph_data.meta.languages = meta.languages
        graph_data.meta.is_monorepo = is_monorepo
        graph_data.meta.commit_sha = meta.latest_commit_sha

        emit({
            "type": "step_done",
            "step": PROCESSING_STEPS[2],
            "step_index": 2,
            "meta": {
                "nodes": graph_data.meta.total_nodes,
                "edges": graph_data.meta.total_edges,
            },
        })

        # ── Step 3: Generating architecture map ───────────────────────────
        emit({"type": "step_start", "step": PROCESSING_STEPS[3], "step_index": 3})

        graph_cache = graph_data.model_dump()

        emit({"type": "step_done", "step": PROCESSING_STEPS[3], "step_index": 3, "meta": {}})

        # ── Step 4: Indexing for Q&A ───────────────────────────────────────
        emit({"type": "step_start", "step": PROCESSING_STEPS[4], "step_index": 4})

        vector_store = VectorStore(db, repo_id)
        # Delete old chunks if re-indexing
        if repo.status == RepoStatus.READY:
            await vector_store.delete_all()

        # Chunk all files
        all_chunks = []
        for path, content in file_contents.items():
            lang = detect_language(path)
            # chunk_file(file_path, content, language) — note arg order matches chunker.py
            file_chunks = chunk_file(file_path=path, content=content, language=lang)
            all_chunks.extend(file_chunks)

        # Batch upsert all chunks with embeddings
        chunk_count = await vector_store.upsert_chunks(all_chunks)
        await db.commit()

        emit({
            "type": "step_done",
            "step": PROCESSING_STEPS[4],
            "step_index": 4,
            "meta": {"chunks": chunk_count},
        })

        # ── Finalize: update repo + job rows ──────────────────────────────
        now = datetime.now(timezone.utc)
        await db.execute(
            update(Repository)
            .where(Repository.id == repo_id)
            .values(
                status=RepoStatus.READY,
                github_id=meta.github_id,
                description=meta.description,
                stars=meta.stars,
                forks=meta.forks,
                languages=meta.languages,
                size_kb=meta.size_kb,
                file_count=len(allowed_paths),
                chunk_count=chunk_count,
                is_monorepo=is_monorepo,
                latest_commit_sha=meta.latest_commit_sha,
                graph_cache=graph_cache,
                indexed_at=now,
            )
        )

        await db.execute(
            update(AnalysisJob)
            .where(AnalysisJob.id == uuid.UUID(job_id))
            .values(
                status=JobStatus.COMPLETE,
                progress_pct=100,
                completed_at=now,
            )
        )

        await db.commit()

        emit({
            "type": "complete",
            "session_id": str(session_id),
            "job_id": job_id,
        })

        return {"success": True, "chunks": chunk_count, "session_id": str(session_id)}


async def _mark_job_failed(job_id: str, repo_id: uuid.UUID, error: str) -> None:
    """Mark both the job and repo as failed in the DB."""
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        await db.execute(
            update(AnalysisJob)
            .where(AnalysisJob.id == uuid.UUID(job_id))
            .values(status=JobStatus.FAILED, error_message=error, completed_at=now)
        )
        await db.execute(
            update(Repository)
            .where(Repository.id == uuid.UUID(repo_id))
            .values(status=RepoStatus.FAILED)
        )
        await db.commit()


@shared_task(name="app.tasks.repo_tasks.cleanup_expired_sessions")
def cleanup_expired_sessions() -> dict:
    """Nightly: delete sessions older than their expiry date."""
    from datetime import timezone
    deleted = _run_async(_do_cleanup())
    logger.info("expired_sessions_cleaned", count=deleted)
    return {"deleted": deleted}


async def _do_cleanup() -> int:
    from sqlalchemy import delete as sql_delete
    from app.models.session import Session
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            sql_delete(Session).where(Session.expires_at < now)
        )
        await db.commit()
        return result.rowcount
