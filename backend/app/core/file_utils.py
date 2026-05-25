"""
DevLens AI — File Utility Functions
Binary detection, file filtering (ignore patterns), size limits,
and path-based utilities used throughout the ingestion pipeline.
"""

import os
import re
from pathlib import Path

from app.config import get_settings

settings = get_settings()

# ── Directories to always skip ────────────────────────────────────────────
IGNORED_DIRECTORIES: frozenset[str] = frozenset({
    ".git", ".github", ".svn", ".hg",
    "node_modules", "vendor", "bower_components",
    "__pycache__", ".pytest_cache", ".mypy_cache",
    "venv", ".venv", "env", ".env",
    "dist", "build", "out", ".next", ".nuxt",
    "coverage", ".coverage", "htmlcov",
    ".idea", ".vscode",
    "migrations",  # Keep alembic env.py but skip generated versions
})

# ── File extensions to always skip (binary / generated / irrelevant) ──────
IGNORED_EXTENSIONS: frozenset[str] = frozenset({
    # Binary
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
    ".mp4", ".mp3", ".wav", ".avi", ".mov", ".pdf",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".exe", ".dll", ".so", ".dylib", ".a", ".lib",
    ".wasm", ".bin", ".dat",
    # Fonts
    ".ttf", ".otf", ".woff", ".woff2", ".eot",
    # Lock files (huge, low value)
    # ".lock" — excluded by filename check below
    # Generated / minified
    ".min.js", ".min.css", ".map",
    # Other
    ".pyc", ".pyo", ".class",
    ".DS_Store",
})

# ── Specific filenames to skip ─────────────────────────────────────────────
IGNORED_FILENAMES: frozenset[str] = frozenset({
    "package-lock.json", "yarn.lock", "bun.lock", "pnpm-lock.yaml",
    "poetry.lock", "Pipfile.lock", "composer.lock",
    "Cargo.lock",
    ".DS_Store", "Thumbs.db",
})


def should_include_file(path: str, size_bytes: int) -> tuple[bool, str]:
    """
    Decide whether a file should be ingested.
    Returns (include: bool, reason: str).

    Checks (in order):
    1. File is too large
    2. Filename is in ignore list
    3. Extension is in ignore list
    4. Any path component is an ignored directory
    5. Binary content sniff (handled separately after fetch)
    """
    # Size check
    max_bytes = settings.max_file_size_kb * 1024
    if size_bytes > max_bytes:
        return False, f"file too large ({size_bytes // 1024}KB > {settings.max_file_size_kb}KB)"

    parts = Path(path).parts
    filename = parts[-1]

    # Filename blocklist
    if filename in IGNORED_FILENAMES:
        return False, f"ignored filename: {filename}"

    # Extension blocklist — check compound extensions first (.min.js)
    for ext in IGNORED_EXTENSIONS:
        if filename.endswith(ext):
            return False, f"ignored extension: {ext}"

    # Directory component check
    for part in parts[:-1]:
        if part in IGNORED_DIRECTORIES:
            return False, f"ignored directory: {part}"

    return True, "ok"


def is_binary_content(content: str) -> bool:
    """
    Heuristic check: if >5% of characters in the first 1KB are non-printable,
    treat as binary and skip. Prevents indexing compiled or encoded files.
    """
    sample = content[:1024]
    if not sample:
        return False
    non_printable = sum(
        1 for ch in sample if ord(ch) < 32 and ch not in "\n\r\t"
    )
    return non_printable / len(sample) > 0.05


def filter_file_tree(
    tree: list[dict],
) -> tuple[list[str], dict[str, str]]:
    """
    Filter a GitHub git tree (list of {path, size, type}) to only
    the files that should be ingested.

    Returns:
        allowed_paths: list of file paths to fetch
        skip_reasons: dict of {path: reason} for skipped files (for logging)
    """
    allowed: list[str] = []
    skipped: dict[str, str] = {}

    for item in tree:
        if item.get("type") != "blob":
            continue
        path = item["path"]
        size = item.get("size", 0)
        include, reason = should_include_file(path, size)
        if include:
            allowed.append(path)
        else:
            skipped[path] = reason

    return allowed, skipped


def get_file_extension(path: str) -> str:
    """Return lowercase file extension including the dot, e.g. '.py'"""
    return Path(path).suffix.lower()


def truncate_content(content: str, max_chars: int = 50_000) -> str:
    """
    Truncate very long file content to avoid exceeding token budgets.
    Adds a notice comment at the end so the LLM knows it's truncated.
    """
    if len(content) <= max_chars:
        return content
    return content[:max_chars] + "\n\n# [DevLens: file truncated for token budget]"
