"""
DevLens AI — Repository Ingestion Orchestrator
Coordinates the full 5-step ingestion pipeline:
  Step 0: Fetch repo metadata + validate size limits
  Step 1: Get file tree, filter to indexable files
  Step 2: Fetch file content (async, concurrent)
  Step 3: Chunk code (AST-aware by language)
  Step 4: Embed chunks → pgvector
  Step 5: Build dependency graph

This module is called by the Celery task (repo_tasks.py) and
is decoupled from Celery so it can be tested independently.
Progress is reported via an async callback (progress_fn).
"""

import asyncio
import structlog
import uuid
from typing import Callable, Awaitable, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.github_client import GitHubClient
from app.core.file_utils import filter_indexable_files, should_skip_file
from app.core.language_detector import detect_language, detect_monorepo, detect_entry_points
from app.core.chunker import chunk_file
from app.core.embedder import Embedder
from app.core.graph_builder import GraphBuilder
from app.rag.vector_store import VectorStore
from app.models.repository import Repository, RepoStatus

log = structlog.get_logger(__name__)

settings = get_settings()

# Type alias for the progress callback
ProgressFn = Callable[[str, dict[str, Any]], Awaitable[None]]


class RepoIngester:
    """
    Orchestrates the full repository ingestion pipeline.

    All state (graph, file tree, language breakdown) is stored on this
    object so the Celery task can retrieve it after ingestion completes.
    """

    def __init__(
        self,
        db: AsyncSession,
        vector_store: VectorStore,
        embedder: Embedder,
        github_client: GitHubClient,
        graph_builder: GraphBuilder,
    ) -> None:
        self.db = db
        self.vector_store = vector_store
        self.embedder = embedder
        self.github = github_client
        self.graph_builder = graph_builder

        # Set after ingestion — stored on the Repository model
        self.graph_data: dict = {}
        self.file_tree: list[dict] = []
        self.language_breakdown: dict[str, int] = {}
        self.entry_points: list[str] = []
        self.is_monorepo: bool = False
        self.total_chunks: int = 0

    async def ingest(
        self,
        repo: Repository,
        progress_fn: ProgressFn | None = None,
    ) -> None:
        """
        Run the full 5-step ingestion pipeline.

        Args:
            repo:        SQLAlchemy Repository model (already saved in DB).
            progress_fn: Async callback called at each step with
                         (step_name, metadata_dict). Used by Celery task
                         to broadcast WebSocket progress events.
        """
        async def noop_progress(step: str, meta: dict) -> None:
            pass

        emit = progress_fn or noop_progress

        owner = repo.owner
        name = repo.name
        repo_id = repo.id

        log.info("ingestion_start", owner=owner, name=name, repo_id=str(repo_id))

        # ── Step 0: Fetch metadata & validate ────────────────────────────────
        await emit("Cloning repo", {"status": "fetching metadata"})
        meta = await self.github.get_repo_metadata(owner, name)

        # Validate size
        size_kb = meta.get("size", 0)  # GitHub reports in KB
        size_mb = size_kb / 1024
        if size_mb > settings.MAX_REPO_SIZE_MB:
            raise ValueError(
                f"Repo size {size_mb:.1f}MB exceeds limit of {settings.MAX_REPO_SIZE_MB}MB"
            )

        # Update repo metadata from GitHub
        repo.description = meta.get("description") or ""
        repo.stars = meta.get("stargazers_count", 0)
        repo.default_branch = meta.get("default_branch", "main")
        repo.commit_sha = meta.get("sha") or repo.commit_sha or "unknown"
        await self.db.flush()

        # ── Step 1: File tree ─────────────────────────────────────────────────
        await emit("Parsing file tree", {"status": "fetching file tree"})
        raw_tree = await self.github.get_file_tree(owner, name, repo.default_branch)

        # Filter to indexable files
        indexable = filter_indexable_files(raw_tree, max_files=settings.MAX_FILES_PER_REPO)

        if not indexable:
            raise ValueError("No indexable files found in this repository.")

        # Detect languages
        for file_info in indexable:
            lang = detect_language(file_info["path"])
            file_info["language"] = lang
            self.language_breakdown[lang] = self.language_breakdown.get(lang, 0) + 1

        # Build frontend-friendly file tree
        self.file_tree = [
            {
                "path": f["path"],
                "language": f["language"],
                "size": f.get("size", 0),
            }
            for f in indexable
        ]

        # Detect monorepo + entry points
        all_paths = [f["path"] for f in indexable]
        self.is_monorepo = detect_monorepo(raw_tree)
        self.entry_points = detect_entry_points(all_paths)

        # Store language breakdown on repo
        repo.languages = self.language_breakdown
        repo.is_monorepo = self.is_monorepo
        await self.db.flush()

        await emit("Parsing file tree", {
            "files": len(indexable),
            "languages": self.language_breakdown,
            "is_monorepo": self.is_monorepo,
        })

        # ── Step 2: Fetch file contents (concurrent) ──────────────────────────
        await emit("Building dependency graph", {"status": "fetching file contents"})

        semaphore = asyncio.Semaphore(20)  # max 20 concurrent GitHub API calls

        async def fetch_with_sem(file_info: dict) -> dict | None:
            async with semaphore:
                try:
                    content = await self.github.get_file_content(
                        owner, name, file_info["path"], repo.default_branch
                    )
                    return {**file_info, "content": content}
                except Exception as exc:
                    log.warning(
                        "file_fetch_failed",
                        path=file_info["path"],
                        error=str(exc),
                    )
                    return None

        results = await asyncio.gather(*[fetch_with_sem(f) for f in indexable])
        files_with_content = [r for r in results if r is not None and r.get("content")]

        log.info(
            "files_fetched",
            total=len(indexable),
            succeeded=len(files_with_content),
        )

        # ── Step 3: Chunking ──────────────────────────────────────────────────
        all_chunks = []
        for file_info in files_with_content:
            try:
                chunks = chunk_file(
                    content=file_info["content"],
                    file_path=file_info["path"],
                    language=file_info["language"],
                )
                for chunk in chunks:
                    chunk["repo_id"] = repo_id
                all_chunks.extend(chunks)
            except Exception as exc:
                log.warning("chunking_failed", path=file_info["path"], error=str(exc))

        self.total_chunks = len(all_chunks)
        log.info("chunking_done", total_chunks=self.total_chunks)

        # ── Step 4: Build dependency graph ────────────────────────────────────
        graph_data = self.graph_builder.build(files_with_content)
        self.graph_data = graph_data

        # Store graph on repo model
        repo.graph_data = graph_data
        await self.db.flush()

        await emit("Building dependency graph", {
            "nodes": len(graph_data.get("nodes", [])),
            "edges": len(graph_data.get("edges", [])),
        })

        # ── Step 5: Embed + store in pgvector ────────────────────────────────
        await emit("Indexing for Q&A", {"status": "embedding code chunks"})

        # Delete existing chunks for this repo (re-indexing case)
        await self.vector_store.delete_by_repo(repo_id)

        # Embed in batches
        await self.embedder.embed_and_store(all_chunks, self.vector_store, repo_id)

        await emit("Indexing for Q&A", {"chunks": self.total_chunks})

        log.info(
            "ingestion_complete",
            repo_id=str(repo_id),
            chunks=self.total_chunks,
            nodes=len(graph_data.get("nodes", [])),
        )
