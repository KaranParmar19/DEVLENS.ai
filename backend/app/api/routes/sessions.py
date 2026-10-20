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
from app.models.code_chunk import CodeChunk
from app.schemas.repository import (
    GraphData,
    FilesResponse,
    FileNode,
    ModuleInfo,
    FileDetailResponse,
    SymbolDetail,
)
from app.schemas.session import SessionResponse
from app.agent.devlens_agent import DevLensAgent
from app.core.language_detector import detect_language, detect_entry_points
from app.core.chunker import chunk_file

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


# ── File Detail & AST Symbol Inspection ───────────────────────────────────

@router.get("/{session_id}/file", response_model=FileDetailResponse)
async def get_file_detail(
    session_id: uuid.UUID,
    path: str = Query(..., description="File path within the repository"),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    """Fetch real file contents and AST symbols for a specific repository file."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    result = await db.execute(select(Repository).where(Repository.id == session.repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    clean_path = path.replace("\\", "/").lstrip("/")

    # 1. Query CodeChunk table in DB
    result = await db.execute(
        select(CodeChunk)
        .where(CodeChunk.repo_id == repo.id, CodeChunk.file_path == clean_path)
        .order_by(CodeChunk.chunk_index)
    )
    chunks = result.scalars().all()

    symbols: list[SymbolDetail] = []
    content = ""
    lang = detect_language(clean_path)

    if chunks:
        content = "\n\n".join(c.content for c in chunks)
        for c in chunks:
            if c.symbol_name:
                span = max(1, (c.end_line or 10) - (c.start_line or 0))
                symbols.append(
                    SymbolDetail(
                        name=c.symbol_name,
                        type=c.chunk_type or "function",
                        start_line=c.start_line,
                        end_line=c.end_line,
                        complexity=max(1, span // 8),
                    )
                )
    else:
        # 2. Fetch directly from GitHub if not cached in chunk table
        from app.core.github_client import GitHubClient
        async with GitHubClient() as gh:
            raw_content = await gh.get_file_content(
                repo.owner, repo.name, clean_path, repo.default_branch or "main"
            )
            if raw_content:
                content = raw_content
                parsed_chunks = chunk_file(file_path=clean_path, content=content, language=lang)
                for pc in parsed_chunks:
                    if pc.symbol_name:
                        span = max(1, (pc.end_line or 10) - (pc.start_line or 0))
                        symbols.append(
                            SymbolDetail(
                                name=pc.symbol_name,
                                type=pc.chunk_type or "function",
                                start_line=pc.start_line,
                                end_line=pc.end_line,
                                complexity=max(1, span // 8),
                            )
                        )

    if not content:
        raise HTTPException(status_code=404, detail=f"File content not available for '{clean_path}'")

    line_count = len(content.splitlines())
    return FileDetailResponse(
        path=clean_path,
        content=content,
        line_count=line_count,
        language=lang,
        symbols=symbols,
    )


# ── Commits Timeline & Architectural Drift ─────────────────────────────────

@router.get("/{session_id}/commits")
async def get_session_commits(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    """Fetch recent commit history with real diff metrics and dynamic architectural drift risk."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    result = await db.execute(select(Repository).where(Repository.id == session.repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    from app.core.github_client import GitHubClient
    async with GitHubClient() as gh:
        raw_commits = await gh.get_recent_commits(repo.owner, repo.name, repo.default_branch or "main")

    # Evaluate dynamic architectural drift risk from graph topology
    nodes = repo.graph_cache.get("nodes", []) if repo.graph_cache else []
    high_coupling = {n["id"] for n in nodes if n.get("coupling", 0) > 0.35}
    entry_points = {n["id"] for n in nodes if n.get("is_entry", False)}

    enriched_commits = []
    for c in raw_commits:
        impacted = c.get("impacted_files", [])
        touched_high_coupling = [f for f in impacted if f in high_coupling]
        touched_entries = [f for f in impacted if f in entry_points]

        if touched_high_coupling or touched_entries:
            risk_level = "high"
            reasons = []
            if touched_high_coupling:
                reasons.append(f"high-coupling hub ({', '.join(touched_high_coupling[:2])})")
            if touched_entries:
                reasons.append(f"entry point ({', '.join(touched_entries[:2])})")
            drift_summary = f"Architectural impact: modified {' and '.join(reasons)}."
        elif c.get("files_changed", 0) > 4 or (c.get("insertions", 0) + c.get("deletions", 0)) > 80:
            risk_level = "moderate"
            drift_summary = f"Broad delta: modified {c.get('files_changed', 0)} files (+{c.get('insertions', 0)}/-{c.get('deletions', 0)})."
        else:
            risk_level = "low"
            drift_summary = f"Localized modification ({c.get('files_changed', 0)} files, +{c.get('insertions', 0)}/-{c.get('deletions', 0)})."

        enriched_commits.append({
            **c,
            "risk_level": risk_level,
            "drift_summary": drift_summary,
        })

    return {
        "repo": repo.full_name,
        "branch": repo.default_branch or "main",
        "commits": enriched_commits,
    }



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
