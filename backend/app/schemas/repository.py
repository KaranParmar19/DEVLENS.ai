"""
DevLens AI — Repository & Graph Schemas
Pydantic models for repository REST API requests and responses.
The ArchNode/ArchEdge/GraphData types define the exact contract
the frontend's ArchitectureGraph component expects.
"""

import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, HttpUrl, field_validator


# ── Request Schemas ───────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """POST /api/v1/repos/analyze — submit a repo URL for ingestion."""
    repo_url: str
    branch: str = "main"  # Optional: override default branch

    @field_validator("repo_url")
    @classmethod
    def validate_github_url(cls, v: str) -> str:
        """Normalise GitHub URLs — accept github.com/org/repo or full HTTPS."""
        v = v.strip().rstrip("/")
        if not v.startswith("http"):
            v = f"https://github.com/{v}"
        if "github.com" not in v:
            raise ValueError("Only GitHub repositories are supported.")
        return v


# ── Response Schemas ───────────────────────────────────────────────────────

class RepoResponse(BaseModel):
    """Returned immediately after submitting a repo for analysis."""
    id: uuid.UUID
    full_name: str
    owner: str
    name: str
    url: str
    description: str | None
    stars: int
    forks: int
    languages: dict[str, int]
    is_monorepo: bool
    status: str
    session_id: uuid.UUID
    job_id: uuid.UUID

    model_config = {"from_attributes": True}


# ── Architecture Graph Schemas (matches frontend ArchNode/ArchEdge types) ─

class ArchNode(BaseModel):
    """
    A node in the architecture graph.
    x, y are percentages (0.0–100.0) of the canvas dimensions.
    complexity and coupling are normalised 0.0–1.0 scores.
    """
    id: str
    x: float
    y: float
    label: str
    path: str
    desc: str
    complexity: float = 0.0   # Cyclomatic complexity, normalised
    coupling: float = 0.0     # Import coupling, normalised
    is_entry: bool = False
    language: str = ""
    line_count: int = 0


class ArchEdge(BaseModel):
    """A directed dependency edge: source imports target."""
    source: str
    target: str


class GraphMeta(BaseModel):
    """Metadata returned alongside the graph."""
    total_files: int
    total_nodes: int
    total_edges: int
    languages: dict[str, int]
    is_monorepo: bool
    commit_sha: str | None


class GraphData(BaseModel):
    """
    Full graph payload returned by GET /api/v1/sessions/{id}/graph.
    This is the exact shape the frontend ArchitectureGraph component renders.
    """
    nodes: list[ArchNode]
    edges: list[list[str]]   # [[source_id, target_id], ...]
    meta: GraphMeta


# ── File Tree Schemas (Left Panel — FILES tab) ──────────────────────────

class FileNode(BaseModel):
    """A node in the file tree sidebar."""
    path: str
    name: str
    is_dir: bool
    depth: int
    language: str | None = None
    line_count: int | None = None
    size_bytes: int | None = None


class ModuleInfo(BaseModel):
    """A logical module grouping (MODULES tab)."""
    name: str
    file_count: int
    files: list[str]


class FilesResponse(BaseModel):
    """Response for GET /api/v1/sessions/{id}/files."""
    tree: list[FileNode]
    modules: list[ModuleInfo]
    entry_points: list[str]
