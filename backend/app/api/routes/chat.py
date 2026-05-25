"""
DevLens AI — Chat Routes
POST /api/v1/chat          — synchronous Q&A (REST fallback)
WS   /ws/chat/{session_id} — streaming token-by-token response
"""

import uuid
import json
import structlog
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.api.deps import get_db, require_api_key
from app.models.session import Session
from app.models.repository import Repository
from app.schemas.chat import ChatRequest, ChatResponse, WsIncoming, StreamChunk, StreamDone, StreamError
from app.agent.devlens_agent import DevLensAgent

logger = structlog.get_logger(__name__)
router = APIRouter()


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

    reply, sources = await agent.chat(
        message=payload.message,
        history=session.chat_history or [],
    )

    # Append to chat history
    new_history = list(session.chat_history or [])
    new_history.append({"role": "user", "content": payload.message})
    new_history.append({"role": "assistant", "content": reply, "sources": sources})

    await db.execute(
        update(Session)
        .where(Session.id == session.id)
        .values(chat_history=new_history, last_active_at=datetime.now(timezone.utc))
    )
    await db.commit()

    return ChatResponse(reply=reply, sources=sources, session_id=payload.session_id)


# ── WebSocket Streaming Chat ──────────────────────────────────────────────

@router.websocket("/ws/chat/{session_id}")
async def chat_ws(session_id: str, websocket: WebSocket):
    """
    Streaming chat over WebSocket.
    Client sends: {"message": "..."} as JSON text.
    Server streams: {"type": "stream_chunk", "delta": "..."} tokens
    Then sends: {"type": "stream_done", "sources": [...]}
    """
    await websocket.accept()
    logger.info("ws_chat_connected", session_id=session_id)

    async with __import__("app.database", fromlist=["AsyncSessionLocal"]).AsyncSessionLocal() as db:
        try:
            while True:
                raw = await websocket.receive_text()
                incoming = WsIncoming.model_validate_json(raw)

                try:
                    session, repo = await _get_session_and_repo(
                        uuid.UUID(session_id), db
                    )
                except HTTPException as e:
                    await websocket.send_text(
                        StreamError(message=e.detail).model_dump_json()
                    )
                    continue

                agent = DevLensAgent(
                    db=db,
                    repo_id=repo.id,
                    repo_full_name=repo.full_name,
                    graph_cache=repo.graph_cache,
                )

                full_reply = ""
                async for token in agent.stream_chat(
                    message=incoming.message,
                    history=session.chat_history or [],
                ):
                    full_reply += token
                    await websocket.send_text(
                        StreamChunk(delta=token).model_dump_json()
                    )

                await websocket.send_text(StreamDone(sources=[]).model_dump_json())

                # Persist to chat history
                new_history = list(session.chat_history or [])
                new_history.append({"role": "user", "content": incoming.message})
                new_history.append({"role": "assistant", "content": full_reply, "sources": []})
                await db.execute(
                    update(Session)
                    .where(Session.id == uuid.UUID(session_id))
                    .values(chat_history=new_history)
                )
                await db.commit()

        except WebSocketDisconnect:
            logger.info("ws_chat_disconnected", session_id=session_id)
