"""
DevLens AI - Facts Extractor
Computes ground truth repository facts directly from the graph topology
and indexed file chunks in PostgreSQL.

Every fact produced here traces strictly to:
1. The NetworkX/JSON graph cache (nodes, edges, cycles, dependents, dependencies).
2. Real file chunks stored in code_chunks (README, package.json, pyproject.toml, .env.example).

Never invents or guesses facts.
"""

import json
import re
import uuid
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class RiskThresholds:
    """
    Documented baseline thresholds for classifying module modification risk.
    Note: These thresholds are untuned heuristic baselines.
    """
    HIGH_DEPENDENTS_MIN: int = 5
    HIGH_COUPLING_MIN: float = 0.5
    HIGH_COMBINED_DEPS_MIN: int = 3
    MEDIUM_DEPENDENTS_MIN: int = 2
    MEDIUM_DEPENDENCIES_MIN: int = 8
    MEDIUM_COUPLING_MIN: float = 0.3


RISK_THRESHOLDS = RiskThresholds()


# Patterns identifying test suites and test fixtures
TEST_PATTERNS = (
    ".test.",
    ".spec.",
    "test_",
    "_test.",
    "/tests/",
    "/test/",
    "/__tests__/",
    "__tests__",
)

# Patterns identifying configuration and meta files
CONFIG_PATTERNS = (
    "config.",
    "tsconfig",
    "eslint",
    "prettier",
    "webpack",
    "rollup",
    "vite.config",
    "babel",
    "setup.cfg",
    "setup.py",
    "alembic.ini",
    "docker-compose",
    "dockerfile",
    "makefile",
    ".gitignore",
    ".env",
)

# Patterns identifying generated or compiled assets
GENERATED_PATTERNS = (
    ".generated.",
    ".min.",
    "schema.d.ts",
    ".pb.",
)


def is_test_file(path: str) -> bool:
    """Check if a file path is a test file, test helper, or in a test directory."""
    p = path.lower().replace("\\", "/")
    if p.startswith("tests/") or p.startswith("test/") or "/tests/" in p or "/test/" in p or "/__tests__/" in p:
        return True
    name = PurePosixPath(p).name
    if name in ("tools.py", "conftest.py", "setup_test.py", "helpers.py", "test_utils.py", "test_helper.py"):
        return True
    return any(pat in p for pat in TEST_PATTERNS)


def is_config_file(path: str) -> bool:
    """Check if a file path is configuration or tool setup."""
    p = path.lower().replace("\\", "/")
    name = PurePosixPath(p).name
    if name in ("package.json", "package-lock.json", "pyproject.toml", "cargo.toml", "go.mod", "go.sum"):
        return True
    return any(pat in p for pat in CONFIG_PATTERNS)


def is_generated_file(path: str) -> bool:
    """Check if a file path is generated code."""
    p = path.lower().replace("\\", "/")
    if p.startswith("dist/") or p.startswith("build/") or "/dist/" in p or "/build/" in p:
        return True
    return any(pat in p for pat in GENERATED_PATTERNS)


def join_chunks_without_overlap(chunks: list[str]) -> str:
    """
    Concatenate multi-chunk file contents, deduplicating the sliding-window
    token overlap produced by split_by_token_budget.
    Only removes an overlap of the exact length the chunker uses (OVERLAP_TOKENS * 4 = 256 or 200),
    verified by string equality. Symbol chunks and arbitrary repeated lines are never trimmed.
    """
    if not chunks:
        return ""
    if len(chunks) == 1:
        return chunks[0]

    # Valid exact overlap lengths produced by split_by_token_budget / _chunk_generic
    valid_exact_lengths = (256, 200)

    reconstructed = chunks[0]
    for next_chunk in chunks[1:]:
        trimmed = False
        for expected_len in valid_exact_lengths:
            if (
                len(reconstructed) >= expected_len
                and len(next_chunk) >= expected_len
                and reconstructed[-expected_len:] == next_chunk[:expected_len]
            ):
                reconstructed += next_chunk[expected_len:]
                trimmed = True
                break
        if not trimmed:
            reconstructed += next_chunk
    return reconstructed


def find_line_matching(content: str | None, pattern: str) -> int | None:
    """Find 1-based line number matching regex pattern in file content."""
    if not content:
        return None
    for idx, line in enumerate(content.splitlines(), start=1):
        if re.search(pattern, line):
            return idx
    return None


