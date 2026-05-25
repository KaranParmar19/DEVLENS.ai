"""
DevLens AI — API Key Auth Middleware
Validates X-API-Key header on protected routes.
Works alongside the GitHub OAuth flow — users who log in via OAuth
get an auto-generated API key stored in the User model.

Two auth modes:
1. X-API-Key header → database lookup → User object
2. No key → anonymous access (rate-limited, some endpoints blocked)
"""

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

log = structlog.get_logger(__name__)

# Routes that NEVER require auth (public endpoints)
PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/auth/github/login",
    "/api/v1/auth/github/callback",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/",
}

# Routes that require auth (all others not in PUBLIC_PATHS are checked)
AUTH_REQUIRED_PREFIXES = [
    "/api/v1/repos/",
    "/api/v1/sessions/",
    "/api/v1/chat",
    "/ws/",
]


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Lightweight API key authentication middleware.

    Validates the X-API-Key header against the users table.
    Attaches the user_id to request.state.user_id for downstream handlers.

    If a protected route is accessed without a valid key → 401 Unauthorized.
    Public routes and anonymous GET endpoints pass through.
    """

    def __init__(self, app: ASGIApp, session_factory) -> None:
        super().__init__(app)
        self.session_factory = session_factory

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # Always allow public routes
        if path in PUBLIC_PATHS or path.startswith("/static"):
            return await call_next(request)

        # Check if this path requires auth
        requires_auth = any(path.startswith(prefix) for prefix in AUTH_REQUIRED_PREFIXES)

        if not requires_auth:
            return await call_next(request)

        # Extract and validate API key
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            log.warning("auth_missing_key", path=path, method=request.method)
            return Response(
                content='{"detail": "Missing X-API-Key header"}',
                status_code=401,
                media_type="application/json",
                headers={"WWW-Authenticate": "ApiKey"},
            )

        # Lookup key in database
        user = await self._resolve_user(api_key)
        if user is None:
            log.warning("auth_invalid_key", path=path, key_prefix=api_key[:8])
            return Response(
                content='{"detail": "Invalid API key"}',
                status_code=401,
                media_type="application/json",
                headers={"WWW-Authenticate": "ApiKey"},
            )

        # Attach resolved user_id to request state for route handlers
        request.state.user_id = user["id"]
        request.state.github_login = user.get("github_login")
        return await call_next(request)

    async def _resolve_user(self, api_key: str) -> dict | None:
        """Query DB for user matching api_key. Returns None if not found."""
        try:
            async with self.session_factory() as session:
                from app.models.user import User
                result = await session.execute(
                    select(User).where(User.api_key == api_key, User.is_active == True)  # noqa: E712
                )
                user = result.scalar_one_or_none()
                if user is None:
                    return None
                return {"id": user.id, "github_login": user.github_login}
        except Exception as exc:
            log.error("auth_db_error", error=str(exc))
            return None
