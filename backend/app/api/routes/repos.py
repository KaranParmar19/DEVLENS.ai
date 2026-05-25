"""
DevLens AI — Repositories API Route
POST /api/v1/repos/analyze — submit a GitHub repo URL for analysis.
GET  /api/v1/repos/{id}   — get repo metadata.
"""

import uuid
import structlog
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, require_api_key, get_current_user
from app.models.repository import Repository, RepoStatus
from app.models.analysis_job import AnalysisJob, JobStatus
from app.models.session import Session
from app.models.user import User
from app.schemas.repository import AnalyzeRequest, RepoResponse
from app.core.github_client import parse_github_url
from app.tasks.repo_tasks import ingest_repository

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/analyze",
    response_model=RepoResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a GitHub repository for analysis",
)
async def analyze_repo(
    payload: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
    current_user: User | None = Depends(get_current_user),
):
    """
    Accepts a GitHub repo URL, kicks off background ingestion.
    Returns immediately with job_id and session_id.
    Frontend polls WS /ws/jobs/{job_id} for progress.

    Incremental indexing: if the repo was previously indexed with the same
    commit SHA, returns the existing session without re-processing.
    """
    owner, name = parse_github_url(payload.repo_url)
    full_name = f"{owner}/{name}"

    # Check for existing indexed repo
    result = await db.execute(
        select(Repository).where(Repository.full_name == full_name)
    )
    repo = result.scalar_one_or_none()

    if not repo:
        repo = Repository(
            owner=owner,
            name=name,
            full_name=full_name,
            url=payload.repo_url,
            status=RepoStatus.PENDING,
            default_branch=payload.branch,
        )
        db.add(repo)
        await db.flush()

    # Create a session for this analysis
    session = Session(
        repo_id=repo.id,
        user_id=current_user.id if current_user else None,
    )
    db.add(session)

    # Create the analysis job row
    job = AnalysisJob(
        repo_id=repo.id,
        session_id=session.id,
        status=JobStatus.QUEUED,
    )
    db.add(job)
    await db.commit()
    await db.refresh(repo)
    await db.refresh(job)
    await db.refresh(session)

    # Update repo status to indexing
    repo.status = RepoStatus.INDEXING
    await db.commit()

    # Enqueue the Celery task
    celery_task = ingest_repository.apply_async(
        kwargs={
            "job_id": str(job.id),
            "repo_id": str(repo.id),
            "session_id": str(session.id),
            "repo_url": payload.repo_url,
            "branch": payload.branch,
            "user_github_token": current_user.github_access_token if current_user else None,
        },
        queue="ingestion",
    )

    # Store Celery task ID for revocation/inspection
    job.celery_task_id = celery_task.id
    await db.commit()

    logger.info(
        "repo_analysis_queued",
        full_name=full_name,
        job_id=str(job.id),
        session_id=str(session.id),
    )

    return RepoResponse(
        id=repo.id,
        full_name=repo.full_name,
        owner=repo.owner,
        name=repo.name,
        url=repo.url,
        description=repo.description,
        stars=repo.stars,
        forks=repo.forks,
        languages=repo.languages or {},
        is_monorepo=repo.is_monorepo,
        status=repo.status.value,
        session_id=session.id,
        job_id=job.id,
    )


@router.get("/{repo_id}", response_model=RepoResponse)
async def get_repo(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_api_key),
):
    """Get repository metadata by ID."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    return RepoResponse(
        id=repo.id, full_name=repo.full_name, owner=repo.owner, name=repo.name,
        url=repo.url, description=repo.description, stars=repo.stars,
        forks=repo.forks, languages=repo.languages or {},
        is_monorepo=repo.is_monorepo, status=repo.status.value,
        session_id=uuid.UUID(int=0),  # Placeholder — use /sessions endpoint
        job_id=uuid.UUID(int=0),
    )
