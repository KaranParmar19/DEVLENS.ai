"""
DevLens AI — Chat Routes
POST /api/v1/chat          — synchronous Q&A (REST fallback)
WS   /ws/chat/{session_id} — streaming token-by-token response

BUG-05 FIX: Removed __import__ hack; DB session created properly with
            AsyncSessionLocal imported at module level.
M-04  FIX:  Chat history capped at last 50 turns to prevent JSONB bloat.
BUG-04 FIX: WebSocket route lives on ws_router, not on router.
"""

import uuid
import json
import structlog
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.api.deps import get_db, require_api_key
from app.database import AsyncSessionLocal           # BUG-05 FIX: proper import
from app.models.session import Session
from app.models.repository import Repository
from app.schemas.chat import ChatRequest, ChatResponse, WsIncoming, StreamChunk, StreamDone, StreamError
from app.agent.devlens_agent import DevLensAgent

logger = structlog.get_logger(__name__)

router = APIRouter()
ws_router = APIRouter()      # BUG-04 FIX: dedicated WS router

# M-04 FIX: cap conversation history to last N turns
MAX_HISTORY_TURNS = 50


async def _get_session_and_repo(
    session_id: uuid.UUID, db: AsyncSession
) -> tuple[Session, Repository]:
    """Shared helper: load session + repo, raise 404 if not found."""
    result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    result = await db.execute(
        select(Repository).where(Repository.id == session.repo_id)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    if repo.status.value != "ready":
        raise HTTPException(status_code=409, detail="Repository is not yet indexed.")

    return session, repo


def _trim_history(history: list[dict]) -> list[dict]:
    """
    M-04 FIX: Keep only the last MAX_HISTORY_TURNS turns to prevent
    JSONB column from growing without bound.
    """
    return history[-MAX_HISTORY_TURNS:] if len(history) > MAX_HISTORY_TURNS else history


# ── REST Chat ─────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    """Synchronous Q&A. Use WebSocket /ws/chat/{session_id} for streaming."""
    session, repo = await _get_session_and_repo(payload.session_id, db)

    agent = DevLensAgent(
        db=db,
        repo_id=repo.id,
        repo_full_name=repo.full_name,
        graph_cache=repo.graph_cache,
    )

    history = _trim_history(session.chat_history or [])
    reply, sources = await agent.chat(
        message=payload.message,
        history=history,
    )

    # Append to chat history (M-04: trim again after append)
    new_history = _trim_history(list(history) + [
        {"role": "user", "content": payload.message},
        {"role": "assistant", "content": reply, "sources": sources},
    ])

    await db.execute(
        update(Session)
        .where(Session.id == session.id)
        .values(chat_history=new_history, last_active_at=datetime.now(timezone.utc))
    )
    await db.commit()

    return ChatResponse(reply=reply, sources=sources, session_id=payload.session_id)


# ── WebSocket Streaming Chat ──────────────────────────────────────────────

@ws_router.websocket("/ws/chat/{session_id}")
async def chat_ws(session_id: str, websocket: WebSocket):
    """
    Streaming chat over WebSocket.
    Client sends: {"message": "..."} as JSON text.
    Server streams: {"type": "stream_chunk", "delta": "..."} tokens
    Then sends: {"type": "stream_done", "sources": [...]}

    BUG-05 FIX: uses proper AsyncSessionLocal context manager.
    M-04  FIX:  history trimmed to MAX_HISTORY_TURNS.
    BUG-04 FIX: mounted on ws_router.
    """
    await websocket.accept()
    logger.info("ws_chat_connected", session_id=session_id)

    # BUG-05 FIX: proper import + context manager
    async with AsyncSessionLocal() as db:
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    incoming = WsIncoming.model_validate_json(raw)
                except Exception as parse_exc:
                    await websocket.send_text(
                        StreamError(message=f"Invalid message format: {parse_exc}").model_dump_json()
                    )
                    continue

                try:
                    session, repo = await _get_session_and_repo(
                        uuid.UUID(session_id), db
                    )
                except HTTPException as e:
                    await websocket.send_text(
                        StreamError(message=e.detail).model_dump_json()
                    )
                    continue
                except Exception as e:
                    await websocket.send_text(
                        StreamError(message="Internal error loading session.").model_dump_json()
                    )
                    logger.exception("ws_chat_session_load_error", session_id=session_id)
                    continue

                agent = DevLensAgent(
                    db=db,
                    repo_id=repo.id,
                    repo_full_name=repo.full_name,
                    graph_cache=repo.graph_cache,
                )

                history = _trim_history(session.chat_history or [])
                full_reply = ""

                try:
                    async for token in agent.stream_chat(
                        message=incoming.message,
                        history=history,
                    ):
                        full_reply += token
                        await websocket.send_text(
                            StreamChunk(delta=token).model_dump_json()
                        )
                except Exception as stream_exc:
                    logger.exception("ws_chat_stream_error", session_id=session_id)
                    await websocket.send_text(
                        StreamError(message="Streaming error — please retry.").model_dump_json()
                    )
                    continue

                await websocket.send_text(StreamDone(sources=[]).model_dump_json())

                # Persist to chat history with M-04 trim
                new_history = _trim_history(list(history) + [
                    {"role": "user", "content": incoming.message},
                    {"role": "assistant", "content": full_reply, "sources": []},
                ])
                await db.execute(
                    update(Session)
                    .where(Session.id == uuid.UUID(session_id))
                    .values(
                        chat_history=new_history,
                        last_active_at=datetime.now(timezone.utc),
                    )
                )
                await db.commit()

        except WebSocketDisconnect:
            logger.info("ws_chat_disconnected", session_id=session_id)
        except Exception:
            logger.exception("ws_chat_unexpected_error", session_id=session_id)
