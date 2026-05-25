"""
DevLens AI — Celery Application Configuration
Configures Celery with Redis as both the broker and result backend.
Routes ingestion tasks to a dedicated 'ingestion' queue so they can
scale independently from other task types.
"""

from celery import Celery
from app.config import get_settings

settings = get_settings()

# ── Celery App ────────────────────────────────────────────────────────────
celery_app = Celery(
    "devlens",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.repo_tasks"],
)

# ── Configuration ─────────────────────────────────────────────────────────
celery_app.conf.update(
    # Serialization — JSON is human-readable and safe
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task routing — ingestion tasks go to a dedicated queue
    task_routes={
        "app.tasks.repo_tasks.ingest_repository": {"queue": "ingestion"},
    },

    # Result expiry — keep results for 1 hour
    result_expires=3600,

    # Retry policy
    task_acks_late=True,                # Ack after task completes (not before)
    task_reject_on_worker_lost=True,    # Re-queue if worker dies mid-task

    # Concurrency guard: one ingestion job per worker at a time
    worker_prefetch_multiplier=1,

    # Soft/hard time limits for ingestion (INGESTION_TIMEOUT_SECONDS config)
    task_soft_time_limit=settings.ingestion_timeout_seconds,
    task_time_limit=settings.ingestion_timeout_seconds + 60,

    # Beat schedule (optional: cleanup expired sessions nightly)
    beat_schedule={
        "cleanup-expired-sessions": {
            "task": "app.tasks.repo_tasks.cleanup_expired_sessions",
            "schedule": 86400.0,  # Every 24 hours
        }
    },
)
