"""
DevLens AI — Database Engine & Session Factory
Sets up async SQLAlchemy with PostgreSQL (asyncpg driver) and
initializes the pgvector extension on first connect.
"""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


# ── SQLAlchemy Async Engine ────────────────────────────────────────────────
engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.debug,        # Log SQL queries in debug mode
    pool_size=10,               # Connection pool size
    max_overflow=20,            # Extra connections beyond pool_size
    pool_pre_ping=True,         # Verify connections are alive before use
    pool_recycle=3600,          # Recycle connections every hour
)

# ── Session Factory ────────────────────────────────────────────────────────
AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,     # Keep objects accessible after commit
    autocommit=False,
    autoflush=False,
)


# ── Declarative Base (all models inherit from this) ────────────────────────
class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


# ── pgvector Extension Initializer ────────────────────────────────────────
async def init_pgvector() -> None:
    """
    Create the pgvector extension if it doesn't exist.
    Called once at application startup (in main.py lifespan).
    """
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    logger.info("pgvector extension ready")


# ── Database Health Check ──────────────────────────────────────────────────
async def check_db_health() -> bool:
    """Returns True if the database is reachable, False otherwise."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("Database health check failed", error=str(exc))
        return False
