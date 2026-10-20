"""
DevLens AI — Tests for Copilot Agent Tools and Grounded AST Engine
"""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.agent.tools.blast_tool import make_blast_tool
from app.agent.tools.graph_tool import make_graph_tool
from app.agent.tools.file_tool import make_file_tool
from app.agent.tools.search_tool import make_search_tool
from app.agent.devlens_agent import DevLensAgent


@pytest.fixture
def sample_graph_cache():
    return {
        "nodes": [
            {"id": "src/app.py", "label": "app", "path": "src/app.py", "desc": "Entry", "complexity": 2.0, "coupling": 0.5, "is_entry": True},
            {"id": "src/routes.py", "label": "routes", "path": "src/routes.py", "desc": "Routes", "complexity": 3.0, "coupling": 0.3, "is_entry": False},
            {"id": "src/db.py", "label": "db", "path": "src/db.py", "desc": "Database", "complexity": 1.5, "coupling": 0.2, "is_entry": False},
        ],
        "edges": [
            ["src/app.py", "src/routes.py"],
            ["src/routes.py", "src/db.py"],
        ],
        "meta": {
            "cycles": [],
            "total_nodes": 3,
            "total_edges": 2,
        },
    }


def test_blast_tool_detects_dependents(sample_graph_cache):
    tool = make_blast_tool(sample_graph_cache)
    # src/routes.py is imported by src/app.py
    res = tool.func("src/routes.py")
    assert "src/app.py" in res
    assert "affected" in res.lower()


def test_blast_tool_handles_missing_file(sample_graph_cache):
    tool = make_blast_tool(sample_graph_cache)
    res = tool.func("nonexistent.py")
    assert "not found" in res.lower()


def test_graph_tool_shows_imports_and_dependents(sample_graph_cache):
    tool = make_graph_tool(sample_graph_cache)
    res = tool.func("src/routes.py")
    assert "src/db.py" in res       # imports
    assert "src/app.py" in res      # imported by


@pytest.mark.asyncio
async def test_file_tool_stitches_chunks():
    mock_vector_store = MagicMock()
    mock_vector_store.get_chunks_by_file = AsyncMock(return_value=[
        {"content": "def hello(): pass", "file_path": "test.py", "language": "Python", "start_line": 1, "end_line": 2, "chunk_type": "function"},
    ])

    tool = make_file_tool(mock_vector_store)
    res = await tool.coroutine("test.py")
    assert "test.py" in res
    assert "def hello" in res


@pytest.mark.asyncio
async def test_search_tool_formats_citations():
    mock_vector_store = MagicMock()
    mock_vector_store.similarity_search = AsyncMock(return_value=[
        {
            "content": "class App: pass",
            "file_path": "app.py",
            "language": "Python",
            "start_line": 5,
            "end_line": 10,
            "symbol_name": "App",
            "similarity": 0.95,
        }
    ])

    tool = make_search_tool(mock_vector_store)
    res = await tool.coroutine("App")
    assert "[[app.py]]" in res
    assert "lines 5-10" in res


def test_deterministic_fallback_generation(sample_graph_cache):
    mock_db = MagicMock()
    agent = DevLensAgent(
        db=mock_db,
        repo_id=uuid.uuid4(),
        repo_full_name="org/test-repo",
        graph_cache=sample_graph_cache,
    )

    fallback = agent._generate_deterministic_fallback(
        query="What is the blast radius?",
        context_text="### Blast Radius:\nHigh risk",
        sources=["src/routes.py"],
    )
    assert "org/test-repo" in fallback
    assert "AST Index" in fallback
    assert "High risk" in fallback
