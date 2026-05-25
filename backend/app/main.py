"""
DevLens AI — FastAPI Application Entry Point
Wires together all middleware, routers, and startup/shutdown lifecycle.
"""

import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.database import engine, init_pgvector, Base
from app.middleware.logging import StructlogMiddleware
from app.api.routes import health, auth, repos, sessions, analysis, chat

logger = structlog.get_logger(__name__)
settings = get_settings()


# ── Application Lifespan (startup / shutdown) ─────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs startup logic before the first request and shutdown logic after the
    last. Using lifespan (not deprecated on_event) is the FastAPI best practice.
    """
    # ── Startup ──────────────────────────────────────────────────────────
    logger.info(
        "Starting DevLens AI",
        version=settings.app_version,
        debug=settings.debug,
    )

    # Initialize pgvector extension (idempotent — safe to run every time)
    await init_pgvector()

    # Create all tables (in production, use Alembic migrations instead)
    if settings.debug:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables synchronized (debug mode)")

    logger.info("DevLens AI is ready to serve requests")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    await engine.dispose()
    logger.info("DevLens AI stopped — connections closed")


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

# ── Middleware ─────────────────────────────────────────────────────────────

# 1. Structured request/response logging (must be outermost)
app.add_middleware(StructlogMiddleware)

# 2. CORS — allow the Cloudflare frontend + local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# ── API Routers ────────────────────────────────────────────────────────────
prefix = settings.api_v1_prefix

app.include_router(health.router,   prefix=prefix,               tags=["Health"])
app.include_router(auth.router,     prefix=f"{prefix}/auth",     tags=["Auth"])
app.include_router(repos.router,    prefix=f"{prefix}/repos",    tags=["Repositories"])
app.include_router(sessions.router, prefix=f"{prefix}/sessions", tags=["Sessions"])
app.include_router(analysis.router, prefix=f"{prefix}/analysis", tags=["Analysis"])
app.include_router(chat.router,     prefix=prefix,               tags=["Chat"])

# WebSocket routes (no /api/v1 prefix — browsers connect directly)
app.include_router(analysis.router, prefix="",   tags=["WebSocket"])
app.include_router(chat.router,     prefix="",   tags=["WebSocket"])