def find_makefile_target_line(content: str | None, target: str) -> int | None:
    """Find 1-based line number where a Makefile target is declared."""
    if not content:
        return None
    for idx, line in enumerate(content.splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith(f"{target}:") or stripped.startswith(f"{target} "):
            return idx
    return None


ENTRY_FILENAMES = frozenset({
    "server.ts",
    "server.js",
    "main.py",
    "app.py",
    "main.go",
    "index.ts",
    "index.js",
    "main.rs",
    "cli.py",
    "manage.py",
    "wsgi.py",
    "asgi.py",
    "mod.rs",
})


def classify_risk_level(
    dependents_count: int,
    dependencies_count: int,
    coupling: float,
    is_entry: bool,
    source_dependents_count: int = 0,
    test_dependents_count: int = 0,
    thresholds: RiskThresholds = RISK_THRESHOLDS,
) -> str:
    """
    Classify file risk level.
    Rules follow explicit, documented criteria:
    - Files with 0 source dependents but active test dependents: "Core file, imported by tests only".
    - Entry files with 0 dependents: "Low".
    - Files with >= HIGH_DEPENDENTS_MIN source dependents: "High".
    - Files with >= MEDIUM_DEPENDENTS_MIN source dependents or medium coupling: "Medium".
    - Otherwise: "Low".
    """
    # 0 source dependents, but active test dependents (e.g. single-file core module imported by tests)
    actual_test_deps = test_dependents_count if test_dependents_count > 0 else max(0, dependents_count - source_dependents_count)
    if source_dependents_count == 0 and actual_test_deps > 0:
        return "Core file, imported by tests only"

    # Standalone entry file with 0 callers
    if is_entry and source_dependents_count == 0 and dependents_count == 0:
        return "Low"

    # High blast radius based on source dependents and coupling
    if (
        (is_entry and source_dependents_count > 0)
        or source_dependents_count >= thresholds.HIGH_DEPENDENTS_MIN
        or (source_dependents_count >= thresholds.HIGH_COMBINED_DEPS_MIN and coupling >= thresholds.HIGH_COUPLING_MIN)
    ):
        return "High"

    if (
        is_entry
        or source_dependents_count >= thresholds.MEDIUM_DEPENDENTS_MIN
        or dependencies_count >= thresholds.MEDIUM_DEPENDENCIES_MIN
        or coupling >= thresholds.MEDIUM_COUPLING_MIN
    ):
        return "Medium"

    return "Low"


# Grouping is based strictly on key name words (prefixes/keywords), not on file contents or model inference.
def categorize_env_key(key: str) -> str:
    """Group environment variables strictly by key name words and keywords."""
    k_upper = key.upper()
    if any(w in k_upper for w in ("AUTH", "SECRET", "TOKEN", "JWT", "KEY", "PASSWORD", "PASS", "CERT", "SALT", "HASH", "PRIVATE", "SIGNING")):
        return "Authentication & Security"
    if any(w in k_upper for w in ("DB", "DATABASE", "POSTGRES", "PG", "MYSQL", "MONGO", "REDIS", "MEMCACHE", "SQL", "SUPABASE")):
        return "Database & Cache"
    if any(w in k_upper for w in ("API", "URL", "CLIENT", "ENDPOINT", "SERVICE", "GATEWAY", "HOST", "PORT", "DOMAIN", "BUCKET", "S3", "AWS", "STRIPE", "OPENAI", "GEMINI")):
        return "API & External Services"
    if any(w in k_upper for w in ("ENV", "MODE", "DEBUG", "LOG", "APP", "SITE", "BASE", "VERSION", "PUBLIC", "NEXT_PUBLIC", "VITE_")):
        return "Application & Runtime"
    return "Configuration"


class FactsExtractor:
    """
    Extracts and compiles deterministic facts from graph topology and Postgres chunks.
    """

    def __init__(
        self,
        db: AsyncSession,
        repo_id: uuid.UUID,
        repo_full_name: str,
        graph_cache: dict[str, Any] | None = None,
        commit_sha: str | None = None,
        indexed_at: str | None = None,
    ):
        self.db = db
        self.repo_id = repo_id
        self.repo_full_name = repo_full_name
        self.graph_cache = graph_cache or {}
        self.commit_sha = commit_sha
        self.indexed_at = indexed_at

    async def extract_file_content(self, target_filename: str) -> str | None:
        """
        Retrieve and assemble file content from CodeChunk table for a specific filename.
        Reconstructs multi-chunk files in index order.
        """
        from app.models.code_chunk import CodeChunk

        clean_target = target_filename.lower()
        stmt = (
            select(CodeChunk.file_path, CodeChunk.content, CodeChunk.chunk_index)
            .where(CodeChunk.repo_id == self.repo_id)
            .order_by(CodeChunk.chunk_index)
        )
        res = await self.db.execute(stmt)
        chunks = res.all()

        # Identify the single best target file path to avoid concatenating multiple distinct files
        best_path: str | None = None
        readme_targets = ("readme.rst", "readme.md", "readme.txt", "readme") if clean_target in ("readme", "readme.md", "readme.rst", "readme.txt") else (clean_target,)
        for target in readme_targets:
            for path, _, _ in chunks:
                p_lower = path.lower().replace("\\", "/")
                if p_lower == target:
                    best_path = path
                    break
                if p_lower.endswith("/" + target):
                    if best_path is None or len(path) < len(best_path):
                        best_path = path
            if best_path:
                break

        if not best_path:
            return None

        matching_chunks: list[str] = []
        seen_indices: set[int] = set()
        for path, content, idx in chunks:
            if path == best_path:
                if idx in seen_indices:
                    continue
                seen_indices.add(idx)
                # Strip generic chunk header if present
                clean_content = re.sub(r"^# File: [^\n]+\n\n", "", content)
                clean_content = re.sub(r"^// File: [^\n]+\n// [^\n]+\n\n", "", clean_content)
                matching_chunks.append(clean_content)

        if not matching_chunks:
            return None

        return join_chunks_without_overlap(matching_chunks)

    def compute_graph_metrics(self) -> dict[str, Any]:
        """
        Compute topology metrics, dependency maps, and risk classifications.
        """
        nodes = self.graph_cache.get("nodes", [])
        edges = self.graph_cache.get("edges", [])
        meta = self.graph_cache.get("meta", {})
        cycles = meta.get("cycles", [])

        dependents_map: dict[str, list[str]] = {}
        dependencies_map: dict[str, list[str]] = {}

        for edge in edges:
            if isinstance(edge, (list, tuple)) and len(edge) >= 2:
                src, tgt = str(edge[0]), str(edge[1])
                dependencies_map.setdefault(src, []).append(tgt)
                dependents_map.setdefault(tgt, []).append(src)

        file_metrics: dict[str, dict[str, Any]] = {}
        entry_points: list[dict[str, Any]] = []

        all_file_paths = [n.get("path") or n.get("id", "") for n in nodes]

        for n in nodes:
            node_id = str(n.get("id", ""))
            path = str(n.get("path") or node_id)
            is_entry = bool(n.get("is_entry"))
            coupling = float(n.get("coupling") or 0.0)
            line_count = int(n.get("line_count") or 0)
            complexity = int(n.get("complexity") or 0)

            # Detect entry point filenames and sanitize graph_builder artifacts (e.g. tests flagged as entry points)
            lower_path = path.lower().replace("\\", "/")
            file_name = PurePosixPath(lower_path).name
            if is_test_file(path) or is_config_file(path) or lower_path.startswith("docs/"):
                is_entry = False
            elif not is_entry:
                if file_name in ENTRY_FILENAMES or lower_path.startswith("cmd/"):
                    is_entry = True

            deps = dependents_map.get(node_id, [])
            source_deps = [d for d in deps if not is_test_file(d)]
            test_deps = [d for d in deps if is_test_file(d)]
            outgoing = dependencies_map.get(node_id, [])

            risk = classify_risk_level(
                dependents_count=len(deps),
                dependencies_count=len(outgoing),
                coupling=coupling,
                is_entry=is_entry,
                source_dependents_count=len(source_deps),
                test_dependents_count=len(test_deps),
            )

            metrics = {
                "id": node_id,
                "path": path,
                "label": n.get("label") or PurePosixPath(path).name,
                "is_entry": is_entry,
                "dependents": deps,
                "dependents_count": len(deps),
                "source_dependents": source_deps,
                "source_dependents_count": len(source_deps),
                "test_dependents": test_deps,
                "test_dependents_count": len(test_deps),
                "dependencies": outgoing,
                "dependencies_count": len(outgoing),
                "coupling": coupling,
                "line_count": line_count,
                "complexity": complexity,
                "risk_level": risk,
            }
            file_metrics[path] = metrics
            if is_entry:
                entry_points.append(metrics)

        # Candidate starter files selection
        # Exclude: tests, config, generated, dead files (0 dependents and 0 dependencies)
        # Low risk, line count > 0, prefer files with low complexity and nearby test
        candidate_starters: list[dict[str, Any]] = []

        # Categorize all modules and build language breakdown
        source_modules: list[str] = []
        test_modules: list[str] = []
        docs_and_assets: list[str] = []
        config_modules: list[str] = []
        language_breakdown: dict[str, int] = {}

        for path, m in file_metrics.items():
            node_match = next((n for n in nodes if (n.get("path") or n.get("id")) == path), {})
            lang = str(node_match.get("language") or "Unknown")
            language_breakdown[lang] = language_breakdown.get(lang, 0) + 1

            p_lower = path.lower().replace("\\", "/")
            if is_test_file(path):
                test_modules.append(path)
                continue
            if is_config_file(path):
                config_modules.append(path)
                continue
            if is_generated_file(path) or p_lower.startswith("docs/") or "/docs/" in p_lower:
                docs_and_assets.append(path)
                continue
            if PurePosixPath(p_lower).suffix in (".rst", ".pot", ".md", ".txt", ".yaml", ".yml"):
                docs_and_assets.append(path)
                continue

            source_modules.append(path)

            if m["is_entry"]:
                continue
            # Exclude test helpers or files in test directories
            if is_test_file(path) or any(part in ("test", "tests", "__tests__", "testing", "fixtures") for part in PurePosixPath(p_lower).parts):
                continue
            # Exclude 0-dependent non-entry files (must have active dependents in the codebase)
            if m["dependents_count"] == 0 or m["source_dependents_count"] == 0:
                continue
            # Starter tasks should have exactly 1 source dependent (safe Day 1 PR)
            if m["source_dependents_count"] != 1:
                continue
            if m["risk_level"] != "Low":
                continue

            # Check if there is a nearby test file
            base_name = PurePosixPath(path).stem
            nearby_test = next(
                (p for p in all_file_paths if is_test_file(p) and base_name in p),
                None,
            )

            candidate_starters.append({
                **m,
                "nearby_test": nearby_test,
                "first_30_lines": None,
            })

        # Pick starters by: has a test first, then fewest lines
        candidate_starters.sort(
            key=lambda c: (0 if c.get("nearby_test") else 1, c.get("line_count", 0))
        )

        starter_empty_reason = None
        if not candidate_starters:
            if len(source_modules) <= 1:
                single_name = source_modules[0] if source_modules else "the primary file"
                starter_empty_reason = (
                    f"No low-risk starter modules identified: implementation is concentrated in {single_name}, "
                    "which is directly imported across the test suite."
                )
            else:
                starter_empty_reason = (
                    "No low-risk starter modules identified: all core source modules have active dependents "
                    "or participate in central application flows."
                )

        return {
            "total_modules": len(nodes),
            "source_modules_count": len(source_modules),
            "test_modules_count": len(test_modules),
            "docs_and_assets_count": len(docs_and_assets),
            "config_modules_count": len(config_modules),
            "language_breakdown": language_breakdown,
            "total_edges": len(edges),
            "cycles": cycles,
            "cycles_count": len(cycles),
            "entry_points": entry_points,
            "file_metrics": file_metrics,
            "candidate_starters": candidate_starters[:5],
            "starter_empty_reason": starter_empty_reason,
            "dependents_map": dependents_map,
            "dependencies_map": dependencies_map,
        }

    async def extract_manifest_facts(self, test_modules_count: int | None = None) -> dict[str, Any]:
        """
        Extract facts from package.json, pyproject.toml, Makefile, go.mod, Cargo.toml, requirements.txt.
        Supports multi-manifest monorepos, lists install/run/test per folder.
        Separates runtime dependencies from dev dependencies.
        Labels test commands as declared or inferred.
        Guards test commands: when test_modules_count == 0, outputs 'no tests found'.
        """
        if test_modules_count is None:
            nodes = self.graph_cache.get("nodes", [])
            if nodes:
                test_modules_count = sum(
                    1 for n in nodes if is_test_file(n.get("path") or n.get("id", ""))
                )

        manifest_facts: dict[str, Any] = {
            "manifest_type": None,
            "project_name": None,
            "runtime_dependencies": [],
            "dev_dependencies": [],
            "tech_stack": [],
            "scripts": {},
            "install_command": None,
            "run_command": None,
            "test_command": None,
            "test_command_type": None,
            "dev_command": None,
            "build_command": None,
            "monorepo_packages": [],
        }

        # Check Makefile for declared targets
        makefile_content = await self.extract_file_content("Makefile")
        makefile_targets: set[str] = set()
        if makefile_content:
            for line in makefile_content.splitlines():
                if line.startswith((".PHONY:", "\t", " ")):
                    continue
                if ":" in line and not line.startswith("#"):
                    target = line.split(":")[0].strip()
                    if target and not target.startswith("$"):
                        makefile_targets.add(target)

        # 1. package.json
        pkg_content = await self.extract_file_content("package.json")
        if pkg_content:
            try:
                pkg_data = json.loads(pkg_content)
                manifest_facts["manifest_type"] = "package.json"
                manifest_facts["project_name"] = pkg_data.get("name")
                scripts = pkg_data.get("scripts", {})
                manifest_facts["scripts"] = scripts

                manifest_facts["install_command"] = "npm install"
                runtime_deps = list(pkg_data.get("dependencies", {}).keys())
                dev_deps = list(pkg_data.get("devDependencies", {}).keys())
                manifest_facts["runtime_dependencies"] = runtime_deps
                manifest_facts["dev_dependencies"] = dev_deps
                manifest_facts["tech_stack"] = runtime_deps

                if "test" in scripts:
                    test_line = find_line_matching(pkg_content, r'"test"\s*:')
                    manifest_facts["test_command"] = f"npm test (runs: {scripts['test']})"
                    manifest_facts["test_command_type"] = "declared (package.json scripts.test)"
                    manifest_facts["test_command_provenance"] = f"package.json:{test_line} (scripts.test)" if test_line else "package.json (scripts.test)"
                elif "test" in makefile_targets:
                    mk_line = find_makefile_target_line(makefile_content, "test")
                    manifest_facts["test_command"] = "make test"
                    manifest_facts["test_command_type"] = "declared (Makefile target)"
                    manifest_facts["test_command_provenance"] = f"Makefile:{mk_line} (target test)" if mk_line else "Makefile (target test)"
                elif "vitest" in dev_deps:
                    manifest_facts["test_command"] = "vitest run"
                    manifest_facts["test_command_type"] = "inferred (from devDependencies: vitest, not explicitly declared)"
                    manifest_facts["test_command_provenance"] = "common default, not declared in repo"
                elif "jest" in dev_deps:
                    manifest_facts["test_command"] = "jest"
                    manifest_facts["test_command_type"] = "inferred (from devDependencies: jest, not explicitly declared)"
                    manifest_facts["test_command_provenance"] = "common default, not declared in repo"

                manifest_facts["install_command_provenance"] = "common default, not declared in repo"

                if "dev" in scripts:
                    dev_line = find_line_matching(pkg_content, r'"dev"\s*:')
                    manifest_facts["dev_command"] = f"npm run dev (runs: {scripts['dev']})"
                    manifest_facts["run_command"] = f"npm run dev (runs: {scripts['dev']})"
                    manifest_facts["run_command_provenance"] = f"package.json:{dev_line} (scripts.dev)" if dev_line else "package.json (scripts.dev)"
                elif "start" in scripts:
                    start_line = find_line_matching(pkg_content, r'"start"\s*:')
                    manifest_facts["run_command"] = f"npm start (runs: {scripts['start']})"
                    manifest_facts["run_command_provenance"] = f"package.json:{start_line} (scripts.start)" if start_line else "package.json (scripts.start)"
                elif "build" in scripts:
                    build_line = find_line_matching(pkg_content, r'"build"\s*:')
                    manifest_facts["run_command"] = f"npm run build (runs: {scripts['build']})"
                    manifest_facts["run_command_provenance"] = f"package.json:{build_line} (scripts.build)" if build_line else "package.json (scripts.build)"
                else:
                    manifest_facts["run_command_provenance"] = "common default, not declared in repo"

                if "build" in scripts:
                    manifest_facts["build_command"] = f"npm run build (runs: {scripts['build']})"
                elif "build" in makefile_targets:
                    manifest_facts["build_command"] = "make build"

                return await self._finalize_manifest(manifest_facts, test_modules_count)
            except Exception as e:
                logger.warning("failed_to_parse_package_json", error=str(e))
                manifest_facts["manifest_type"] = "package.json"
                manifest_facts["parse_error"] = "could not read package.json"
                return await self._finalize_manifest(manifest_facts, test_modules_count)

        # 2. pyproject.toml
        pyproject_content = await self.extract_file_content("pyproject.toml")
        if pyproject_content:
            try:
                try:
                    import tomllib
                except ImportError:
                    import tomli as tomllib  # type: ignore

                py_data = tomllib.loads(pyproject_content)
                manifest_facts["manifest_type"] = "pyproject.toml"

                project_sec = py_data.get("project", {})
                manifest_facts["project_name"] = project_sec.get("name")

                # Parse runtime dependencies from project.dependencies
                raw_runtime = project_sec.get("dependencies", [])
                runtime_deps = []
                for d in raw_runtime:
                    name = re.split(r"[><=~^;\[\s]", str(d))[0].strip()
                    if name and name not in runtime_deps:
                        runtime_deps.append(name)

                # Parse dev/optional dependencies from project.optional-dependencies and tool.poetry
                dev_deps = []
                opt_deps = project_sec.get("optional-dependencies", {})
                for group in opt_deps.values():
                    if isinstance(group, list):
                        for d in group:
                            name = re.split(r"[><=~^;\[\s]", str(d))[0].strip()
                            if name and name not in dev_deps and name not in runtime_deps:
                                dev_deps.append(name)

                poetry_dev = py_data.get("tool", {}).get("poetry", {}).get("group", {}).get("dev", {}).get("dependencies", {})
                if isinstance(poetry_dev, dict):
                    for name in poetry_dev.keys():
                        if name not in dev_deps and name not in runtime_deps:
                            dev_deps.append(name)

                manifest_facts["runtime_dependencies"] = runtime_deps
                manifest_facts["dev_dependencies"] = dev_deps
                manifest_facts["tech_stack"] = runtime_deps

                # Check declared install command
                if "tool.poetry" in py_data.get("tool", {}):
                    manifest_facts["install_command"] = "poetry install"
                else:
                    manifest_facts["install_command"] = "pip install -e ."
                manifest_facts["install_command_provenance"] = "common default, not declared in repo"

                # Check declared test runner - Makefile target takes precedence if present
                if "test" in makefile_targets:
                    mk_line = find_makefile_target_line(makefile_content, "test")
                    manifest_facts["test_command"] = "make test"
                    manifest_facts["test_command_type"] = "declared (Makefile target)"
                    manifest_facts["test_command_provenance"] = f"Makefile:{mk_line} (target test)" if mk_line else "Makefile (target test)"
                elif "pytest" in py_data.get("tool", {}):
                    testpaths = py_data["tool"]["pytest"].get("ini_options", {}).get("testpaths", [])
                    testpaths_info = f" (testpaths: {', '.join(testpaths)})" if testpaths else ""
                    pyt_line = find_line_matching(pyproject_content, r"\[tool\.pytest")
                    manifest_facts["test_command"] = f"pytest{testpaths_info}"
                    manifest_facts["test_command_type"] = "declared (pyproject.toml [tool.pytest])"
                    manifest_facts["test_command_provenance"] = f"pyproject.toml:{pyt_line} ([tool.pytest])" if pyt_line else "pyproject.toml ([tool.pytest])"
                elif "pytest" in dev_deps:
                    manifest_facts["test_command"] = "pytest"
                    manifest_facts["test_command_type"] = "inferred (from dev dependencies: pytest, not explicitly declared)"
                    manifest_facts["test_command_provenance"] = "common default, not declared in repo"

                if "run" in makefile_targets:
                    mk_line = find_makefile_target_line(makefile_content, "run")
                    manifest_facts["run_command"] = "make run"
                    manifest_facts["run_command_provenance"] = f"Makefile:{mk_line} (target run)" if mk_line else "Makefile (target run)"
                elif "serve" in makefile_targets:
                    mk_line = find_makefile_target_line(makefile_content, "serve")
                    manifest_facts["run_command"] = "make serve"
                    manifest_facts["run_command_provenance"] = f"Makefile:{mk_line} (target serve)" if mk_line else "Makefile (target serve)"
                else:
                    manifest_facts["run_command_provenance"] = "common default, not declared in repo"

                if "build" in makefile_targets:
                    mk_line = find_makefile_target_line(makefile_content, "build")
                    manifest_facts["build_command"] = "make build"
                    manifest_facts["build_command_provenance"] = f"Makefile:{mk_line} (target build)" if mk_line else "Makefile (target build)"

                return await self._finalize_manifest(manifest_facts, test_modules_count)
            except Exception as e:
                logger.warning("failed_to_parse_pyproject_toml", error=str(e))
                manifest_facts["manifest_type"] = "pyproject.toml"
                manifest_facts["parse_error"] = "could not read pyproject.toml"
                return await self._finalize_manifest(manifest_facts, test_modules_count)

        # 3. requirements.txt
        req_content = await self.extract_file_content("requirements.txt")
        if req_content:
            manifest_facts["manifest_type"] = "requirements.txt"
            manifest_facts["install_command"] = "pip install -r requirements.txt"
            manifest_facts["install_command_provenance"] = "common default, not declared in repo"
            deps = []
            for line in req_content.splitlines():
                clean = line.strip()
                if clean and not clean.startswith("#"):
                    name = re.split(r"[><=~^;\[\s]", clean)[0].strip()
                    if name and name not in deps:
                        deps.append(name)
            manifest_facts["runtime_dependencies"] = deps
            manifest_facts["tech_stack"] = deps
            if "test" in makefile_targets:
                mk_line = find_makefile_target_line(makefile_content, "test")
                manifest_facts["test_command"] = "make test"
                manifest_facts["test_command_type"] = "declared (Makefile target)"
                manifest_facts["test_command_provenance"] = f"Makefile:{mk_line} (target test)" if mk_line else "Makefile (target test)"
            elif "pytest" in deps:
                manifest_facts["test_command"] = "pytest"
                manifest_facts["test_command_type"] = "inferred (from requirements.txt: pytest, not explicitly declared)"
                manifest_facts["test_command_provenance"] = "common default, not declared in repo"

            if "run" in makefile_targets:
                mk_line = find_makefile_target_line(makefile_content, "run")
                manifest_facts["run_command"] = "make run"
                manifest_facts["run_command_provenance"] = f"Makefile:{mk_line} (target run)" if mk_line else "Makefile (target run)"
            elif "serve" in makefile_targets:
                mk_line = find_makefile_target_line(makefile_content, "serve")
                manifest_facts["run_command"] = "make serve"
                manifest_facts["run_command_provenance"] = f"Makefile:{mk_line} (target serve)" if mk_line else "Makefile (target serve)"
            else:
                manifest_facts["run_command_provenance"] = "common default, not declared in repo"

            if "build" in makefile_targets:
                mk_line = find_makefile_target_line(makefile_content, "build")
                manifest_facts["build_command"] = "make build"
                manifest_facts["build_command_provenance"] = f"Makefile:{mk_line} (target build)" if mk_line else "Makefile (target build)"
            return await self._finalize_manifest(manifest_facts, test_modules_count)

        # 4. Standalone Makefile
        if makefile_content and ("test" in makefile_targets or "build" in makefile_targets):
            manifest_facts["manifest_type"] = "Makefile"
            if "install" in makefile_targets:
                mk_line = find_makefile_target_line(makefile_content, "install")
                manifest_facts["install_command"] = "make install"
                manifest_facts["install_command_provenance"] = f"Makefile:{mk_line} (target install)" if mk_line else "Makefile (target install)"
            else:
                manifest_facts["install_command_provenance"] = "common default, not declared in repo"

            if "test" in makefile_targets:
                mk_line = find_makefile_target_line(makefile_content, "test")
                manifest_facts["test_command"] = "make test"
                manifest_facts["test_command_type"] = "declared (Makefile target)"
                manifest_facts["test_command_provenance"] = f"Makefile:{mk_line} (target test)" if mk_line else "Makefile (target test)"

            if "build" in makefile_targets:
                mk_line = find_makefile_target_line(makefile_content, "build")
                manifest_facts["build_command"] = "make build"
                manifest_facts["build_command_provenance"] = f"Makefile:{mk_line} (target build)" if mk_line else "Makefile (target build)"

            if "run" in makefile_targets:
                mk_line = find_makefile_target_line(makefile_content, "run")
                manifest_facts["run_command"] = "make run"
                manifest_facts["run_command_provenance"] = f"Makefile:{mk_line} (target run)" if mk_line else "Makefile (target run)"
            elif "serve" in makefile_targets:
                mk_line = find_makefile_target_line(makefile_content, "serve")
                manifest_facts["run_command"] = "make serve"
                manifest_facts["run_command_provenance"] = f"Makefile:{mk_line} (target serve)" if mk_line else "Makefile (target serve)"
            else:
                manifest_facts["run_command_provenance"] = "common default, not declared in repo"
            return await self._finalize_manifest(manifest_facts, test_modules_count)

        # 5. go.mod
        go_content = await self.extract_file_content("go.mod")
        if go_content:
            manifest_facts["manifest_type"] = "go.mod"
            manifest_facts["test_command"] = "go test ./..."
            manifest_facts["test_command_type"] = "declared (standard Go test toolchain)"
            deps = [
                line.strip().split()[0]
                for line in go_content.splitlines()
                if line.strip() and not line.startswith("module") and not line.startswith("go")
            ]
            manifest_facts["runtime_dependencies"] = deps
            manifest_facts["tech_stack"] = deps
            return await self._finalize_manifest(manifest_facts, test_modules_count)

        return await self._finalize_manifest(manifest_facts, test_modules_count)

    async def _finalize_manifest(self, manifest_facts: dict[str, Any], test_modules_count: int) -> dict[str, Any]:
        """
        Enforce multi-manifest monorepo discovery and 0-test guard.
        Reads every package.json, pyproject.toml, and requirements file found.
        Never recommends a test command when facts show 0 test modules.
        """
        nodes = self.graph_cache.get("nodes", [])
        all_file_paths = [n.get("path") or n.get("id", "") for n in nodes]
        IGNORED_MANIFEST_DIRS = (
            "docs", "doc", "examples", "example", "samples", "sample",
            "vendor", "node_modules", "test", "tests", "fixtures", "benchmarks",
            ".github", "venv", ".venv",
        )

        all_manifest_paths = []
        for p in all_file_paths:
            p_parts = [part.lower() for part in PurePosixPath(p).parts[:-1]]
            if any(ign in p_parts for ign in IGNORED_MANIFEST_DIRS):
                continue
            name = PurePosixPath(p).name
            if name in ("package.json", "pyproject.toml") or (
                name.startswith("requirements") and PurePosixPath(p).suffix == ".txt"
            ):
                all_manifest_paths.append(p)

        manifests_by_dir: dict[str, list[str]] = {}
        for mp in all_manifest_paths:
            d = PurePosixPath(mp).parent.as_posix()
            manifests_by_dir.setdefault(d, []).append(mp)

        # Only activate monorepo multi-package mode when there are 2 or more distinct valid package directories
        valid_dirs = set(manifests_by_dir.keys())
        if len(valid_dirs) > 1:
            monorepo_packages = []
            package_folders = [("root" if d in (".", "") else d) for d in manifests_by_dir.keys()]

            for d, m_files in sorted(manifests_by_dir.items(), key=lambda x: x[0]):
                folder = "root" if d in (".", "") else d
                if folder != "root":
                    folder_tests = sum(
                        1 for f in all_file_paths
                        if is_test_file(f) and (f.startswith(folder + "/") or f.startswith(folder + "\\"))
                    )
                else:
                    other_dirs = [fld for fld in package_folders if fld != "root"]
                    folder_tests = sum(
                        1 for f in all_file_paths
                        if is_test_file(f) and not any(f.startswith(od + "/") or f.startswith(od + "\\") for od in other_dirs)
                    )

                p_json = next((f for f in m_files if PurePosixPath(f).name == "package.json"), None)
                py_proj = next((f for f in m_files if PurePosixPath(f).name == "pyproject.toml"), None)
                req_txt = next((f for f in m_files if PurePosixPath(f).name.startswith("requirements")), None)

                cd_prefix = f"cd {folder} && " if folder != "root" else ""

                if p_json:
                    content = await self.extract_file_content(p_json)
                    if content:
                        try:
                            pdata = json.loads(content)
                            pscripts = pdata.get("scripts", {})
                            if folder_tests > 0:
                                if folder == "root" and manifest_facts.get("test_command"):
                                    test_cmd = manifest_facts["test_command"]
                                    test_prov = manifest_facts.get("test_command_provenance", "common default, not declared in repo")
                                else:
                                    test_line = find_line_matching(content, r'"test"\s*:')
                                    test_cmd = f"{cd_prefix}npm test" if "test" in pscripts else None
                                    test_prov = f"{p_json}:{test_line}" if test_line else "common default, not declared in repo"
                            else:
                                test_cmd = None
                                test_prov = None

                            run_cmd = (
                                f"{cd_prefix}npm run dev"
                                if "dev" in pscripts
                                else (f"{cd_prefix}npm start" if "start" in pscripts else None)
                            )
                            run_key = "dev" if "dev" in pscripts else ("start" if "start" in pscripts else None)
                            run_line = find_line_matching(content, rf'"{run_key}"\s*:') if run_key else None
                            run_prov = f"{p_json}:{run_line}" if run_line else ("common default, not declared in repo" if run_cmd else None)

                            monorepo_packages.append({
                                "folder": folder,
                                "manifest_type": "package.json",
                                "install_command": f"{cd_prefix}npm install",
                                "install_provenance": "common default, not declared in repo",
                                "run_command": run_cmd,
                                "run_provenance": run_prov,
                                "test_command": test_cmd,
                                "test_provenance": test_prov,
                                "test_count": folder_tests,
                            })
                        except Exception:
                            pass
                elif py_proj:
                    content = await self.extract_file_content(py_proj)
                    if folder_tests > 0:
                        if folder == "root" and manifest_facts.get("test_command"):
                            test_cmd = manifest_facts["test_command"]
                            test_prov = manifest_facts.get("test_command_provenance", "common default, not declared in repo")
                        else:
                            test_cmd = f"{cd_prefix}pytest"
                            pyt_line = find_line_matching(content, r"\[tool\.pytest")
                            test_prov = f"{py_proj}:{pyt_line}" if pyt_line else "common default, not declared in repo"
                    else:
                        test_cmd = None
                        test_prov = None

                    # Detect run command
                    run_cmd = None
                    if any(f.endswith("main.py") and f.startswith(folder) for f in all_file_paths):
                        run_cmd = "uvicorn app.main:app --reload" if any("uvicorn" in f or "fastapi" in f for f in all_file_paths) else f"{cd_prefix}python main.py"

                    monorepo_packages.append({
                        "folder": folder,
                        "manifest_type": "pyproject.toml",
                        "install_command": f"{cd_prefix}pip install -e .",
                        "install_provenance": "common default, not declared in repo",
                        "run_command": run_cmd,
                        "run_provenance": "common default, not declared in repo" if run_cmd else None,
                        "test_command": test_cmd,
                        "test_provenance": test_prov,
                        "test_count": folder_tests,
                    })
                elif req_txt:
                    if folder_tests > 0:
                        if folder == "root" and manifest_facts.get("test_command"):
                            test_cmd = manifest_facts["test_command"]
                            test_prov = manifest_facts.get("test_command_provenance", "common default, not declared in repo")
                        else:
                            test_cmd = f"pytest {folder}" if folder != "root" else "pytest"
                            test_prov = "common default, not declared in repo"
                    else:
                        test_cmd = None
                        test_prov = None

                    # Detect run command from Dockerfile or app entry point
                    run_cmd = None
                    prefix_path = folder if folder != "root" else ""
                    has_main = any(f in (f"{prefix_path}/app/main.py".lstrip("/"), f"{prefix_path}/main.py".lstrip("/")) for f in all_file_paths)
                    if has_main:
                        run_cmd = "uvicorn app.main:app --reload"

                    monorepo_packages.append({
                        "folder": folder,
                        "manifest_type": "requirements.txt",
                        "install_command": f"pip install -r {req_txt}",
                        "install_provenance": "common default, not declared in repo",
                        "run_command": run_cmd,
                        "run_provenance": "common default, not declared in repo" if run_cmd else None,
                        "test_command": test_cmd,
                        "test_provenance": test_prov,
                        "test_count": folder_tests,
                    })

            manifest_facts["monorepo_packages"] = monorepo_packages
        else:
            manifest_facts["monorepo_packages"] = []

        # 0 test modules guard across the repository:
        # Never recommend a test command when facts show 0 test modules. Say "no tests found".
        if test_modules_count is not None and test_modules_count == 0:
            manifest_facts["test_command"] = "no tests found"
            manifest_facts["test_command_type"] = "no test files found in indexed files"
            for pkg in manifest_facts.get("monorepo_packages", []):
                pkg["test_command"] = "no tests found"

        return manifest_facts

    async def extract_env_variables(self) -> list[str]:
        """
        Extract declared environment variable keys from .env.example or env.example.
        Only extracts keys; never exposes or invents secret values.
        """
        for filename in (".env.example", "env.example", ".env.sample"):
            content = await self.extract_file_content(filename)
            if content:
                keys: list[str] = []
                for line in content.splitlines():
                    clean = line.strip()
                    if clean and not clean.startswith("#") and "=" in clean:
                        key = clean.split("=")[0].strip()
                        if key and key not in keys:
                            keys.append(key)
                if keys:
                    return keys
        return []

    async def detect_env_usage_in_code(self, declared_keys: list[str]) -> dict[str, str]:
        """
        Scan code chunks for references to declared env keys via:
        - import.meta.env
        - process.env
        - os.environ
        - os.getenv
        - pydantic Settings fields
        Returns a mapping from key -> accessor.
        """
        if not declared_keys:
            return {}

        key_set = set(declared_keys)
        read_keys: dict[str, str] = {}

        # 1. Search database chunks if DB is available
        if self.db is not None:
            try:
                from app.models.code_chunk import CodeChunk
                from sqlalchemy import select

                stmt = select(CodeChunk.file_path, CodeChunk.content).where(
                    CodeChunk.repo_id == self.repo_id
                )
                res = await self.db.execute(stmt)
                for path, content in res.all():
                    if path.endswith((".example", ".sample")):
                        continue
                    is_settings_file = (
                        "BaseSettings" in content
                        or "SettingsConfigDict" in content
                        or path.endswith(("config.py", "settings.py"))
                    )
                    has_import_meta = "import.meta.env" in content or "readEnv" in content
                    has_process_env = "process.env" in content

                    for k in key_set:
                        if k in read_keys:
                            continue
                        k_lower = k.lower()

                        # 1. Pydantic Settings
                        if is_settings_file and (re.search(rf"\b{re.escape(k_lower)}\s*:", content) or f"{k}:" in content):
                            read_keys[k] = "pydantic Settings"
                        # 2. import.meta.env
                        elif (
                            f"import.meta.env.{k}" in content
                            or f'import.meta.env["{k}"]' in content
                            or f"import.meta.env['{k}']" in content
                            or (has_import_meta and (f'"{k}"' in content or f"'{k}'" in content))
                        ):
                            read_keys[k] = "import.meta.env"
                        # 3. process.env
                        elif (
                            f"process.env.{k}" in content
                            or f'process.env["{k}"]' in content
                            or f"process.env['{k}']" in content
                        ):
                            read_keys[k] = "process.env"
                        # 4. os.environ
                        elif (
                            f'os.environ["{k}"]' in content
                            or f"os.environ['{k}']" in content
                            or f'os.environ.get("{k}"' in content
                            or f"os.environ.get('{k}'" in content
                        ):
                            read_keys[k] = "os.environ"
                        # 5. os.getenv
                        elif (
                            f'os.getenv("{k}"' in content
                            or f"os.getenv('{k}'" in content
                            or f'getenv("{k}"' in content
                            or f"getenv('{k}'" in content
                        ):
                            read_keys[k] = "os.getenv"
            except Exception as e:
                logger.warning("env_usage_db_scan_failed", error=str(e))

        # 2. Check nodes in graph_cache if DB scan didn't find all or DB was not available
        if len(read_keys) < len(declared_keys):
            nodes = self.graph_cache.get("nodes", [])
            for n in nodes[:50]:
                path = n.get("path") or n.get("id", "")
                if is_test_file(path) or is_generated_file(path) or path.endswith((".md", ".rst", ".txt", ".example", ".sample")):
                    continue
                content = await self.extract_file_content(path)
                if not content:
                    continue
                is_settings_file = (
                    "BaseSettings" in content
                    or "SettingsConfigDict" in content
                    or path.endswith(("config.py", "settings.py"))
                )
                has_import_meta = "import.meta.env" in content or "readEnv" in content

                for k in key_set:
                    if k in read_keys:
                        continue
                    k_lower = k.lower()
                    if is_settings_file and (re.search(rf"\b{re.escape(k_lower)}\s*:", content) or f"{k}:" in content):
                        read_keys[k] = "pydantic Settings"
                    elif (
                        f"import.meta.env.{k}" in content
                        or f'import.meta.env["{k}"]' in content
                        or f"import.meta.env['{k}']" in content
                        or (has_import_meta and (f'"{k}"' in content or f"'{k}'" in content))
                    ):
                        read_keys[k] = "import.meta.env"
                    elif f"process.env.{k}" in content or f'process.env["{k}"]' in content or f"process.env['{k}']" in content:
                        read_keys[k] = "process.env"
                    elif f'os.environ["{k}"]' in content or f"os.environ['{k}']" in content or f'os.environ.get("{k}"' in content or f"os.environ.get('{k}'" in content:
                        read_keys[k] = "os.environ"
                    elif f'os.getenv("{k}"' in content or f"os.getenv('{k}'" in content or f'getenv("{k}"' in content or f"getenv('{k}'" in content:
                        read_keys[k] = "os.getenv"

        return read_keys

    async def extract_readme_summary(self) -> str | None:
        """
        Extract the first 1-2 introductory paragraphs from README.
        Supports README.rst, README.md, README.txt, and README (case-insensitive).
        Cleans badges, image directives, and title headers.
        """
        candidates = (
            "README.rst", "README.md", "README.txt", "README",
            "readme.rst", "readme.md", "readme.txt", "readme",
        )
        for filename in candidates:
            content = await self.extract_file_content(filename)
            if not content or not content.strip():
                continue

            is_rst = filename.lower().endswith(".rst")
            clean_lines = []
            skip_block = False

            for line in content.splitlines():
                stripped = line.strip()

                if is_rst:
                    if stripped.startswith(".. image::") or stripped.startswith(".. code-block::"):
                        skip_block = True
                        continue
                    if skip_block:
                        if line.startswith(" ") or line.startswith("\t") or stripped.startswith(":"):
                            continue
                        else:
                            skip_block = False
                    if stripped.startswith(".. _") or stripped.startswith(".. "):
                        continue
                    # RST header underlines
                    if len(stripped) >= 3 and all(c in "=-~^\"`#" for c in stripped):
                        continue
                else:
                    if stripped.startswith(("[![", "<img", "[!DOCTYPE", "![", "#")):
                        continue

                clean_lines.append(line)

            cleaned = "\n".join(clean_lines)
            paragraphs: list[str] = []
            for block in cleaned.split("\n\n"):
                raw_lines = [l.strip() for l in block.splitlines() if l.strip()]
                if not raw_lines:
                    continue
                # If block is a list (all lines start with * or -), preserve line structure
                if all(l.startswith(("* ", "- ")) for l in raw_lines):
                    b = "\n".join(raw_lines)
                else:
                    b = " ".join(block.split()).strip()

                if not b:
                    continue
                if b.startswith("#") or b.startswith("..") or b.startswith(":") or b.startswith("==="):
                    continue
                # Skip title-like header blocks followed by nothing
                if len(b) < 60 and ("Web Framework" in b or "Overview" in b or "Welcome" in b):
                    continue

                if is_rst:
                    b = re.sub(r"`([^`<]+)\s*<[^>]+>`_", r"\1", b)
                    b = re.sub(r"\b([a-zA-Z0-9_]+)_\b", r"\1", b)
                    b = re.sub(r":\w+:(`[^`]+`|\w+)", r"\1", b)
                    b = b.replace("``", "`")

                # Strip Markdown links [text](url) -> text
                b = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", b)
                # Strip excess whitespace before punctuation
                b = re.sub(r"\s+([.,;:!?])", r"\1", b)

                paragraphs.append(b)
                if len(paragraphs) >= 2:
                    break

            if paragraphs:
                return "\n\n".join(paragraphs)[:1000]

        return None

    def compute_folder_breakdown(self) -> list[dict[str, str]]:
        """
        Group files into distinct top-level directories and summarize their roles.
        """
        nodes = self.graph_cache.get("nodes", [])
        dir_counts: dict[str, int] = {}
        dir_files: dict[str, list[str]] = {}

        for n in nodes:
            path = n.get("path") or n.get("id", "")
            parts = PurePosixPath(path.replace("\\", "/")).parts
            if len(parts) > 1:
                top_dir = parts[0]
                if top_dir == "src" and len(parts) > 2:
                    top_dir = f"src/{parts[1]}"
                dir_counts[top_dir] = dir_counts.get(top_dir, 0) + 1
                dir_files.setdefault(top_dir, []).append(parts[-1])
            else:
                dir_counts["root"] = dir_counts.get("root", 0) + 1
                dir_files.setdefault("root", []).append(parts[0])

        folder_map = []
        for d, count in sorted(dir_counts.items(), key=lambda x: x[1], reverse=True)[:8]:
            sample = ", ".join(dir_files[d][:3])
            clean_d = d.strip().rstrip("/")
            folder_map.append({
                "path": clean_d,
                "file_count": str(count),
                "sample_files": sample,
            })
        return folder_map

    async def assemble_verified_facts(self) -> dict[str, Any]:
        """
        Collect all computed facts into one single authoritative dictionary.
        """
        metrics = self.compute_graph_metrics()
        test_modules_count = metrics.get("test_modules_count", 0)
        manifest = await self.extract_manifest_facts(test_modules_count=test_modules_count)
        env_vars = await self.extract_env_variables()
        env_usage = await self.detect_env_usage_in_code(env_vars)

        grouped_env_vars: dict[str, list[dict[str, Any]]] = {}
        # Do not group when there are 6 or fewer keys
        if len(env_vars) > 6:
            for k in env_vars:
                cat = categorize_env_key(k)
                accessor = env_usage.get(k)
                grouped_env_vars.setdefault(cat, []).append({
                    "key": k,
                    "read_in_code": bool(accessor),
                    "accessor": accessor,
                })

        readme_summary = await self.extract_readme_summary()
        folder_breakdown = self.compute_folder_breakdown()

        # Top high-risk files
        high_risk_files = [
            m for m in metrics["file_metrics"].values() if m["risk_level"] == "High"
        ]
        high_risk_files.sort(key=lambda m: m["dependents_count"], reverse=True)

        # Populate first 30 lines for high-risk files so explanations are snippet-grounded
        for hr in high_risk_files:
            content = await self.extract_file_content(hr["path"])
            if content and content.strip():
                snippet_lines = content.splitlines()[:30]
                hr["first_30_lines"] = "\n".join(snippet_lines)
            else:
                hr["first_30_lines"] = None

        # Populate first 30 lines for each candidate starter file
        for cs in metrics.get("candidate_starters", []):
            content = await self.extract_file_content(cs["path"])
            if content and content.strip():
                snippet_lines = content.splitlines()[:30]
                cs["first_30_lines"] = "\n".join(snippet_lines)
            else:
                cs["first_30_lines"] = None

        if (self.commit_sha is None or self.indexed_at is None) and self.db is not None:
            try:
                from app.models.repository import Repository
                stmt = select(Repository.latest_commit_sha, Repository.indexed_at).where(Repository.id == self.repo_id)
                res = await self.db.execute(stmt)
                row = res.first()
                if row:
                    if self.commit_sha is None and row[0]:
                        self.commit_sha = str(row[0])
                    if self.indexed_at is None and row[1]:
                        self.indexed_at = row[1].isoformat() if hasattr(row[1], "isoformat") else str(row[1])
            except Exception as e:
                logger.warning("failed_to_fetch_repo_commit_and_indexed_at", error=str(e))

        return {
            "repo_full_name": self.repo_full_name,
            "commit_sha": self.commit_sha or "unknown",
            "indexed_at": self.indexed_at or "unknown",
            "total_modules": metrics["total_modules"],
            "source_modules_count": metrics["source_modules_count"],
            "test_modules_count": metrics["test_modules_count"],
            "docs_and_assets_count": metrics["docs_and_assets_count"],
            "config_modules_count": metrics["config_modules_count"],
            "language_breakdown": metrics["language_breakdown"],
            "total_edges": metrics["total_edges"],
            "cycles_count": metrics["cycles_count"],
            "cycles": metrics["cycles"],
            "entry_points": metrics["entry_points"][:5],
            "high_risk_files": high_risk_files,
            "candidate_starters": metrics["candidate_starters"],
            "starter_empty_reason": metrics.get("starter_empty_reason"),
            "manifest": manifest,
            "env_variables": env_vars,
            "env_usage": env_usage,
            "grouped_env_variables": grouped_env_vars,
            "readme_summary": readme_summary,
            "folder_breakdown": folder_breakdown,
            "file_metrics": metrics["file_metrics"],
        }

    def format_facts_text(self, facts: dict[str, Any]) -> str:
        """
        Format facts into an unambiguous, bulleted text block for the LLM prompt.
        """
        lines = [
            "=== VERIFIED REPOSITORY FACTS (GROUND TRUTH FROM CODE & GRAPH) ===",
            f"Repository: {facts['repo_full_name']}",
            f"Commit SHA: {facts.get('commit_sha', 'unknown')}",
            f"Indexed At: {facts.get('indexed_at', 'unknown')}",
            f"Total Indexed Files: {facts['total_modules']} (Source Modules: {facts.get('source_modules_count', 0)}, Config Files: {facts.get('config_modules_count', 0)}, Test Modules: {facts.get('test_modules_count', 0)}, Docs/Assets: {facts.get('docs_and_assets_count', 0)})",
            f"Total Dependency Edges: {facts['total_edges']}",
            f"Circular Import Cycles: {facts['cycles_count']} detected",
        ]

        if facts.get("language_breakdown"):
            langs = [f"{lang}: {count}" for lang, count in sorted(facts["language_breakdown"].items(), key=lambda x: x[1], reverse=True)]
            lines.append(f"Language Breakdown: {', '.join(langs)}")

        if facts["readme_summary"]:
            lines.append(f"\n[Verified Project Overview from README]:\n{facts['readme_summary']}")

        manifest = facts["manifest"]
        if manifest.get("parse_error"):
            lines.append(f"\n[Verified Build & Package Setup ({manifest.get('manifest_type') or 'manifest'})]:")
            lines.append(f"- Parse Error: {manifest['parse_error']}")
        elif manifest.get("monorepo_packages"):
            lines.append("\n[Verified Monorepo Packages / Multi-folder Setup]:")
            for pkg in manifest["monorepo_packages"]:
                lines.append(f"- Folder: `{pkg['folder']}/` ({pkg['manifest_type']})")
                lines.append(f"  Install: `{pkg['install_command']}` ({pkg.get('install_provenance') or 'common default, not declared in repo'})")
                if pkg.get("run_command"):
                    lines.append(f"  Run/Dev: `{pkg['run_command']}` ({pkg.get('run_provenance') or 'common default, not declared in repo'})")
                if pkg.get("test_command") and pkg["test_command"] != "no tests found":
                    lines.append(f"  Test: `{pkg['test_command']}` ({pkg.get('test_provenance') or 'common default, not declared in repo'})")
                else:
                    lines.append(f"  Test: no tests found")
        elif manifest["manifest_type"]:
            lines.append(f"\n[Verified Build & Package Setup ({manifest['manifest_type']})]:")
            if manifest["project_name"]:
                lines.append(f"- Project Name: {manifest['project_name']}")
            if manifest.get("install_command"):
                lines.append(f"- Install Command: {manifest['install_command']} ({manifest.get('install_command_provenance') or 'common default, not declared in repo'})")
            if manifest.get("run_command"):
                lines.append(f"- Run Command: {manifest['run_command']} ({manifest.get('run_command_provenance') or 'common default, not declared in repo'})")
            if manifest["test_command"]:
                if manifest["test_command"] == "no tests found":
                    lines.append("- Test Command: no tests found")
                else:
                    lines.append(f"- Test Command: {manifest['test_command']} ({manifest.get('test_command_provenance') or 'common default, not declared in repo'})")
            else:
                lines.append("- Test Command: None declared in repository.")
            if manifest["dev_command"]:
                lines.append(f"- Dev Server Command: {manifest['dev_command']}")
            if manifest["build_command"]:
                lines.append(f"- Build Command: {manifest['build_command']}")
            if manifest.get("runtime_dependencies"):
                lines.append(f"- Runtime Dependencies: {', '.join(manifest['runtime_dependencies'][:12])}")
            if manifest.get("dev_dependencies"):
                lines.append(f"- Dev Dependencies: {', '.join(manifest['dev_dependencies'][:8])}")

        if facts.get("grouped_env_variables"):
            lines.append("\n[Verified Environment Variables (.env.example - Grouped & Code Usage Marked)]:")
            for cat, items in facts["grouped_env_variables"].items():
                lines.append(f"- **{cat}**:")
                for item in items:
                    usage = f" (read in code via {item['accessor']})" if item.get("read_in_code") else " (declared in .env.example)"
                    lines.append(f"  - `{item['key']}`{usage}")
        elif facts.get("env_variables"):
            lines.append(f"\n[Verified Environment Variables (.env.example)]:\n- Keys: {', '.join(facts['env_variables'])}")
        else:
            lines.append("\n[Verified Environment Variables]: No .env.example file declared in repository.")

        lines.append("\n[Verified Key Entry Points]:")
        if facts["entry_points"]:
            for ep in facts["entry_points"]:
                source_deps = ep.get("source_dependents_count", 0)
                test_deps = ep.get("test_dependents_count", 0)
                lines.append(f"- [[{ep['path']}]] (Source Dependents: {source_deps}, Test Importers: {test_deps}, Outgoing Dependencies: {ep['dependencies_count']})")
        else:
            lines.append("- None declared or identified.")

        lines.append("\n[Verified High-Risk Junction Files (High Blast Radius)]:")
        if facts["high_risk_files"]:
            for hr in facts["high_risk_files"]:
                source_deps = hr.get("source_dependents_count", 0)
                test_deps = hr.get("test_dependents_count", 0)
                lines.append(
                    f"- [[{hr['path']}]] (Risk: High, Total Dependents: {hr['dependents_count']} [Source: {source_deps}, Tests: {test_deps}], "
                    f"Dependencies: {hr['dependencies_count']}, Coupling: {hr['coupling']:.2f})"
                )
                if hr.get("first_30_lines"):
                    ext = PurePosixPath(hr["path"]).suffix.lstrip(".") or "text"
                    lines.append(f"  Verified first 30 lines snippet:\n  ```{ext}\n{hr['first_30_lines']}\n  ```")
                else:
                    lines.append("  Snippet: None available (explanation must note purpose not verified).")
        else:
            lines.append("- None identified.")

        lines.append("\n[Verified Candidate Starter Files (Zero / Low Downstream Risk)]:")
        if facts["candidate_starters"]:
            for cs in facts["candidate_starters"]:
                nearby = f" | Nearby test: [[{cs['nearby_test']}]]" if cs.get("nearby_test") else " | No test file detected"
                source_deps = cs.get("source_dependents_count", 0)
                test_deps = cs.get("test_dependents_count", 0)
                lines.append(
                    f"- [[{cs['path']}]] (Lines: {cs['line_count']}, Source Dependents: {source_deps}, Test Importers: {test_deps}{nearby})"
                )
                if cs.get("first_30_lines"):
                    ext = PurePosixPath(cs["path"]).suffix.lstrip(".") or "text"
                    lines.append(f"  Verified first 30 lines snippet:\n  ```{ext}\n{cs['first_30_lines']}\n  ```")
                else:
                    lines.append("  Snippet: None available (purpose not verified).")
        else:
            empty_reason = facts.get(
                "starter_empty_reason",
                "No low-risk starter modules identified: all core source modules have active dependents or are imported across the test suite."
            )
            lines.append(f"- None. Reason: {empty_reason}")

        lines.append("\n[Verified Directory Structure]:")
        for fb in facts.get("folder_breakdown", []):
            clean_p = str(fb.get("path", "")).strip().rstrip("/")
            try:
                cnt = int(fb.get("file_count", 0))
            except (ValueError, TypeError):
                cnt = 0
            plural = "1 file" if cnt == 1 else f"{cnt} files"
            sample = f", e.g. {fb['sample_files']}" if fb.get("sample_files") else ""
            lines.append(f"- {clean_p}/ ({plural}{sample})")

        lines.append("\n=== END VERIFIED FACTS ===")
        return "\n".join(lines)


def build_deterministic_fallback_doc(facts: dict[str, Any]) -> str:
    """
    Generate a 100% facts-based deterministic onboarding document.
    No LLM hallucination, no placeholder router.ts/db.ts, no fake invariants.
    """
    repo_name = facts.get("repo_full_name", "Repository")

    entry_lines = "\n".join(
        f"- `[[{ep['path']}]]`: Entry point ({ep['dependents_count']} downstream dependents, {ep['dependencies_count']} dependencies)"
        for ep in facts.get("entry_points", [])
    ) or "- No explicit entry point declared."

    high_risk_lines = "\n".join(
        f"- `[[{hr['path']}]]` (Risk: High, {hr['dependents_count']} direct dependents, coupling: {hr['coupling']:.2f})\n"
        f"  Modifying public signatures affects {hr['dependents_count']} dependent modules. Verify all dependents before merging changes."
        for hr in facts.get("high_risk_files", [])
    ) or "- No single-point high-risk modules identified."

    if facts.get("candidate_starters"):
        starter_lines = "\n".join(
            f"- `[[{cs['path']}]]` ({cs['line_count']} lines, {cs['dependents_count']} downstream dependents)\n"
            f"  Safe candidate module with low coupling."
            + (f" Verified test: `[[{cs['nearby_test']}]]`." if cs.get("nearby_test") else " No dedicated test file detected.")
            for cs in facts.get("candidate_starters", [])
        )
    else:
        empty_reason = facts.get(
            "starter_empty_reason",
            "No low-risk starter modules identified: all core source modules have active dependents or are imported across the test suite."
        )
        starter_lines = f"- {empty_reason}"

    manifest = facts.get("manifest", {})
    quick_start_lines = []
    if manifest.get("parse_error"):
        quick_start_lines.append(f"- {manifest['parse_error']}")
    elif manifest.get("monorepo_packages"):
        quick_start_lines.append("- **Monorepo Packages Setup**:")
        for pkg in manifest["monorepo_packages"]:
            folder = pkg["folder"]
            quick_start_lines.append(f"  - **`{folder}/`** ({pkg['manifest_type']}):")
            if pkg.get("install_command"):
                inst_prov = pkg.get("install_provenance") or "common default, not declared in repo"
                quick_start_lines.append(f"    - Install: `{pkg['install_command']}` ({inst_prov})")
            if pkg.get("run_command"):
                run_prov = pkg.get("run_provenance") or "common default, not declared in repo"
                quick_start_lines.append(f"    - Run/Dev: `{pkg['run_command']}` ({run_prov})")
            if pkg.get("test_command") and pkg["test_command"] != "no tests found":
                test_prov = pkg.get("test_provenance") or "common default, not declared in repo"
                quick_start_lines.append(f"    - Test: `{pkg['test_command']}` ({test_prov})")
    else:
        if manifest.get("install_command"):
            inst_prov = manifest.get("install_command_provenance") or "common default, not declared in repo"
            quick_start_lines.append(f"- **Install**: `{manifest['install_command']}` ({inst_prov})")
        if manifest.get("run_command"):
            run_prov = manifest.get("run_command_provenance") or "common default, not declared in repo"
            quick_start_lines.append(f"- **Run/Dev**: `{manifest['run_command']}` ({run_prov})")
        if manifest.get("test_command"):
            if manifest["test_command"] == "no tests found":
                quick_start_lines.append("- **Test**: no tests found")
            else:
                test_prov = manifest.get("test_command_provenance") or "common default, not declared in repo"
                quick_start_lines.append(f"- **Test**: `{manifest['test_command']}` ({test_prov})")
        else:
            quick_start_lines.append("- **Test**: no tests found")
        if manifest.get("build_command"):
            quick_start_lines.append(f"- **Build**: `{manifest['build_command']}`")

    if facts.get("grouped_env_variables"):
        quick_start_lines.append("- **Environment Variables**:")
        for cat, items in facts["grouped_env_variables"].items():
            quick_start_lines.append(f"  - **{cat}**:")
            for item in items:
                usage = f" (read in code via {item['accessor']})" if item.get("read_in_code") else " (declared in .env.example)"
                quick_start_lines.append(f"    - `{item['key']}`{usage}")
    elif facts.get("env_variables"):
        quick_start_lines.append(f"- **Environment Variables**: {', '.join(facts['env_variables'])}")

    cmd_lines = []
    if manifest.get("runtime_dependencies"):
        cmd_lines.append(f"- **Runtime Dependencies**: {', '.join(manifest['runtime_dependencies'][:12])}")
    elif manifest.get("tech_stack"):
        cmd_lines.append(f"- **Dependencies**: {', '.join(manifest['tech_stack'][:12])}")
    if manifest.get("dev_dependencies"):
        cmd_lines.append(f"- **Dev Dependencies**: {', '.join(manifest['dev_dependencies'][:8])}")

    quick_start_section = "\n".join(quick_start_lines) if quick_start_lines else "- No setup commands declared."
    deps_section = "\n".join(cmd_lines) if cmd_lines else "- No external dependencies declared."

    folder_entries = []
    for fb in facts.get("folder_breakdown", []):
        clean_p = str(fb.get("path", "")).strip().rstrip("/")
        try:
            cnt = int(fb.get("file_count", 0))
        except (ValueError, TypeError):
            cnt = 0
        plural = "1 file" if cnt == 1 else f"{cnt} files"
        sample = f", e.g. {fb['sample_files']}" if fb.get("sample_files") else ""
        folder_entries.append(f"- `{clean_p}/` ({plural}{sample})")

    folder_map_lines = "\n".join(folder_entries) or "- No directory structure identified."

    overview = (
        facts.get("readme_summary")
        or f"Repository containing {facts.get('total_modules', 0)} indexed modules across {facts.get('total_edges', 0)} dependency edges."
    )

    cycles_count = facts.get("cycles_count", 0)
    cycle_notice = (
        f"> [!CAUTION]\n> **Circular Import Cycles Detected ({cycles_count})**:\n> Cycle clusters exist in the dependency tree. Avoid introducing cross-cycle imports."
        if cycles_count > 0
        else "> [!NOTE]\n> **Acyclic Architecture**: 0 circular dependency cycles detected across the dependency graph."
    )

    commit_sha = facts.get("commit_sha", "unknown")
    indexed_at = facts.get("indexed_at", "unknown")
    footer = f"\n---\n*Generated by DevLens AI | Commit: {commit_sha} | Indexed: {indexed_at}*"

    return f"""# {repo_name}: Onboarding Guide

## 1. Project Overview & Architecture
{overview}

- **Total Indexed Files**: {facts.get('total_modules', 0)} (Source Modules: {facts.get('source_modules_count', facts.get('total_modules', 0))})
- **Directed Graph Edges**: {facts.get('total_edges', 0)}
- **Architectural Health**:
{cycle_notice}

## 2. Quick Start
{quick_start_section}

### Dependencies
{deps_section}

## 3. Folder Map
{folder_map_lines}

## 4. Key Ingress Entry Points
{entry_lines}

## 5. Files to Handle Carefully (High Blast Radius)
{high_risk_lines}

## 6. Candidate Starter Tasks
{starter_lines}
{footer}
"""
