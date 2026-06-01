"""
DevLens AI — Repositories API Route
POST /api/v1/repos/analyze — submit a GitHub repo URL for analysis.
GET  /api/v1/repos/{id}   — get repo metadata.

BUG-12 FIX: branch always updated from submitted payload; DB upsert uses
            ON CONFLICT DO NOTHING pattern to prevent duplicate repo rows.
M-03  FIX:  Concurrent POSTs for the same URL handled gracefully.
"""

import uuid
from kombu.exceptions import OperationalError as KombuOperationalError
import structlog
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.api.deps import get_db, require_api_key, get_current_user
from app.models.repository import Repository, RepoStatus
from app.models.analysis_job import AnalysisJob, JobStatus
from app.models.session import Session
from app.models.user import User
from app.schemas.repository import AnalyzeRequest, RepoResponse
from app.core.github_client import parse_github_url, GitHubClient
from httpx import HTTPStatusError
from app.tasks.celery_app import celery_app

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
    Frontend connects to WS /ws/jobs/{job_id} for real-time progress.

    M-03 FIX: Uses PostgreSQL INSERT ... ON CONFLICT to safely handle
    concurrent duplicate submissions without raising IntegrityError.
    BUG-12 FIX: branch updated from payload to ensure we don't reuse
    a stale cached branch value.
    """
    owner, name = parse_github_url(payload.repo_url)
    full_name = f"{owner}/{name}"

    # PRE-FLIGHT CHECK: verify repo is valid and user has access before creating DB records
    user_token = current_user.github_access_token if current_user else None
    try:
        async with GitHubClient(user_token=user_token) as gh:
            meta = await gh.get_repo_meta(owner, name)
            if meta.is_private and not user_token:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This repository is private. Please connect your GitHub account to analyze it."
                )
    except HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found or you do not have access to it."
            )
        if exc.response.status_code == 403:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="GitHub API rate limit exceeded. Please connect your GitHub account to continue."
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch repository metadata from GitHub."
        )

    # M-03 FIX: Upsert with ON CONFLICT DO NOTHING — then fetch the row.
    # This is atomic and safe under concurrent requests.
    # BUG FIX: Use the canonical name from GitHub to prevent duplicate rows for the same repo
    canonical_owner = meta.owner
    canonical_name = meta.name
    canonical_full_name = meta.full_name

    await db.execute(
        pg_insert(Repository)
        .values(
            owner=canonical_owner,
            name=canonical_name,
            full_name=canonical_full_name,
            url=payload.repo_url,
            status=RepoStatus.PENDING,
            default_branch=payload.branch or "main",
        )
        .on_conflict_do_nothing(index_elements=["full_name"])
    )
    await db.flush()

    result = await db.execute(
        select(Repository).where(Repository.full_name == canonical_full_name)
    )
    repo = result.scalar_one()

    # BUG-12 FIX: Always refresh branch from payload (if supplied) so we
    # don't silently re-use a stale branch from a previous ingestion.
    if payload.branch and payload.branch != "main":
        repo.default_branch = payload.branch
        await db.flush()

    # Create a session for this analysis run
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

    # Set repo status to INDEXING
    repo.status = RepoStatus.INDEXING

    await db.commit()
    await db.refresh(repo)
    await db.refresh(job)
    await db.refresh(session)

    # Enqueue via celery_app.send_task() — NOT ingest_repository.apply_async().
    # @shared_task in repo_tasks.py binds to Celery's global default app in
    # the API server process (which has no current app set), causing it to
    # fall back to amqp://localhost instead of our Redis broker.
    # send_task() on our explicit celery_app instance always uses Redis.
    try:
        celery_task = celery_app.send_task(
            "app.tasks.repo_tasks.ingest_repository",
            kwargs={
                "job_id": str(job.id),
                "repo_id": str(repo.id),
                "session_id": str(session.id),
                "repo_url": payload.repo_url,
                "branch": payload.branch or repo.default_branch,
                "user_github_token": (
                    current_user.github_access_token if current_user else None
                ),
            },
            queue="ingestion",
        )
    except (KombuOperationalError, OSError) as exc:
        logger.error(
            "celery_broker_unavailable",
            error=str(exc),
            job_id=str(job.id),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Analysis job could not be queued — message broker is temporarily "
                "unavailable. Please try again in a few seconds."
            ),
        ) from exc

    # Persist the Celery task ID so we can inspect/revoke it later
    job.celery_task_id = celery_task.id
    await db.commit()

    logger.info(
        "repo_analysis_queued",
        full_name=full_name,
        job_id=str(job.id),
        session_id=str(session.id),
        branch=payload.branch,
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

    # Fetch the most recent session for this repo
    sess_result = await db.execute(
        select(Session)
        .where(Session.repo_id == repo_id)
        .order_by(Session.created_at.desc())
        .limit(1)
    )
    latest_session = sess_result.scalar_one_or_none()
    session_id = latest_session.id if latest_session else uuid.uuid4()

    job_result = await db.execute(
        select(AnalysisJob)
        .where(AnalysisJob.repo_id == repo_id)
        .order_by(AnalysisJob.created_at.desc())
        .limit(1)
    )
    latest_job = job_result.scalar_one_or_none()
    job_id = latest_job.id if latest_job else uuid.uuid4()

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
        session_id=session_id,
        job_id=job_id,
    )
