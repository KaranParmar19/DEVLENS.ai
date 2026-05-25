"""
DevLens AI — API Key Auth Dependency
Validates the X-API-Key header on every protected route.
Also handles optional GitHub OAuth session tokens via X-Session-Token.
"""

import structlog
from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.user import User

logger = structlog.get_logger(__name__)
settings = get_settings()


# ── Database Session Dependency ───────────────────────────────────────────

async def get_db() -> AsyncSession:
    """Yields an async SQLAlchemy session, closes it after the request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Auth Dependencies ─────────────────────────────────────────────────────

async def require_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> str:
    """
    Validates the X-API-Key header.
    Rejects with 401 if missing or wrong.
    Used on all routes that need auth.
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    if x_api_key != settings.api_key:
        logger.warning("invalid_api_key_attempt", provided_key=x_api_key[:8] + "...")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key.",
        )
    return x_api_key


async def get_current_user(
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """
    Optional: resolves a GitHub OAuth session token → User.
    Returns None for unauthenticated (anonymous) requests.
    Used on endpoints that support both auth and anonymous access.
    """
    if not x_session_token:
        return None

    result = await db.execute(
        select(User).where(User.api_key == x_session_token, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if user:
        logger.info("authenticated_user", github_username=user.github_username)
    return user
