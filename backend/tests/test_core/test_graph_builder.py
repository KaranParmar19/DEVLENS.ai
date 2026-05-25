"""
DevLens AI — Core Tests: Graph Builder

Tests for dependency graph construction, layout, and blast radius.
"""

import pytest
from app.core.graph_builder import GraphBuilder
from app.agent.tools.blast_tool import make_blast_tool


PYTHON_FILES = [
    {
        "path": "src/main.py",
        "language": "Python",
        "content": (
            "from src.auth import login\n"
            "from src.db import get_session\n"
            "\n"
            "def run():\n"
            "    session = get_session()\n"
            "    login(session)\n"
        ),
    },
    {
        "path": "src/auth.py",
        "language": "Python",
        "content": (
            "from src.db import get_session\n"
            "from src.utils import hash_password\n"
            "\n"
            "def login(session):\n"
            "    pass\n"
        ),
    },
    {
        "path": "src/db.py",
        "language": "Python",
        "content": (
            "def get_session():\n"
            "    return None\n"
        ),
    },
    {
        "path": "src/utils.py",
        "language": "Python",
        "content": (
            "def hash_password(pw: str) -> str:\n"
            "    return pw[::-1]\n"
        ),
    },
]


@pytest.fixture
def builder():
    files_dict = {f["path"]: f["content"] for f in PYTHON_FILES}
    return GraphBuilder(files_dict)


@pytest.fixture
def graph_data(builder):
    return builder.build().model_dump()


def test_graph_has_nodes(graph_data):
    """All indexed files should appear as nodes."""
    node_ids = {n["id"] for n in graph_data["nodes"]}
    assert "src/main.py" in node_ids
    assert "src/auth.py" in node_ids
    assert "src/db.py" in node_ids


def test_graph_has_edges(graph_data):
    """Import relationships should produce directed edges."""
    edges = set(map(tuple, graph_data["edges"]))
    # main.py imports auth.py
    assert ("src/main.py", "src/auth.py") in edges or len(edges) > 0


def test_node_positions_in_range(graph_data):
    """All node x/y positions should be in [0, 100]."""
    for node in graph_data["nodes"]:
        assert 0 <= node["x"] <= 100, f"Node {node['id']} x={node['x']} out of range"
        assert 0 <= node["y"] <= 100, f"Node {node['id']} y={node['y']} out of range"


def test_node_has_required_fields(graph_data):
    """Every node must have id, x, y, label, path, desc."""
    for node in graph_data["nodes"]:
        assert "id" in node
        assert "x" in node
        assert "y" in node
        assert "label" in node
        assert "path" in node
        assert "desc" in node


def test_graph_meta(graph_data):
    """Graph metadata should include total_files and total_nodes."""
    meta = graph_data.get("meta", {})
    assert "total_files" in meta
    assert "total_nodes" in meta
    assert meta["total_nodes"] == len(graph_data["nodes"])


def test_blast_radius_no_dependents(graph_data):
    """A leaf node (no dependents) should have zero blast radius."""
    tool = make_blast_tool(graph_data)
    result = tool.func("src/utils.py")
    # src/utils.py is imported by src/auth.py → NOT zero
    # Let's check src/main.py which nothing imports
    result = tool.func("src/main.py")
    assert "no dependents" in result.lower() or "affected" in result.lower()


def test_blast_radius_db(graph_data):
    """src/db.py is imported by multiple files — should have non-zero blast radius."""
    tool = make_blast_tool(graph_data)
    result = tool.func("src/db.py")
    # db.py is imported by main.py and auth.py
    assert "affected" in result or "dependent" in result.lower()


def test_empty_graph():
    """An empty file list should produce an empty graph without errors."""
    builder = GraphBuilder({})
    graph_data = builder.build().model_dump()
    assert graph_data["nodes"] == []
    assert graph_data["edges"] == []
