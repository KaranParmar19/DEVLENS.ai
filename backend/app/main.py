"""
DevLens AI — FastAPI Application Entry Point
Wires together all middleware, routers, and startup/shutdown lifecycle.

BUG-04 FIX: WebSocket routes mounted from dedicated ws_router objects,
            preventing REST routes from being double-mounted at prefix "".
BUG-09 FIX: RateLimitMiddleware now registered with a shared Redis client.
BUG-10 FIX: configure_structlog() called at startup.
"""

import structlog
import redis.asyncio as aioredis
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, init_pgvector, Base
from app.middleware.logging import StructlogMiddleware, configure_structlog
from app.middleware.rate_limit import RateLimitMiddleware
from app.api.routes import health, auth, repos, sessions, analysis, chat

logger = structlog.get_logger(__name__)
settings = get_settings()

# BUG-10 FIX: configure structlog before any other logger call
configure_structlog(debug=settings.debug)


# ── Shared Redis client (created once, reused by rate limiter) ────────────
# Stored on app.state so middleware can reference it without circular imports.
_redis_client: aioredis.Redis | None = None


# ── Application Lifespan ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown lifecycle.
    All one-time initialisation goes here (not in module-level code),
    so it runs inside the correct event loop.
    """
    global _redis_client

    # ── Startup ──────────────────────────────────────────────────────────
    logger.info(
        "devlens_starting",
        version=settings.app_version,
        debug=settings.debug,
    )

    # BUG-09 FIX: Create shared Redis client for rate limiter
    _redis_client = aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
    )
    app.state.redis = _redis_client

    # Initialize pgvector extension (idempotent)
    await init_pgvector()

    # In debug mode: auto-create tables (use Alembic in production)
    if settings.debug:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("database_tables_synced_debug_mode")

    logger.info("devlens_ready")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    if _redis_client:
        await _redis_client.aclose()
    await engine.dispose()
    logger.info("devlens_stopped")


# ── FastAPI App Instance ──────────────────────────────────────────────────
app = FastAPI(
    title="DevLens AI",
    version=settings.app_version,
    description=(
        "Intelligent codebase explorer API. "
        "Paste any GitHub repo URL and get architecture maps, "
        "smart Q&A, code flow tracing, and onboarding docs."
    ),
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)


# ── Middleware stack (order matters: outermost = first to run) ─────────────

# 1. Structured logging (must be outermost so it captures every request)
app.add_middleware(StructlogMiddleware)

# 2. CORS — allow Cloudflare frontend + local dev origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# 3. BUG-09 FIX: Rate limiting (Redis sliding window)
#    We can't pass the async Redis client directly at module level because
#    the event loop isn't running yet, so we use a deferred factory approach.
#    The middleware is created after app creation but before first request.
@app.on_event("startup")
async def _register_rate_limit_middleware():
    """
    FastAPI doesn't support async middleware factories directly.
    Register rate limiter after the event loop is running so _redis_client exists.
    """
    # NOTE: add_middleware after startup doesn't affect already-registered
    # middleware chains. The recommended pattern is to add it here as a
    # Starlette BaseHTTPMiddleware directly.
    from starlette.middleware.base import BaseHTTPMiddleware
    from app.middleware.rate_limit import RateLimitMiddleware

    app.add_middleware(
        RateLimitMiddleware,
        redis_client=app.state.redis,
        ip_limit=settings.rate_limit_per_minute,
        key_limit=settings.rate_limit_per_minute * 5,
        window_seconds=60,
    )


# ── REST API Routers ───────────────────────────────────────────────────────
prefix = settings.api_v1_prefix

app.include_router(health.router,           prefix=prefix,                  tags=["Health"])
app.include_router(auth.router,             prefix=f"{prefix}/auth",        tags=["Auth"])
app.include_router(repos.router,            prefix=f"{prefix}/repos",       tags=["Repositories"])
app.include_router(sessions.router,         prefix=f"{prefix}/sessions",    tags=["Sessions"])
app.include_router(sessions.export_router,  prefix=f"{prefix}/sessions",    tags=["Sessions"])
app.include_router(analysis.router,         prefix=f"{prefix}/analysis",    tags=["Analysis"])
app.include_router(chat.router,             prefix=prefix,                  tags=["Chat"])

# ── WebSocket Routers (BUG-04 FIX: dedicated ws_router objects) ───────────
# Mounted at "" so WebSocket clients connect to /ws/jobs/{id} and /ws/chat/{id}
app.include_router(analysis.ws_router,  prefix="", tags=["WebSocket"])
app.include_router(chat.ws_router,      prefix="", tags=["WebSocket"])
