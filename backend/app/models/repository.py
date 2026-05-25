"""
DevLens AI — Repository Model
Represents an indexed GitHub repository. Tracks metadata, indexing status,
and the commit SHA used for incremental re-indexing (skip if already up-to-date).
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Boolean, Enum, Text, BigInteger, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class RepoStatus(str, enum.Enum):
    """Lifecycle states of a repository's indexing process."""
    PENDING  = "pending"    # Queued, not yet started
    INDEXING = "indexing"   # Active Celery job running
    READY    = "ready"      # Fully indexed, available for queries
    FAILED   = "failed"     # Indexing failed (check analysis_jobs for details)
    STALE    = "stale"      # New commits detected — needs re-index


class Repository(Base):
    __tablename__ = "repositories"

    # ── Primary Key ────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── GitHub Identity ────────────────────────────────────────────────────
    github_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True, index=True)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(512), unique=True, nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Repo Metadata (fetched from GitHub API) ────────────────────────────
    stars: Mapped[int] = mapped_column(Integer, default=0)
    forks: Mapped[int] = mapped_column(Integer, default=0)
    default_branch: Mapped[str] = mapped_column(String(255), default="main")
    size_kb: Mapped[int] = mapped_column(Integer, default=0)
    file_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)

    # ── Language breakdown as JSON, e.g. {"TypeScript": 62, "Python": 38} ─
    languages: Mapped[dict] = mapped_column(JSONB, default=dict)

    # ── Monorepo detection flag ────────────────────────────────────────────
    is_monorepo: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Incremental indexing: skip if commit_sha matches latest ───────────
    latest_commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # ── Indexing Status ────────────────────────────────────────────────────
    status: Mapped[RepoStatus] = mapped_column(
        Enum(RepoStatus), default=RepoStatus.PENDING, index=True
    )
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Graph data cached as JSON (nodes + edges) ─────────────────────────
    graph_cache: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ── Timestamps ─────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # ── Relationships ──────────────────────────────────────────────────────
    analysis_jobs: Mapped[list["AnalysisJob"]] = relationship("AnalysisJob", back_populates="repository")
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="repository")
    code_chunks: Mapped[list["CodeChunk"]] = relationship("CodeChunk", back_populates="repository")

    def __repr__(self) -> str:
        return f"<Repository {self.full_name} status={self.status}>"
