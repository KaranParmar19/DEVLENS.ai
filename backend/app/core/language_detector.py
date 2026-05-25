"""
DevLens AI — Language Detector & Monorepo Detector
Maps file extensions to canonical language names.
Detects monorepo structure (turbo, nx, lerna, workspaces).
"""

from pathlib import Path

# ── Extension → Language Map ─────────────────────────────────────────────
EXTENSION_TO_LANGUAGE: dict[str, str] = {
    # Python
    ".py": "Python", ".pyi": "Python",
    # JavaScript / TypeScript
    ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript", ".mts": "TypeScript",
    ".tsx": "TypeScript",
    # Web
    ".html": "HTML", ".htm": "HTML",
    ".css": "CSS", ".scss": "CSS", ".sass": "CSS", ".less": "CSS",
    # Go
    ".go": "Go",
    # Rust
    ".rs": "Rust",
    # Java / Kotlin
    ".java": "Java", ".kt": "Kotlin", ".kts": "Kotlin",
    # C / C++
    ".c": "C", ".h": "C",
    ".cpp": "C++", ".cc": "C++", ".cxx": "C++", ".hpp": "C++",
    # C#
    ".cs": "C#",
    # Ruby
    ".rb": "Ruby", ".rake": "Ruby",
    # PHP
    ".php": "PHP",
    # Swift
    ".swift": "Swift",
    # Shell
    ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell", ".fish": "Shell",
    # Data / Config
    ".json": "JSON",
    ".yaml": "YAML", ".yml": "YAML",
    ".toml": "TOML",
    ".xml": "XML",
    ".sql": "SQL",
    ".graphql": "GraphQL", ".gql": "GraphQL",
    ".proto": "Protobuf",
    # Docs
    ".md": "Markdown", ".mdx": "Markdown",
    ".rst": "reStructuredText",
    ".txt": "Text",
    # Docker / CI
    "Dockerfile": "Docker",
    ".dockerfile": "Docker",
    # Terraform / Infra
    ".tf": "Terraform", ".tfvars": "Terraform",
}

# Languages where we can do AST-aware chunking
AST_SUPPORTED_LANGUAGES: frozenset[str] = frozenset({
    "Python", "JavaScript", "TypeScript",
})

# Files indicating monorepo presence
MONOREPO_INDICATORS: frozenset[str] = frozenset({
    "turbo.json", "nx.json", "lerna.json", "pnpm-workspace.yaml",
    "rush.json",
})


def detect_language(path: str) -> str:
    """
    Map a file path to a language name.
    Checks full filename first (e.g. 'Dockerfile'), then extension.
    Returns 'Unknown' if no match.
    """
    filename = Path(path).name
    # Check full filename (e.g. Dockerfile has no extension)
    if filename in EXTENSION_TO_LANGUAGE:
        return EXTENSION_TO_LANGUAGE[filename]
    # Check extension
    ext = Path(path).suffix.lower()
    return EXTENSION_TO_LANGUAGE.get(ext, "Unknown")


def is_ast_supported(language: str) -> bool:
    """Returns True if we can do AST-aware chunking for this language."""
    return language in AST_SUPPORTED_LANGUAGES


def detect_monorepo(file_paths: list[str]) -> bool:
    """
    Detect if the repo is a monorepo by checking for known indicator files
    at the root level, or presence of multiple package.json files.
    """
    filenames_at_root = {
        p for p in file_paths if "/" not in p
    }

    # Known monorepo config files
    if filenames_at_root & MONOREPO_INDICATORS:
        return True

    # Multiple package.json files at different levels = monorepo
    package_jsons = [p for p in file_paths if p.endswith("package.json")]
    if len(package_jsons) > 2:
        return True

    # packages/ or apps/ directory at root level
    root_dirs = {p.split("/")[0] for p in file_paths if "/" in p}
    if "packages" in root_dirs or "apps" in root_dirs:
        return True

    return False


def detect_entry_points(file_paths: list[str], languages: dict[str, int]) -> list[str]:
    """
    Heuristically identify likely entry points (main files, index files, etc.)
    based on filename patterns and language.
    """
    entry_patterns = [
        "main.py", "app.py", "run.py", "manage.py", "wsgi.py", "asgi.py",
        "index.ts", "index.tsx", "index.js", "index.jsx",
        "main.ts", "main.go", "main.rs",
        "server.ts", "server.js", "server.py",
        "app.ts", "app.js",
        "cli.py", "cli.ts",
    ]

    entries = []
    for path in file_paths:
        filename = Path(path).name
        if filename in entry_patterns:
            entries.append(path)

    return entries[:10]  # Cap at 10 entry points
