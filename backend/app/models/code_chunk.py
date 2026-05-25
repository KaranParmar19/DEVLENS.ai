"""
DevLens AI — CodeChunk Model
Stores semantically chunked code files with their pgvector embeddings.
Each chunk maps to a function, class, or logical block from a source file.
The `embedding` column is the pgvector type for similarity search.
"""

import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector

from app.database import Base
from app.config import get_settings

settings = get_settings()


class CodeChunk(Base):
    __tablename__ = "code_chunks"

    # ── Primary Key ────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Foreign Key ────────────────────────────────────────────────────────
    repo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    # ── Source Location ────────────────────────────────────────────────────
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False, index=True)
    language: Mapped[str] = mapped_column(String(64), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Chunk Content ──────────────────────────────────────────────────────
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0)

    # ── AST Metadata (populated for code-aware chunks) ─────────────────────
    # chunk_type: 'function' | 'class' | 'module' | 'generic'
    chunk_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # symbol_name: the function or class name, e.g. "calculate_permissions"
    symbol_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── pgvector Embedding ─────────────────────────────────────────────────
    # Dimensionality matches OPENAI_EMBEDDING_DIMENSIONS (default: 1536)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(settings.openai_embedding_dimensions), nullable=True
    )

    # ── Timestamp ──────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Relationships ──────────────────────────────────────────────────────
    repository: Mapped["Repository"] = relationship("Repository", back_populates="code_chunks")

    def __repr__(self) -> str:
        return f"<CodeChunk {self.file_path}[{self.chunk_index}] type={self.chunk_type}>"
