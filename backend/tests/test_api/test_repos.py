"""
DevLens AI — API Tests: Repository Routes

Tests for:
    POST /api/v1/repos/analyze
    GET  /api/v1/repos/{repo_id}
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.config import get_settings

settings = get_settings()


@pytest.mark.asyncio
async def test_health_endpoint():
    """Health endpoint should return 200 with service statuses."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "services" in data
    assert "postgres" in data["services"]
    assert "redis" in data["services"]


@pytest.mark.asyncio
async def test_analyze_missing_body():
    """POST /repos/analyze without body should return 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/repos/analyze",
            json={},
            headers={"X-API-Key": settings.api_key},
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_analyze_invalid_url():
    """Submitting a non-GitHub URL should return 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/repos/analyze",
            json={"repo_url": "https://gitlab.com/user/repo"},
            headers={"X-API-Key": settings.api_key},
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_nonexistent_repo():
    """GET /repos/{bad_id} should return 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            f"/api/v1/repos/{uuid.uuid4()}",
            headers={"X-API-Key": settings.api_key},
        )
    assert response.status_code == 404
