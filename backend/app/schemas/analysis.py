"""
DevLens AI — Analysis Job Schemas
Used by the job status endpoint and WebSocket progress stream.
The ProgressEvent shape must match what the frontend WebSocket listener expects.
"""

import uuid
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel


class JobStatusResponse(BaseModel):
    """GET /api/v1/analysis/{job_id}/status"""
    id: uuid.UUID
    repo_id: uuid.UUID
    status: str
    current_step: str | None
    current_step_index: int
    progress_pct: int
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── WebSocket Progress Events ─────────────────────────────────────────────
# These are JSON payloads streamed to the frontend over WS /ws/jobs/{job_id}

class StepStartEvent(BaseModel):
    type: Literal["step_start"] = "step_start"
    step: str
    step_index: int

class StepDoneEvent(BaseModel):
    type: Literal["step_done"] = "step_done"
    step: str
    step_index: int
    meta: dict[str, Any] = {}  # e.g. {"files": 4812, "size_mb": 24}

class CompleteEvent(BaseModel):
    type: Literal["complete"] = "complete"
    session_id: str
    job_id: str

class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str

# Union type for type-safe event handling
ProgressEvent = StepStartEvent | StepDoneEvent | CompleteEvent | ErrorEvent
