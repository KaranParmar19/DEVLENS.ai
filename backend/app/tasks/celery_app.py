"""
DevLens AI — Celery Application Configuration
Configures Celery with Redis as both the broker and result backend.
Routes ingestion tasks to a dedicated 'ingestion' queue.

M-02 FIX: broker_transport_options.visibility_timeout set to
          ingestion_timeout + 300 so long-running tasks are not
          re-queued by Redis before they finish.
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
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task routing
    task_routes={
        "app.tasks.repo_tasks.ingest_repository": {"queue": "ingestion"},
    },

    # Result expiry — keep results for 2 hours
    result_expires=7200,

    # Reliability
    task_acks_late=True,                    # Ack after task completes (not before)
    task_reject_on_worker_lost=True,        # Re-queue if worker dies mid-task

    # M-02 FIX: visibility_timeout must exceed the longest possible task.
    # Default Redis visibility_timeout is 1 hour — our tasks can take up to
    # ingestion_timeout_seconds. Set to timeout + 5 min buffer.
    broker_transport_options={
        "visibility_timeout": settings.ingestion_timeout_seconds + 300,
    },

    # Concurrency guard: one ingestion job per worker process at a time
    worker_prefetch_multiplier=1,

    # Soft/hard time limits
    task_soft_time_limit=settings.ingestion_timeout_seconds,
    task_time_limit=settings.ingestion_timeout_seconds + 60,

    # Broker connection retry — avoids crash on first connect if Redis
    # isn't fully warmed up yet (common on fresh docker-compose up).
    broker_connection_retry_on_startup=True,
    broker_connection_max_retries=10,
    broker_connection_retry=True,

    # Beat schedule: cleanup expired sessions nightly
    beat_schedule={
        "cleanup-expired-sessions": {
            "task": "app.tasks.repo_tasks.cleanup_expired_sessions",
            "schedule": 86400.0,    # Every 24 hours
        }
    },
)
