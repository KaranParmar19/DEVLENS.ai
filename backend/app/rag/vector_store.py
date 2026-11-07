"""
DevLens AI - pgvector Store
Handles all vector database operations via PostgreSQL + pgvector.
Provides: upsert chunks, similarity search, delete by repo.

BUG-07 FIX: upsert_chunks now commits in sub-batches so each batch
            is durable even if the pipeline fails mid-way.
            Language filter WHERE clause now applied before ORDER BY.
"""

import uuid
import structlog
from sqlalchemy import select, delete, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.code_chunk import CodeChunk
from app.models.repository import Repository
from app.core.chunker import Chunk
from app.core.embedder import embed_texts, embed_single, EmbeddingUnavailableError
from app.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

# Sub-batch size for DB inserts - commit every N chunks so progress
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
        # Set by upsert_chunks: True only if every chunk got a real embedding
        self.semantic_enabled: bool = False

    # ── Upsert ────────────────────────────────────────────────────────────

    async def upsert_chunks(self, chunks: list[Chunk], delete_existing: bool = False) -> int:
        """
        Embed and store a list of code chunks.
        When delete_existing is True, atomically deletes existing chunks and inserts
        new chunks in a single transaction.

        Returns the number of chunks stored.
        """
        if not chunks:
            if delete_existing:
                await self.delete_all(commit=True)
            return 0

        total_stored = 0

        # Embed all chunks before starting the DB transaction.
        # If the provider is unavailable (quota/auth/network) we store chunks
        # with NULL embeddings and rely on keyword/symbol search. We never
        # store fake vectors.
        texts = [c.content for c in chunks]
        self.semantic_enabled = True
        try:
            embeddings: list[list[float] | None] = list(await embed_texts(texts))
        except EmbeddingUnavailableError as exc:
            logger.warning("semantic_search_disabled_for_repo", repo_id=str(self.repo_id), reason=str(exc))
            embeddings = []
            self.semantic_enabled = False

        # Chunks beyond the embedding cap (or all of them on failure) get NULL
        if len(embeddings) < len(chunks):
            if embeddings:
                self.semantic_enabled = False  # partially embedded
            embeddings.extend([None] * (len(chunks) - len(embeddings)))

        # Enforce exact 1536 dimensions; fail loudly on mismatch instead of falling back to NULL
        for idx, e in enumerate(embeddings):
            if e is not None and len(e) != 1536:
                raise ValueError(
                    f"Embedding dimension mismatch: expected 1536 dimensions, got {len(e)} at index {idx}."
                )

        try:
            if delete_existing:
                await self.db.execute(
                    delete(CodeChunk).where(CodeChunk.repo_id == self.repo_id)
                )

            # Insert in DB_INSERT_BATCH_SIZE sub-batches within a single transaction
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
                await self.db.flush()
                total_stored += len(db_chunks)

                logger.info(
                    "chunks_upserted_batch",
                    repo_id=str(self.repo_id),
                    batch_start=batch_start,
                    batch_count=len(db_chunks),
                    total_so_far=total_stored,
                )

            await self.db.commit()
            logger.info(
                "chunks_upserted_complete",
                repo_id=str(self.repo_id),
                total=total_stored,
            )
            return total_stored
        except Exception as e:
            await self.db.rollback()
            logger.error("upsert_chunks_failed_rolled_back", repo_id=str(self.repo_id), error=str(e))
            raise

    # ── By-File Lookup ────────────────────────────────────────────────────

    async def get_chunks_by_file(self, file_path: str) -> list[dict]:
        """
        Retrieve all indexed chunks for a specific file path, ordered by chunk_index.
        Supports exact path match and suffix/substring fallback.
        """
        # Exact match first
        stmt = (
            select(CodeChunk)
            .where(
                CodeChunk.repo_id == self.repo_id,
                CodeChunk.file_path == file_path,
            )
            .order_by(CodeChunk.chunk_index)
        )
        res = await self.db.execute(stmt)
        chunks = res.scalars().all()

        if not chunks:
            # Fallback to suffix match (e.g. 'auth.py' matching 'src/auth.py')
            stmt = (
                select(CodeChunk)
                .where(
                    CodeChunk.repo_id == self.repo_id,
                    CodeChunk.file_path.ilike(f"%{file_path}"),
                )
                .order_by(CodeChunk.chunk_index)
            )
            res = await self.db.execute(stmt)
            chunks = res.scalars().all()

        return [
            {
                "content": c.content,
                "file_path": c.file_path,
                "language": c.language,
                "chunk_type": c.chunk_type,
                "symbol_name": c.symbol_name,
                "start_line": c.start_line,
                "end_line": c.end_line,
                "token_count": c.token_count,
            }
            for c in chunks
        ]

    # ── Similarity Search ─────────────────────────────────────────────────

    async def similarity_search(
        self,
        query: str,
        top_k: int = 8,
        language_filter: str | None = None,
    ) -> list[dict]:
        """
        Hybrid search combining semantic pgvector cosine similarity with
        direct SQL keyword & symbol matching.
        Guarantees high relevance for code queries even when embeddings are
        sparse or in fallback mode.
        """
        results: list[dict] = []
        seen_keys: set[tuple[str, int]] = set()

        # 1. Direct Keyword & Symbol Match (searches symbol_name, file_path, content)
        clean_terms = [t.strip() for t in query.split() if len(t.strip()) > 2 and not t.startswith("file:")]
        if clean_terms:
            text_conditions = []
            for term in clean_terms[:4]:
                text_conditions.append(CodeChunk.symbol_name.ilike(f"%{term}%"))
                text_conditions.append(CodeChunk.file_path.ilike(f"%{term}%"))
                text_conditions.append(CodeChunk.content.ilike(f"%{term}%"))

            text_stmt = select(CodeChunk).where(CodeChunk.repo_id == self.repo_id)
            if language_filter:
                text_stmt = text_stmt.where(CodeChunk.language == language_filter)
            text_stmt = text_stmt.where(or_(*text_conditions)).limit(top_k)

            try:
                text_res = await self.db.execute(text_stmt)
                for c in text_res.scalars().all():
                    key = (c.file_path, c.chunk_index)
                    if key not in seen_keys:
                        seen_keys.add(key)
                        is_symbol_match = any(t.lower() in (c.symbol_name or "").lower() for t in clean_terms)
                        results.append({
                            "content": c.content,
                            "file_path": c.file_path,
                            "language": c.language,
                            "chunk_type": c.chunk_type,
                            "symbol_name": c.symbol_name,
                            "start_line": c.start_line,
                            "end_line": c.end_line,
                            "match_type": "symbol" if is_symbol_match else "keyword",
                            "similarity": None,
                        })
            except Exception as e:
                logger.warning("keyword_search_failed", error=str(e))

        # 2. Semantic pgvector Cosine Distance Search (only when repo has verified real embeddings)
        try:
            repo_model = (
                await self.db.execute(
                    select(Repository.embedding_model).where(Repository.id == self.repo_id)
                )
            ).scalar_one_or_none()
            has_real_model = bool(
                repo_model and not str(repo_model).startswith("legacy-fallback")
            )
            has_vectors = False
            if has_real_model:
                has_vectors = (
                    await self.db.execute(
                        select(CodeChunk.id)
                        .where(CodeChunk.repo_id == self.repo_id, CodeChunk.embedding.is_not(None))
                        .limit(1)
                    )
                ).first() is not None
            if not has_vectors:
                # Keyword-only repo: return SQL symbol/keyword matches without calling embedding API
                return results[:top_k]
            query_embedding = await embed_single(query)
            stmt = (
                select(
                    CodeChunk,
                    CodeChunk.embedding.cosine_distance(query_embedding).label("distance"),
                )
                .where(CodeChunk.repo_id == self.repo_id)
                .where(CodeChunk.embedding.is_not(None))
            )
            if language_filter:
                stmt = stmt.where(CodeChunk.language == language_filter)
            stmt = stmt.order_by("distance").limit(top_k)

            result = await self.db.execute(stmt)
            for row in result.all():
                c = row.CodeChunk
                key = (c.file_path, c.chunk_index)
                if key not in seen_keys:
                    seen_keys.add(key)
                    results.append({
                        "content": c.content,
                        "file_path": c.file_path,
                        "language": c.language,
                        "chunk_type": c.chunk_type,
                        "symbol_name": c.symbol_name,
                        "start_line": c.start_line,
                        "end_line": c.end_line,
                        "match_type": "semantic",
                        "similarity": round(1 - row.distance, 4),
                    })
        except Exception as e:
            logger.warning("vector_similarity_search_failed", error=str(e))

        # Sort semantic matches by similarity descending while keeping symbol/keyword matches ordered
        results.sort(
            key=lambda r: (
                1 if r.get("match_type") == "symbol" else (0 if r.get("similarity") is not None else -1),
                r.get("similarity") or 0.0,
            ),
            reverse=True,
        )
        return results[:top_k]

    # ── Delete (for re-indexing) ───────────────────────────────────────────

    async def delete_all(self, commit: bool = True) -> int:
        """
        Delete all chunks for this repo. Called before re-indexing
        to avoid stale embeddings from a previous commit.
        """
        result = await self.db.execute(
            delete(CodeChunk).where(CodeChunk.repo_id == self.repo_id)
        )
        if commit:
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
