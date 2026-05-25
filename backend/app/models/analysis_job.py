"""
DevLens AI — AnalysisJob Model
Tracks background Celery ingestion jobs. The frontend polls this (or
subscribes via WebSocket) to show real-time progress during repo ingestion.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Enum, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class JobStatus(str, enum.Enum):
    """Celery task lifecycle states, mirrored for our DB tracking."""
    QUEUED    = "queued"     # Submitted to Celery queue, not yet picked up
    RUNNING   = "running"    # Worker is actively processing
    COMPLETE  = "complete"   # Successfully finished
    FAILED    = "failed"     # Unrecoverable error — check error_message


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    # ── Primary Key ────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Foreign Keys ───────────────────────────────────────────────────────
    repo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )

    # ── Celery Task ID (used to inspect/revoke tasks) ──────────────────────
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # ── Progress Tracking ──────────────────────────────────────────────────
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus), default=JobStatus.QUEUED, nullable=False, index=True
    )
    current_step: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_step_index: Mapped[int] = mapped_column(Integer, default=-1)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)

    # ── Error Reporting ────────────────────────────────────────────────────
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Timestamps ─────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────
    repository: Mapped["Repository"] = relationship("Repository", back_populates="analysis_jobs")
    session: Mapped["Session | None"] = relationship("Session", back_populates="analysis_jobs")

    def __repr__(self) -> str:
        return f"<AnalysisJob {self.id} status={self.status} step={self.current_step_index}>"
