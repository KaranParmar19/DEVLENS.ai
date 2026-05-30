"""
DevLens AI — Repo Ingestion Celery Task

BUG-02 FIX: branch is now resolved from meta.default_branch (GitHub source
            of truth), not the user-supplied payload default "main".
BUG-03 FIX: Progress events are stored in a Redis List (RPUSH with TTL)
            BEFORE publishing to the pub/sub channel.  The WebSocket
            handler drains the backlog list on connect, ensuring events
            published before the WS connects are never lost.
BUG-08 FIX: builder.build() called with no args (fix aligns with updated
            graph_builder.py).
BUG-01 FIX: size_map passed to iter_repo_files; no double tree fetch.
M-02  FIX:  Celery worker sets RUNNING status on the job at task start.
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
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.config import get_settings
# NOTE: Do NOT import AsyncSessionLocal here — it uses a connection pool whose
# asyncpg connections are bound to the event loop at import time.  In a Celery
# prefork worker each task gets a fresh event loop via _run_async(), and pooled
# connections from the old loop trigger:
#   RuntimeError: Future <...> attached to a different loop
# Using NullPool means every `async with _WorkerSessionLocal()` opens a brand-
# new asyncpg connection in the current loop and closes it immediately on exit.
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

# ── Worker-safe DB session (NullPool) ─────────────────────────────────────
# Created at module level so the engine object is shared, but NullPool ensures
# NO connections are cached — each session gets a fresh asyncpg connection.
_worker_engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    poolclass=NullPool,          # ← key: no pool → no cross-loop connections
)
_WorkerSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=_worker_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

PROCESSING_STEPS = [
    "Cloning repo",              # 0
    "Parsing file tree",         # 1
    "Building dependency graph", # 2
    "Generating architecture map", # 3
    "Indexing for Q&A",          # 4
]

# TTL for the Redis event backlog list (seconds).
# Must be longer than the longest expected ingestion.
EVENT_BACKLOG_TTL = settings.ingestion_timeout_seconds + 300


# ── Event Publisher ───────────────────────────────────────────────────────

def _publish_event(r: redis.Redis, job_id: str, event: dict) -> None:
    """
    Publish a progress event to:
    1. A Redis List (backlog) — durable, allows late-connecting WebSocket
       clients to catch up by draining the list first.
    2. The Redis pub/sub channel — for live, already-connected clients.

    BUG-03 FIX: events are persisted in the backlog list so late-connecting
    WebSocket subscribers don't miss early steps.
    """
    payload = json.dumps(event)
    channel = f"job:{job_id}"
    backlog_key = f"job_backlog:{job_id}"

    pipe = r.pipeline(transaction=False)
    pipe.rpush(backlog_key, payload)
    pipe.expire(backlog_key, EVENT_BACKLOG_TTL)
    pipe.publish(channel, payload)
    pipe.execute()


def _run_async(coro):
    """Run an async coroutine from a synchronous Celery task context.

    IMPORTANT: asyncio.set_event_loop(loop) must be called before
    run_until_complete so that asyncpg (and SQLAlchemy's asyncpg dialect)
    bind their Futures to THIS loop, not a stale one.  Without it you get:
      RuntimeError: Future attached to a different loop
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)   # ← fixes "attached to a different loop"
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
        asyncio.set_event_loop(None)  # clean up — don't leak the closed loop


