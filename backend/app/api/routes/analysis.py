"""
DevLens AI — Analysis Job Status + WebSocket Progress Stream

BUG-03 FIX: WebSocket handler drains the Redis backlog list on connect
            (events published before the client connected) then switches
            to pub/sub for live events.  No more missed early steps.
BUG-11 FIX: asyncio.wait_for wraps the pub/sub listen loop with a
            configurable timeout matching ingestion_timeout_seconds.
BUG-04 FIX: WebSocket routes moved to a dedicated ws_router so they
            don't clash with REST routes when mounted at prefix "".
"""

import json
import uuid
import asyncio
import structlog
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, require_api_key
from app.models.analysis_job import AnalysisJob
from app.schemas.analysis import JobStatusResponse
from app.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

router = APIRouter()
ws_router = APIRouter()        # BUG-04 FIX: dedicated WS router


# ── REST: Poll job status ─────────────────────────────────────────────────

@router.get("/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    """Poll for the current status of an analysis job."""
    result = await db.execute(select(AnalysisJob).where(AnalysisJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    return job


# ── WebSocket: Real-time progress stream ─────────────────────────────────

@ws_router.websocket("/ws/jobs/{job_id}")
async def job_progress_ws(job_id: str, websocket: WebSocket):
    """
    WebSocket endpoint for real-time ingestion progress.

    Protocol:
    1. On connect: drain the Redis backlog list so the client receives
       any events that were published before the WS was established.
       This fixes the race condition where early steps are missed.
    2. Subscribe to pub/sub channel for live events going forward.
    3. Close automatically on "complete" or "error" event, or on timeout.

    BUG-03 FIX: backlog drain on connect.
    BUG-11 FIX: timeout wraps the pub/sub loop.
    """
    await websocket.accept()
    logger.info("ws_job_progress_connected", job_id=job_id)

    backlog_key = f"job_backlog:{job_id}"
    channel = f"job:{job_id}"
    timeout = settings.ingestion_timeout_seconds + 30

    r = aioredis.from_url(settings.redis_url, decode_responses=True)

    try:
        # ── Phase 1: Drain the backlog list ──────────────────────────────
        # This handles events published before the WebSocket connected.
        backlog = await r.lrange(backlog_key, 0, -1)
        terminal_seen = False
        for raw in backlog:
            await websocket.send_text(raw)
            event = json.loads(raw)
            if event.get("type") in ("complete", "error"):
                terminal_seen = True

        if terminal_seen:
            logger.info("ws_job_served_from_backlog", job_id=job_id)
            return

        # ── Phase 2: Subscribe to live pub/sub ───────────────────────────
        pubsub = r.pubsub()
        await pubsub.subscribe(channel)

        async def _listen() -> None:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                data = message["data"]
                await websocket.send_text(data)
                event = json.loads(data)
                if event.get("type") in ("complete", "error"):
                    return

        try:
            # BUG-11 FIX: hard timeout so a crashed worker doesn't hang WS
            await asyncio.wait_for(_listen(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("ws_job_progress_timeout", job_id=job_id, timeout=timeout)
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Analysis timed out. Please try again.",
            }))
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

    except WebSocketDisconnect:
        logger.info("ws_job_progress_disconnected", job_id=job_id)
    finally:
        await r.aclose()
        # Only close if still open
        try:
            await websocket.close()
        except Exception:
            pass
