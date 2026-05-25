"""
DevLens AI — Analysis Job Status Route
GET /api/v1/analysis/{job_id}/status
WebSocket /ws/jobs/{job_id} — real-time progress stream
"""

import json
import uuid
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


@router.websocket("/ws/jobs/{job_id}")
async def job_progress_ws(job_id: str, websocket: WebSocket):
    """
    WebSocket endpoint for real-time ingestion progress.
    The frontend connects here immediately after calling POST /repos/analyze.
    This handler subscribes to the Redis pub/sub channel for this job_id
    and forwards every event JSON as a WebSocket text message.

    The channel is: job:{job_id}
    Events match the ProgressEvent schema (step_start, step_done, complete, error).
    """
    await websocket.accept()
    logger.info("ws_job_progress_connected", job_id=job_id)

    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()
    channel = f"job:{job_id}"

    try:
        await pubsub.subscribe(channel)

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue

            data = message["data"]
            await websocket.send_text(data)

            # Close after job completes or errors
            event = json.loads(data)
            if event.get("type") in ("complete", "error"):
                break

    except WebSocketDisconnect:
        logger.info("ws_job_progress_disconnected", job_id=job_id)
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await r.aclose()
        await websocket.close()
