"""
DevLens AI — User Model
Stores GitHub OAuth users. Each user gets an auto-generated API key
that they can use for API key auth (X-API-Key header).
"""

import secrets
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class User(Base):
    __tablename__ = "users"

    # ── Primary Key ────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── GitHub Identity ────────────────────────────────────────────────────
    github_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    github_username: Mapped[str] = mapped_column(String(255), nullable=False)
    github_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    github_avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # ── GitHub OAuth Token (encrypted at rest in production) ───────────────
    github_access_token: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # ── DevLens API Key (auto-generated, for X-API-Key auth) ──────────────
    api_key: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        default=lambda: secrets.token_hex(32),
    )

    # ── Status ─────────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # ── Timestamps ─────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # ── Relationships ──────────────────────────────────────────────────────
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="user")

    def __repr__(self) -> str:
        return f"<User github={self.github_username}>"
