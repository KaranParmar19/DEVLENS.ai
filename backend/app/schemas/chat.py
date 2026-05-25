"""
DevLens AI — Chat Schemas
Covers both REST chat endpoint and WebSocket streaming protocol.
The StreamChunk shape mirrors what the frontend chat panel renders.
"""

import uuid
from typing import Literal
from pydantic import BaseModel


# ── REST Chat ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """POST /api/v1/chat — single-turn REST Q&A."""
    session_id: uuid.UUID
    message: str

class ChatMessage(BaseModel):
    """A single turn in the conversation history."""
    role: Literal["user", "assistant"]
    content: str
    sources: list[str] = []  # File paths cited by the assistant

class ChatResponse(BaseModel):
    """Synchronous chat response (non-streaming fallback)."""
    reply: str
    sources: list[str]
    session_id: uuid.UUID


# ── WebSocket Chat Protocol ───────────────────────────────────────────────
# WS /ws/chat/{session_id}  — Client sends WsIncoming, server streams WsOutgoing

class WsIncoming(BaseModel):
    """Message from frontend → backend over WebSocket."""
    message: str

class StreamChunk(BaseModel):
    """Token-by-token stream from backend → frontend."""
    type: Literal["stream_chunk"] = "stream_chunk"
    delta: str           # Partial text from Claude

class StreamDone(BaseModel):
    """Signals end of Claude response stream."""
    type: Literal["stream_done"] = "stream_done"
    sources: list[str]   # Cited file paths

class StreamError(BaseModel):
    """Error during streaming."""
    type: Literal["stream_error"] = "stream_error"
    message: str

WsOutgoing = StreamChunk | StreamDone | StreamError