# ── Celery Task ───────────────────────────────────────────────────────────

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
    Main Celery task. Runs the full ingestion pipeline for one repo.
    Publishes progress events to Redis so the WebSocket can stream them.
    """
    r = redis.from_url(settings.redis_url, decode_responses=True)
    log = logger.bind(job_id=job_id, repo_url=repo_url)

    def emit(event: dict) -> None:
        _publish_event(r, job_id, event)
        log.info("progress_event", event_type=event.get("type"), step=event.get("step"))

    # M-02 FIX: mark job RUNNING immediately on worker pick-up
    _run_async(_mark_job_running(job_id))

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


# ── Ingestion Pipeline ────────────────────────────────────────────────────

async def _ingest_pipeline(
    job_id: str,
    repo_id: uuid.UUID,
    session_id: uuid.UUID,
    repo_url: str,
    branch: str,
    user_github_token: str | None,
    emit: Callable,
) -> dict:
    """
    Async pipeline — called from the sync Celery task via _run_async.
    All fixes consolidated here.
    """
    async with _WorkerSessionLocal() as db:

        # ── Step 0: Fetch metadata + validate ────────────────────────────
        emit({"type": "step_start", "step": PROCESSING_STEPS[0], "step_index": 0})

        owner, name = parse_github_url(repo_url)

        async with GitHubClient(user_token=user_github_token) as gh:
            meta = await gh.get_repo_meta(owner, name)

            if meta.is_private and not user_github_token:
                raise ValueError("This repository is private. Please connect your GitHub account to analyze it.")

            # BUG-02 FIX: always use the branch from GitHub metadata,
            # not the user-supplied default "main".
            effective_branch = meta.default_branch

            # Validate size limits
            if meta.size_kb > settings.max_repo_size_mb * 1024:
                raise ValueError(
                    f"Repo is {meta.size_kb // 1024}MB, exceeds "
                    f"{settings.max_repo_size_mb}MB limit."
                )

            # Incremental indexing: skip if commit SHA unchanged
            result = await db.execute(
                select(Repository).where(Repository.id == repo_id)
            )
            repo = result.scalar_one()

            if (
                repo.status == RepoStatus.READY
                and repo.latest_commit_sha == meta.latest_commit_sha
            ):
                emit({
                    "type": "complete",
                    "session_id": str(session_id),
                    "job_id": job_id,
                })
                return {"cached": True, "session_id": str(session_id)}

            # BUG-01 FIX: fetch the tree ONCE; build size_map here
            tree = await gh.get_file_tree(owner, name, effective_branch)

        file_paths_all = [item["path"] for item in tree]
        size_map = {item["path"]: item.get("size", 0) for item in tree}

        emit({
            "type": "step_done",
            "step": PROCESSING_STEPS[0],
            "step_index": 0,
            "meta": {
                "files": len(file_paths_all),
                "size_mb": round(meta.size_kb / 1024, 1),
                "stars": meta.stars,
                "default_branch": effective_branch,
            },
        })

        # ── Step 1: Parse file tree ───────────────────────────────────────
        emit({"type": "step_start", "step": PROCESSING_STEPS[1], "step_index": 1})

        allowed_paths, skipped = filter_file_tree(tree)

        if len(allowed_paths) > settings.max_file_count:
            allowed_paths = allowed_paths[: settings.max_file_count]
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

        # ── Fetch all file contents ───────────────────────────────────────
        # BUG-01 FIX: pass the already-built size_map; no second tree fetch.
        file_contents: dict[str, str] = {}
        async with GitHubClient(user_token=user_github_token) as gh:
            async for repo_file in gh.iter_repo_files(
                owner, name, effective_branch, allowed_paths, size_map
            ):
                if not is_binary_content(repo_file.content):
                    lang = detect_language(repo_file.path)
                    repo_file.language = lang
                    file_contents[repo_file.path] = truncate_content(repo_file.content)

        logger.info(
            "files_fetched",
            total=len(allowed_paths),
            succeeded=len(file_contents),
        )

        # ── Step 2: Build dependency graph ────────────────────────────────
        emit({"type": "step_start", "step": PROCESSING_STEPS[2], "step_index": 2})

        # BUG-08 FIX: GraphBuilder(files).build() — build() takes no args.
        builder = GraphBuilder(file_contents)
        graph_data = builder.build()

        # Populate meta fields that require post-build context
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

        # ── Step 3: Generating architecture map (serialise graph) ─────────
        emit({"type": "step_start", "step": PROCESSING_STEPS[3], "step_index": 3})

        graph_cache = graph_data.model_dump()

        emit({"type": "step_done", "step": PROCESSING_STEPS[3], "step_index": 3, "meta": {}})

        # ── Step 4: Chunk + embed + store in pgvector ─────────────────────
        emit({"type": "step_start", "step": PROCESSING_STEPS[4], "step_index": 4})

        vector_store = VectorStore(db, repo_id)

        # Delete old chunks if re-indexing an existing repo
        if repo.status == RepoStatus.READY:
            await vector_store.delete_all()

        # Chunk all files
        all_chunks = []
        for path, content in file_contents.items():
            lang = detect_language(path)
            file_chunks = chunk_file(file_path=path, content=content, language=lang)
            all_chunks.extend(file_chunks)

        logger.info("chunking_done", total_chunks=len(all_chunks))

        # BUG-07 FIX: upsert_chunks now commits sub-batches internally.
        chunk_count = await vector_store.upsert_chunks(all_chunks)

        emit({
            "type": "step_done",
            "step": PROCESSING_STEPS[4],
            "step_index": 4,
            "meta": {"chunks": chunk_count},
        })

        # ── Finalise: update repo + job rows ─────────────────────────────
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
                default_branch=effective_branch,  # BUG-02 FIX: persist real branch
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

        logger.info(
            "ingestion_complete",
            repo=f"{owner}/{name}",
            chunks=chunk_count,
            nodes=graph_data.meta.total_nodes,
        )

        return {"success": True, "chunks": chunk_count, "session_id": str(session_id)}


# ── Helper DB Updates ─────────────────────────────────────────────────────

async def _mark_job_running(job_id: str) -> None:
    """Mark the job as RUNNING when the worker picks it up."""
    async with _WorkerSessionLocal() as db:
        await db.execute(
            update(AnalysisJob)
            .where(AnalysisJob.id == uuid.UUID(job_id))
            .values(
                status=JobStatus.RUNNING,
                started_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()


async def _mark_job_failed(job_id: str, repo_id: uuid.UUID, error: str) -> None:
    """Mark both the job and repo as failed in the DB."""
    async with _WorkerSessionLocal() as db:
        now = datetime.now(timezone.utc)
        await db.execute(
            update(AnalysisJob)
            .where(AnalysisJob.id == uuid.UUID(job_id))
            .values(
                status=JobStatus.FAILED,
                error_message=error[:2000],  # truncate to fit column
                completed_at=now,
            )
        )
        await db.execute(
            update(Repository)
            .where(Repository.id == repo_id)
            .values(status=RepoStatus.FAILED)
        )
        await db.commit()


# ── Periodic Cleanup ──────────────────────────────────────────────────────

@shared_task(name="app.tasks.repo_tasks.cleanup_expired_sessions")
def cleanup_expired_sessions() -> dict:
    """Nightly: delete sessions older than their expiry date."""
    deleted = _run_async(_do_cleanup())
    logger.info("expired_sessions_cleaned", count=deleted)
    return {"deleted": deleted}


async def _do_cleanup() -> int:
    from sqlalchemy import delete as sql_delete
    from app.models.session import Session

    now = datetime.now(timezone.utc)
    async with _WorkerSessionLocal() as db:
        result = await db.execute(
            sql_delete(Session).where(Session.expires_at < now)
        )
        await db.commit()
        return result.rowcount
