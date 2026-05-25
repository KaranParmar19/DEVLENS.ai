"""
DevLens AI — Test Suite: Shared Fixtures and Configuration

All tests use pytest-asyncio with asyncio_mode = "auto".
The async test DB runs against a real PostgreSQL instance
(spun up by docker-compose test profile).

Fixtures:
    db_session      — Async DB session scoped to each test (rolls back after)
    mock_github     — httpx mock for GitHub API calls
    vector_store    — VectorStore connected to test DB
    sample_repo     — A Repository model saved to the test DB
    sample_session  — A Session linked to sample_repo
"""

import asyncio
import uuid
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

# Use SQLite for unit tests (no Docker needed), PostgreSQL for integration tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop scoped to the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """Create the test DB engine once per session."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )

    # Create all tables
    from app.models import Base  # noqa: F401 — triggers model registration
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    """
    Provide a test DB session that rolls back after each test.
    This ensures test isolation without needing to truncate tables.
    """
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with session_factory() as session:
        async with session.begin():
            yield session
            await session.rollback()


@pytest.fixture
def mock_github():
    """
    Mock the GitHubClient with realistic API response shapes.
    Returns an AsyncMock with pre-configured return values.
    """
    client = AsyncMock()

    client.get_repo_metadata.return_value = {
        "full_name": "octocat/hello-world",
        "description": "A test repository",
        "stargazers_count": 42,
        "default_branch": "main",
        "size": 512,  # KB
        "private": False,
        "sha": "abc123def456",
    }

    client.get_file_tree.return_value = [
        {"path": "src/main.py", "type": "blob", "size": 1024},
        {"path": "src/utils.py", "type": "blob", "size": 512},
        {"path": "tests/test_main.py", "type": "blob", "size": 256},
        {"path": "README.md", "type": "blob", "size": 128},
        {"path": ".gitignore", "type": "blob", "size": 64},
    ]

    client.get_file_content.return_value = (
        "def hello():\n"
        "    '''Say hello.'''\n"
        "    return 'Hello, world!'\n"
        "\n"
        "if __name__ == '__main__':\n"
        "    print(hello())\n"
    )

    return client


@pytest.fixture
def mock_openai():
    """Mock the OpenAI embeddings API to return dummy vectors."""
    with patch("app.core.embedder.AsyncOpenAI") as mock_cls:
        client = AsyncMock()
        # text-embedding-3-small returns 1536-dim vectors
        dummy_embedding = [0.1] * 1536
        client.embeddings.create.return_value = MagicMock(
            data=[MagicMock(embedding=dummy_embedding)]
        )
        mock_cls.return_value = client
        yield client


@pytest_asyncio.fixture
async def sample_repo(db_session):
    """Create a saved Repository model for use in tests."""
    from app.models.repository import Repository, RepoStatus

    repo = Repository(
        id=uuid.uuid4(),
        owner="octocat",
        name="hello-world",
        full_name="octocat/hello-world",
        url="https://github.com/octocat/hello-world",
        description="A test repo",
        default_branch="main",
        commit_sha="abc123",
        status=RepoStatus.COMPLETED,
        languages={"Python": 5},
        graph_data={
            "nodes": [
                {"id": "src/main.py", "x": 30.0, "y": 50.0, "label": "main",
                 "path": "src/main.py", "desc": "Entry point"},
                {"id": "src/utils.py", "x": 70.0, "y": 50.0, "label": "utils",
                 "path": "src/utils.py", "desc": "Utility functions"},
            ],
            "edges": [["src/main.py", "src/utils.py"]],
            "meta": {"total_files": 5, "total_nodes": 2},
        },
    )
    db_session.add(repo)
    await db_session.flush()
    return repo


@pytest_asyncio.fixture
async def sample_session(db_session, sample_repo):
    """Create a saved Session linked to sample_repo."""
    from app.models.session import Session

    session = Session(
        id=uuid.uuid4(),
        repo_id=sample_repo.id,
        chat_history=[],
    )
    db_session.add(session)
    await db_session.flush()
    return session
