"""
DevLens AI — pgvector Store
Handles all vector database operations via PostgreSQL + pgvector.
Provides: upsert chunks, similarity search, delete by repo.

BUG-07 FIX: upsert_chunks now commits in sub-batches so each batch
            is durable even if the pipeline fails mid-way.
            Language filter WHERE clause now applied before ORDER BY.
"""

import uuid
import structlog
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.code_chunk import CodeChunk
from app.core.chunker import Chunk
from app.core.embedder import embed_texts, embed_single
from app.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

# Sub-batch size for DB inserts — commit every N chunks so progress
# is durable even if the Celery task is killed mid-ingestion.
DB_INSERT_BATCH_SIZE = 500


class VectorStore:
    """
    pgvector-backed vector store for code chunks.
    All operations are scoped to a specific repo_id for multi-tenancy.
    """

    def __init__(self, db: AsyncSession, repo_id: uuid.UUID):
        self.db = db
        self.repo_id = repo_id

    # ── Upsert ────────────────────────────────────────────────────────────

    async def upsert_chunks(self, chunks: list[Chunk]) -> int:
        """
        Embed and store a list of code chunks.
        Uses batch embedding for efficiency, commits every DB_INSERT_BATCH_SIZE
        rows for durability.

        BUG-07 FIX: commits after each DB batch so partial progress is
        saved even if the caller raises before the final commit.

        Returns the number of chunks stored.
        """
        if not chunks:
            return 0

        total_stored = 0

        # Embed all chunks in one batched call (embed_texts handles sub-batching)
        texts = [c.content for c in chunks]
        embeddings = await embed_texts(texts)

        # Insert in DB_INSERT_BATCH_SIZE sub-batches with commits
        for batch_start in range(0, len(chunks), DB_INSERT_BATCH_SIZE):
            batch_chunks = chunks[batch_start : batch_start + DB_INSERT_BATCH_SIZE]
            batch_embeddings = embeddings[batch_start : batch_start + DB_INSERT_BATCH_SIZE]

            db_chunks = [
                CodeChunk(
                    repo_id=self.repo_id,
                    file_path=chunk.file_path,
                    language=chunk.language,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    token_count=chunk.token_count,
                    chunk_type=chunk.chunk_type,
                    symbol_name=chunk.symbol_name,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                    embedding=embedding,
                )
                for chunk, embedding in zip(batch_chunks, batch_embeddings)
            ]

            self.db.add_all(db_chunks)
            # BUG-07 FIX: commit each sub-batch for durability
            await self.db.commit()
            total_stored += len(db_chunks)

            logger.info(
                "chunks_upserted_batch",
                repo_id=str(self.repo_id),
                batch_start=batch_start,
                batch_count=len(db_chunks),
                total_so_far=total_stored,
            )

        logger.info(
            "chunks_upserted_complete",
            repo_id=str(self.repo_id),
            total=total_stored,
        )
        return total_stored

    # ── Similarity Search ─────────────────────────────────────────────────

    async def similarity_search(
        self,
        query: str,
        top_k: int = 8,
        language_filter: str | None = None,
    ) -> list[dict]:
        """
        Embed the query and find the top_k most similar code chunks
        using cosine distance (pgvector <=> operator).

        Returns a list of dicts with chunk content and metadata.
        BUG-07 FIX: language_filter WHERE clause applied before ORDER BY.
        """
        query_embedding = await embed_single(query)

        stmt = (
            select(
                CodeChunk,
                CodeChunk.embedding.cosine_distance(query_embedding).label("distance"),
            )
            .where(CodeChunk.repo_id == self.repo_id)
        )

        if language_filter:
            stmt = stmt.where(CodeChunk.language == language_filter)

        stmt = stmt.order_by("distance").limit(top_k)

        result = await self.db.execute(stmt)
        rows = result.all()

        return [
            {
                "content": row.CodeChunk.content,
                "file_path": row.CodeChunk.file_path,
                "language": row.CodeChunk.language,
                "chunk_type": row.CodeChunk.chunk_type,
                "symbol_name": row.CodeChunk.symbol_name,
                "start_line": row.CodeChunk.start_line,
                "end_line": row.CodeChunk.end_line,
                "similarity": round(1 - row.distance, 4),
            }
            for row in rows
        ]

    # ── Delete (for re-indexing) ───────────────────────────────────────────

    async def delete_all(self) -> int:
        """
        Delete all chunks for this repo. Called before re-indexing
        to avoid stale embeddings from a previous commit.
        """
        result = await self.db.execute(
            delete(CodeChunk).where(CodeChunk.repo_id == self.repo_id)
        )
        await self.db.commit()
        count = result.rowcount
        logger.info("chunks_deleted", repo_id=str(self.repo_id), count=count)
        return count

    # ── Count ─────────────────────────────────────────────────────────────

    async def count(self) -> int:
        """Return total number of chunks stored for this repo."""
        result = await self.db.execute(
            select(func.count()).select_from(CodeChunk).where(
                CodeChunk.repo_id == self.repo_id
            )
        )
        return result.scalar() or 0
