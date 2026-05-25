"""
DevLens AI — Session Model
One session = one user analysing one repository.
Holds the chat history (JSONB array) and links to the indexed repo.
"""

import uuid
from datetime import datetime, timedelta
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


def _default_expiry() -> datetime:
    """Sessions expire 7 days after creation."""
    from datetime import timezone
    return datetime.now(timezone.utc) + timedelta(days=7)


class Session(Base):
    __tablename__ = "sessions"

    # ── Primary Key ────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Foreign Keys ───────────────────────────────────────────────────────
    repo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # ── Chat History ───────────────────────────────────────────────────────
    # Stored as JSONB array: [{"role": "user"|"assistant", "content": "...", "sources": [...]}]
    chat_history: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    # ── Timestamps ─────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_active_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_default_expiry
    )

    # ── Relationships ──────────────────────────────────────────────────────
    repository: Mapped["Repository"] = relationship("Repository", back_populates="sessions")
    user: Mapped["User | None"] = relationship("User", back_populates="sessions")
    analysis_jobs: Mapped[list["AnalysisJob"]] = relationship("AnalysisJob", back_populates="session")

    def __repr__(self) -> str:
        return f"<Session {self.id} repo={self.repo_id}>"
