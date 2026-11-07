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
    """Check if a file path is a test file or in a test directory."""
    p = path.lower().replace("\\", "/")
    if p.startswith("tests/") or p.startswith("test/") or "/tests/" in p or "/test/" in p:
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
    """
    if not chunks:
        return ""
    if len(chunks) == 1:
        return chunks[0]

    reconstructed = chunks[0]
    for next_chunk in chunks[1:]:
        # Find the maximum overlap between the end of reconstructed and start of next_chunk
        max_overlap_search = min(len(reconstructed), len(next_chunk), 400)
        overlap_len = 0
        for l in range(max_overlap_search, 5, -1):
            if reconstructed.endswith(next_chunk[:l]):
                overlap_len = l
                break
        reconstructed += next_chunk[overlap_len:]
    return reconstructed


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
    thresholds: RiskThresholds = RISK_THRESHOLDS,
) -> str:
    """
    Classify file risk level as High, Medium, or Low.
    Rules follow explicit, documented thresholds:
    - An entry file with 0 dependents must NOT read "High".
    - Test importers are counted separately from source importers.
    """
    # An entry file with 0 dependents must not read "High"
    if is_entry and source_dependents_count == 0 and dependents_count == 0:
        return "Medium" if dependencies_count > 0 else "Low"

    # High blast radius:
    # 1. High source dependents count
    # 2. Or high overall dependents (e.g. heavily imported across test suite)
    # 3. Or entry point that has active callers/dependents
    # 4. Or significant combined dependents and coupling
    if (
        (is_entry and (source_dependents_count > 0 or dependents_count > 0))
        or source_dependents_count >= thresholds.HIGH_DEPENDENTS_MIN
        or dependents_count >= thresholds.HIGH_DEPENDENTS_MIN
        or (source_dependents_count >= thresholds.HIGH_COMBINED_DEPS_MIN and coupling >= thresholds.HIGH_COUPLING_MIN)
    ):
        return "High"

    if (
        is_entry
        or source_dependents_count >= thresholds.MEDIUM_DEPENDENTS_MIN
        or dependents_count >= thresholds.MEDIUM_DEPENDENTS_MIN
        or dependencies_count >= thresholds.MEDIUM_DEPENDENCIES_MIN
        or coupling >= thresholds.MEDIUM_COUPLING_MIN
    ):
        return "Medium"

    return "Low"


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
    ):
        self.db = db
        self.repo_id = repo_id
        self.repo_full_name = repo_full_name
        self.graph_cache = graph_cache or {}

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

        matching_chunks: list[str] = []
        matched_path: str | None = None
        seen_indices: set[int] = set()

        for path, content, idx in chunks:
            p_lower = path.lower().replace("\\", "/")
            if p_lower == clean_target or p_lower.endswith("/" + clean_target):
                if idx in seen_indices:
                    continue
                seen_indices.add(idx)
                matched_path = path
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
            # Dead code check: isolated from the rest of the graph
            if m["dependents_count"] == 0 and m["dependencies_count"] == 0:
                continue
            # Starter tasks should have 0 or at most 1 source dependent (safe Day 1 PR)
            if m["source_dependents_count"] > 1:
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
                "score": (0 if nearby_test else 100) + m["line_count"] + m["complexity"],
                "first_30_lines": None,
            })

        candidate_starters.sort(key=lambda c: c["score"])

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

    async def extract_manifest_facts(self) -> dict[str, Any]:
        """
        Extract facts from package.json, pyproject.toml, Makefile, go.mod, Cargo.toml, requirements.txt.
        Separates runtime dependencies from dev dependencies.
        Labels test commands as declared or inferred.
        """
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
                manifest_facts["tech_stack"] = runtime_deps[:10] + [f"{d} (dev)" for d in dev_deps[:6]]

                if "test" in scripts:
                    manifest_facts["test_command"] = f"npm test (runs: {scripts['test']})"
                    manifest_facts["test_command_type"] = "declared (package.json scripts.test)"
                elif "test" in makefile_targets:
                    manifest_facts["test_command"] = "make test"
                    manifest_facts["test_command_type"] = "declared (Makefile target)"
                elif "vitest" in dev_deps:
                    manifest_facts["test_command"] = "vitest run"
                    manifest_facts["test_command_type"] = "inferred (from devDependencies: vitest, not explicitly declared)"
                elif "jest" in dev_deps:
                    manifest_facts["test_command"] = "jest"
                    manifest_facts["test_command_type"] = "inferred (from devDependencies: jest, not explicitly declared)"

                if "dev" in scripts:
                    manifest_facts["dev_command"] = f"npm run dev (runs: {scripts['dev']})"
                    manifest_facts["run_command"] = f"npm run dev (runs: {scripts['dev']})"
                elif "start" in scripts:
                    manifest_facts["run_command"] = f"npm start (runs: {scripts['start']})"
                elif "build" in scripts:
                    manifest_facts["run_command"] = f"npm run build (runs: {scripts['build']})"

                if "build" in scripts:
                    manifest_facts["build_command"] = f"npm run build (runs: {scripts['build']})"
                elif "build" in makefile_targets:
                    manifest_facts["build_command"] = "make build"

                return manifest_facts
            except Exception as e:
                logger.warning("failed_to_parse_package_json", error=str(e))

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
                manifest_facts["tech_stack"] = runtime_deps if runtime_deps else dev_deps[:10]

                # Check declared install command
                if "tool.poetry" in py_data.get("tool", {}):
                    manifest_facts["install_command"] = "poetry install"
                else:
                    manifest_facts["install_command"] = "pip install -e ."

                # Check declared test runner - Makefile target takes precedence if present
                if "test" in makefile_targets:
                    manifest_facts["test_command"] = "make test"
                    manifest_facts["test_command_type"] = "declared (Makefile target)"
                elif "pytest" in py_data.get("tool", {}):
                    testpaths = py_data["tool"]["pytest"].get("ini_options", {}).get("testpaths", [])
                    testpaths_info = f" (testpaths: {', '.join(testpaths)})" if testpaths else ""
                    manifest_facts["test_command"] = f"pytest{testpaths_info}"
                    manifest_facts["test_command_type"] = "declared (pyproject.toml [tool.pytest])"
                elif "pytest" in dev_deps:
                    manifest_facts["test_command"] = "pytest"
                    manifest_facts["test_command_type"] = "inferred (from dev dependencies: pytest, not explicitly declared)"

                if "run" in makefile_targets:
                    manifest_facts["run_command"] = "make run"
                elif "serve" in makefile_targets:
                    manifest_facts["run_command"] = "make serve"

                if "build" in makefile_targets:
                    manifest_facts["build_command"] = "make build"

                return manifest_facts
            except Exception as e:
                logger.warning("failed_to_parse_pyproject_toml", error=str(e))

        # 3. requirements.txt
        req_content = await self.extract_file_content("requirements.txt")
        if req_content:
            manifest_facts["manifest_type"] = "requirements.txt"
            manifest_facts["install_command"] = "pip install -r requirements.txt"
            deps = []
            for line in req_content.splitlines():
                clean = line.strip()
                if clean and not clean.startswith("#"):
                    name = re.split(r"[><=~^;\[\s]", clean)[0].strip()
                    if name and name not in deps:
                        deps.append(name)
            manifest_facts["runtime_dependencies"] = deps[:15]
            manifest_facts["tech_stack"] = deps[:15]
            if "test" in makefile_targets:
                manifest_facts["test_command"] = "make test"
                manifest_facts["test_command_type"] = "declared (Makefile target)"
            elif "pytest" in deps:
                manifest_facts["test_command"] = "pytest"
                manifest_facts["test_command_type"] = "inferred (from requirements.txt: pytest, not explicitly declared)"
            if "run" in makefile_targets:
                manifest_facts["run_command"] = "make run"
            elif "serve" in makefile_targets:
                manifest_facts["run_command"] = "make serve"
            if "build" in makefile_targets:
                manifest_facts["build_command"] = "make build"
            return manifest_facts

        # 4. Standalone Makefile
        if makefile_content and ("test" in makefile_targets or "build" in makefile_targets):
            manifest_facts["manifest_type"] = "Makefile"
            manifest_facts["install_command"] = "make install" if "install" in makefile_targets else None
            if "test" in makefile_targets:
                manifest_facts["test_command"] = "make test"
                manifest_facts["test_command_type"] = "declared (Makefile target)"
            if "build" in makefile_targets:
                manifest_facts["build_command"] = "make build"
            if "run" in makefile_targets:
                manifest_facts["run_command"] = "make run"
            elif "serve" in makefile_targets:
                manifest_facts["run_command"] = "make serve"
            return manifest_facts

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
            manifest_facts["runtime_dependencies"] = deps[:10]
            manifest_facts["tech_stack"] = deps[:10]
            return manifest_facts

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
                        if key:
                            keys.append(key)
                if keys:
                    return keys
        return []

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
            folder_map.append({
                "path": d,
                "file_count": str(count),
                "sample_files": sample,
            })
        return folder_map

    async def assemble_verified_facts(self) -> dict[str, Any]:
        """
        Collect all computed facts into one single authoritative dictionary.
        """
        metrics = self.compute_graph_metrics()
        manifest = await self.extract_manifest_facts()
        env_vars = await self.extract_env_variables()
        readme_summary = await self.extract_readme_summary()
        folder_breakdown = self.compute_folder_breakdown()

        # Top high-risk files
        high_risk_files = [
            m for m in metrics["file_metrics"].values() if m["risk_level"] == "High"
        ]
        high_risk_files.sort(key=lambda m: m["dependents_count"], reverse=True)

        # Populate first 30 lines for each candidate starter file
        for cs in metrics.get("candidate_starters", []):
            content = await self.extract_file_content(cs["path"])
            if content and content.strip():
                snippet_lines = content.splitlines()[:30]
                cs["first_30_lines"] = "\n".join(snippet_lines)
            else:
                cs["first_30_lines"] = None

        return {
            "repo_full_name": self.repo_full_name,
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
            "high_risk_files": high_risk_files[:6],
            "candidate_starters": metrics["candidate_starters"],
            "starter_empty_reason": metrics.get("starter_empty_reason"),
            "manifest": manifest,
            "env_variables": env_vars,
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
        if manifest["manifest_type"]:
            lines.append(f"\n[Verified Build & Package Setup ({manifest['manifest_type']})]:")
            if manifest["project_name"]:
                lines.append(f"- Project Name: {manifest['project_name']}")
            if manifest.get("install_command"):
                lines.append(f"- Install Command: {manifest['install_command']}")
            if manifest.get("run_command"):
                lines.append(f"- Run Command: {manifest['run_command']}")
            if manifest["test_command"]:
                cmd_type = f" [{manifest.get('test_command_type')}]" if manifest.get("test_command_type") else ""
                lines.append(f"- Test Command: {manifest['test_command']}{cmd_type}")
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

        if facts["env_variables"]:
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
        for fb in facts["folder_breakdown"]:
            lines.append(f"- {fb['path']}/ ({fb['file_count']} files, e.g. {fb['sample_files']})")

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
    if manifest.get("install_command"):
        quick_start_lines.append(f"- **Install**: `{manifest['install_command']}`")
    if manifest.get("run_command"):
        quick_start_lines.append(f"- **Run/Dev**: `{manifest['run_command']}`")
    if manifest.get("test_command"):
        cmd_type = f" ({manifest.get('test_command_type')})" if manifest.get("test_command_type") else ""
        quick_start_lines.append(f"- **Test**: `{manifest['test_command']}`{cmd_type}")
    if manifest.get("build_command"):
        quick_start_lines.append(f"- **Build**: `{manifest['build_command']}`")

    cmd_lines = []
    if manifest.get("runtime_dependencies"):
        cmd_lines.append(f"- **Runtime Dependencies**: {', '.join(manifest['runtime_dependencies'][:12])}")
    elif manifest.get("tech_stack"):
        cmd_lines.append(f"- **Dependencies**: {', '.join(manifest['tech_stack'][:12])}")
    if manifest.get("dev_dependencies"):
        cmd_lines.append(f"- **Dev Dependencies**: {', '.join(manifest['dev_dependencies'][:8])}")

    quick_start_section = "\n".join(quick_start_lines) if quick_start_lines else "- No setup commands declared."
    deps_section = "\n".join(cmd_lines) if cmd_lines else "- No external dependencies declared."

    folder_map_lines = "\n".join(
        f"- `{fb['path']}/` ({fb['file_count']} files, e.g. {fb['sample_files']})"
        for fb in facts.get("folder_breakdown", [])
    ) or "- No directory structure identified."

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
"""
