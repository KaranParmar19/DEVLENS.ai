"""
DevLens AI — Health Check Route
GET /api/v1/health — checks connectivity to DB, Redis, and Claude API.
Used by Docker HEALTHCHECK, load balancers, and uptime monitors.
"""

import redis.asyncio as aioredis
import structlog
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings
from app.database import check_db_health

logger = structlog.get_logger(__name__)
settings = get_settings()
router = APIRouter()


class HealthResponse(BaseModel):
    status: str           # "ok" | "degraded" | "down"
    version: str
    services: dict[str, str]


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """
    Checks all critical service dependencies.
    Returns 200 even if some services are degraded — use `status` field
    to determine overall health. Only returns 503 if ALL services are down.
    """
    services: dict[str, str] = {}

    # ── PostgreSQL ─────────────────────────────────────────────────────
    db_ok = await check_db_health()
    services["postgres"] = "ok" if db_ok else "down"

    # ── Redis ──────────────────────────────────────────────────────────
    try:
        r = aioredis.from_url(settings.redis_url, socket_timeout=2)
        await r.ping()
        await r.aclose()
        services["redis"] = "ok"
    except Exception as exc:
        logger.warning("redis_health_check_failed", error=str(exc))
        services["redis"] = "down"

    # ── Overall status ─────────────────────────────────────────────────
    all_ok = all(v == "ok" for v in services.values())
    any_ok = any(v == "ok" for v in services.values())
    status = "ok" if all_ok else ("degraded" if any_ok else "down")

    logger.info("health_check", status=status, services=services)
    return HealthResponse(
        status=status,
        version=settings.app_version,
        services=services,
    )
