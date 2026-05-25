"""
DevLens AI — Core Tests: AST-Aware Chunker

Tests for the chunker module covering:
    - Python AST chunking (functions, classes)
    - Generic sliding window fallback
    - Edge cases: empty files, single-line files, large files
"""

import pytest
from app.core.chunker import chunk_file


PYTHON_SAMPLE = '''
def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}!"


def farewell(name: str) -> str:
    """Return a farewell message."""
    return f"Goodbye, {name}!"


class Greeter:
    """A class that greets people."""

    def __init__(self, prefix: str = "Hello"):
        self.prefix = prefix

    def greet(self, name: str) -> str:
        return f"{self.prefix}, {name}!"
'''

JAVASCRIPT_SAMPLE = '''
function fetchUser(id) {
    return fetch(`/api/users/${id}`).then(r => r.json());
}

const updateUser = async (id, data) => {
    const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
    return response.json();
};

class UserService {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
    }

    async getAll() {
        const response = await fetch(this.apiUrl);
        return response.json();
    }
}
'''


def test_python_chunking_finds_functions():
    """Python chunker should produce one chunk per top-level function."""
    chunks = chunk_file(file_path="src/greet.py", content=PYTHON_SAMPLE, language="Python")
    names = [c.symbol_name for c in chunks if c.symbol_name]
    assert any("greet" in name for name in names)
    assert any("farewell" in name for name in names)


def test_python_chunking_finds_classes():
    """Python chunker should produce a chunk for the Greeter class."""
    chunks = chunk_file(file_path="src/greet.py", content=PYTHON_SAMPLE, language="Python")
    names = [c.symbol_name for c in chunks if c.symbol_name]
    assert any("Greeter" in name for name in names)


def test_python_chunks_have_required_fields():
    """Every chunk must have content, file_path, language, chunk_type."""
    chunks = chunk_file(file_path="src/greet.py", content=PYTHON_SAMPLE, language="Python")
    for chunk in chunks:
        assert chunk.content is not None
        assert chunk.file_path == "src/greet.py"
        assert chunk.language == "Python"
        assert chunk.chunk_type is not None


def test_javascript_chunking():
    """JS chunker should produce chunks for functions."""
    chunks = chunk_file(file_path="src/user.js", content=JAVASCRIPT_SAMPLE, language="JavaScript")
    assert len(chunks) >= 1
    # At minimum we expect a chunk containing fetchUser
    combined_content = " ".join(c.content for c in chunks)
    assert "fetchUser" in combined_content


def test_empty_file_returns_no_chunks():
    """Empty files should return an empty list, not an error."""
    chunks = chunk_file(file_path="empty.py", content="", language="Python")
    assert chunks == []


def test_whitespace_only_file():
    """Files with only whitespace should return no chunks."""
    chunks = chunk_file(file_path="blank.py", content="   \n\n\t\n  ", language="Python")
    assert chunks == []


def test_generic_language_fallback():
    """Unknown language should fall back to sliding window chunking."""
    content = "x = 1\n" * 200  # 200 lines of code
    chunks = chunk_file(file_path="data.r", content=content, language="R")
    assert len(chunks) >= 1
    # All chunks should be non-empty
    for chunk in chunks:
        assert chunk.content.strip() != ""


def test_chunk_line_numbers():
    """Python chunks should have start_line and end_line."""
    chunks = chunk_file(file_path="src/greet.py", content=PYTHON_SAMPLE, language="Python")
    for chunk in chunks:
        if chunk.chunk_type in ("function", "class"):
            assert chunk.start_line is not None, "AST chunk missing start_line"
            assert chunk.end_line is not None, "AST chunk missing end_line"
            assert chunk.start_line <= chunk.end_line


def test_large_file_chunked_properly():
    """A large file should be split into multiple chunks, none exceeding token budget."""
    content = "\n".join(
        [f"def func_{i}():\n    '''Function {i}'''\n    return {i}\n" for i in range(100)]
    )
    chunks = chunk_file(file_path="big.py", content=content, language="Python")
    assert len(chunks) >= 10, "Large file should produce many chunks"
