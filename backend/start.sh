#!/bin/sh
set -e

# Start local redis if REDIS_URL is not set or points to localhost/127.0.0.1
REDIS_TARGET="${REDIS_URL:-redis://127.0.0.1:6379/0}"
if echo "$REDIS_TARGET" | grep -qE "localhost|127\.0\.0\.1"; then
    echo "[start.sh] Starting embedded Redis server on 127.0.0.1:6379..."
    redis-server --daemonize yes --appendonly no --save "" --loglevel warning
fi

# Run database migrations
if [ "$RUN_MIGRATIONS" != "false" ]; then
    echo "[start.sh] Running database migrations (alembic upgrade head)..."
    alembic upgrade head || echo "[start.sh] Warning: migration step encountered an issue, proceeding to start services..."
fi

# Start Celery worker in background if enabled (default true for single-container setups)
if [ "$START_WORKER" != "false" ]; then
    echo "[start.sh] Starting embedded Celery background worker..."
    celery -A app.tasks.celery_app worker --loglevel=warning --concurrency=1 -Q ingestion,celery &
fi

echo "[start.sh] Starting Uvicorn API server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${UVICORN_WORKERS:-1}" --proxy-headers --forwarded-allow-ips=* --no-access-log
