"""
DevLens AI — Graph, Sessions, Export Routes
GET /api/v1/sessions/{id}/graph      — architecture graph data
GET /api/v1/sessions/{id}/files      — file tree, modules, entry points
GET /api/v1/sessions/{id}            — session metadata + chat history
GET /api/v1/sessions/{id}/onboarding — AI-generated onboarding doc
GET /api/v1/sessions/{id}/export     — Mermaid/PlantUML diagram export
DELETE /api/v1/sessions/{id}         — delete session
"""

import uuid
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, require_api_key
from app.models.session import Session
from app.models.repository import Repository
from app.schemas.repository import GraphData, FilesResponse, FileNode, ModuleInfo
from app.schemas.session import SessionResponse
from app.agent.devlens_agent import DevLensAgent
from app.core.language_detector import detect_language, detect_entry_points

logger = structlog.get_logger(__name__)
router = APIRouter()
export_router = APIRouter()


# ── Session ────────────────────────────────────────────────────────────────

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    await db.delete(session)
    await db.commit()


# ── Graph ─────────────────────────────────────────────────────────────────

@router.get("/{session_id}/graph", response_model=GraphData)
async def get_graph(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    """Return the cached architecture graph for the session's repo."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    result = await db.execute(select(Repository).where(Repository.id == session.repo_id))
    repo = result.scalar_one_or_none()
    if not repo or not repo.graph_cache:
        raise HTTPException(status_code=404, detail="Graph not yet available.")

    return GraphData(**repo.graph_cache)


# ── File Tree ──────────────────────────────────────────────────────────────

@router.get("/{session_id}/files", response_model=FilesResponse)
async def get_files(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    """Return file tree, module groups, and entry points for the left panel."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    result = await db.execute(select(Repository).where(Repository.id == session.repo_id))
    repo = result.scalar_one_or_none()
    if not repo or not repo.graph_cache:
        raise HTTPException(status_code=404, detail="Files not yet available.")

    # Build file tree from graph nodes
    nodes = repo.graph_cache.get("nodes", [])
    all_paths = [n["path"] for n in nodes]

    tree = [
        FileNode(
            path=n["path"],
            name=n["path"].split("/")[-1],
            is_dir=False,
            depth=len(n["path"].split("/")) - 1,
            language=n.get("language"),
            line_count=n.get("line_count"),
        )
        for n in nodes
    ]

    # Group by top-level directory
    module_map: dict[str, list[str]] = {}
    for path in all_paths:
        parts = path.split("/")
        top_dir = parts[0] if len(parts) > 1 else "root"
        module_map.setdefault(top_dir, []).append(path)

    modules = [
        ModuleInfo(name=name, file_count=len(files), files=files[:20])
        for name, files in module_map.items()
    ]

    entry_points = detect_entry_points(all_paths, repo.languages or {})

    return FilesResponse(tree=tree[:500], modules=modules, entry_points=entry_points)


# ── Onboarding Doc ─────────────────────────────────────────────────────────

@router.get("/{session_id}/onboarding")
async def get_onboarding_doc(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    """Generate (or return cached) onboarding documentation for the repo."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    result = await db.execute(select(Repository).where(Repository.id == session.repo_id))
    repo = result.scalar_one_or_none()
    if not repo or repo.status.value != "ready":
        raise HTTPException(status_code=409, detail="Repository not yet indexed.")

    agent = DevLensAgent(
        db=db, repo_id=repo.id,
        repo_full_name=repo.full_name,
        graph_cache=repo.graph_cache,
    )
    doc = await agent.generate_onboarding_doc()
    return {"markdown": doc, "repo": repo.full_name}


# ── Mermaid Export ─────────────────────────────────────────────────────────

@router.get("/{session_id}/export", response_class=PlainTextResponse)
async def export_graph(
    session_id: uuid.UUID,
    format: str = Query(default="mermaid", enum=["mermaid", "plantuml"]),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    """Export the dependency graph as Mermaid or PlantUML diagram text."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    result = await db.execute(select(Repository).where(Repository.id == session.repo_id))
    repo = result.scalar_one_or_none()
    if not repo or not repo.graph_cache:
        raise HTTPException(status_code=404, detail="Graph not yet available.")

    nodes = repo.graph_cache.get("nodes", [])
    edges = repo.graph_cache.get("edges", [])
    node_labels = {n["id"]: n["label"] for n in nodes}

    if format == "mermaid":
        lines = ["graph TD"]
        for src, tgt in edges[:80]:  # Cap to keep diagram readable
            src_label = node_labels.get(src, src.split("/")[-1])
            tgt_label = node_labels.get(tgt, tgt.split("/")[-1])
            lines.append(f'    {src.replace("/","_").replace(".","_")}["{src_label}"] --> {tgt.replace("/","_").replace(".","_")}["{tgt_label}"]')
        return "\n".join(lines)

    else:  # PlantUML
        lines = ["@startuml", f"title {repo.full_name} Dependency Graph"]
        for src, tgt in edges[:80]:
            src_label = node_labels.get(src, src.split("/")[-1])
            tgt_label = node_labels.get(tgt, tgt.split("/")[-1])
            lines.append(f'[{src_label}] --> [{tgt_label}]')
        lines.append("@enduml")
        return "\n".join(lines)
