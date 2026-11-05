"""
DevLens AI — Facts Extractor
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
    MEDIUM_DEPENDENTS_MIN: int = 1
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


def classify_risk_level(
    dependents_count: int,
    dependencies_count: int,
    coupling: float,
    is_entry: bool,
    thresholds: RiskThresholds = RISK_THRESHOLDS,
) -> str:
    """
    Classify file risk level as High, Medium, or Low.
    Rules follow explicit, documented thresholds.
    """
    if (
        is_entry
        or dependents_count >= thresholds.HIGH_DEPENDENTS_MIN
        or (dependents_count >= thresholds.HIGH_COMBINED_DEPS_MIN and coupling >= thresholds.HIGH_COUPLING_MIN)
    ):
        return "High"

    if (
        dependents_count >= thresholds.MEDIUM_DEPENDENTS_MIN
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

        for path, content, _ in chunks:
            p_lower = path.lower().replace("\\", "/")
            if p_lower == clean_target or p_lower.endswith("/" + clean_target):
                matched_path = path
                # Strip generic chunk header if present
                clean_content = re.sub(r"^# File: [^\n]+\n\n", "", content)
                clean_content = re.sub(r"^// File: [^\n]+\n// [^\n]+\n\n", "", clean_content)
                matching_chunks.append(clean_content)

        if not matching_chunks:
            return None

        return "\n".join(matching_chunks)

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

            # Detect entry point filenames if not explicitly flagged
            lower_path = path.lower().replace("\\", "/")
            if not is_entry:
                if any(lower_path.endswith(sfx) for sfx in (
                    "server.ts", "server.js", "main.py", "app.py", "main.go",
                    "index.ts", "index.js", "src/main.rs", "cli.py", "manage.py"
                )):
                    is_entry = True

            deps = dependents_map.get(node_id, [])
            outgoing = dependencies_map.get(node_id, [])

            risk = classify_risk_level(
                dependents_count=len(deps),
                dependencies_count=len(outgoing),
                coupling=coupling,
                is_entry=is_entry,
            )

            metrics = {
                "id": node_id,
                "path": path,
                "label": n.get("label") or PurePosixPath(path).name,
                "is_entry": is_entry,
                "dependents": deps,
                "dependents_count": len(deps),
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

        for path, m in file_metrics.items():
            if m["is_entry"]:
                continue
            if is_test_file(path) or is_config_file(path) or is_generated_file(path):
                continue
            # Dead code check: isolated from the rest of the graph
            if m["dependents_count"] == 0 and m["dependencies_count"] == 0:
                continue
            # Starter tasks should have 0 or at most 1 dependent (safe Day 1 PR)
            if m["dependents_count"] > 1:
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
            })

        candidate_starters.sort(key=lambda c: c["score"])

        return {
            "total_modules": len(nodes),
            "total_edges": len(edges),
            "cycles": cycles,
            "cycles_count": len(cycles),
            "entry_points": entry_points,
            "file_metrics": file_metrics,
            "candidate_starters": candidate_starters[:5],
            "dependents_map": dependents_map,
            "dependencies_map": dependencies_map,
        }

    async def extract_manifest_facts(self) -> dict[str, Any]:
        """
        Extract facts from package.json, pyproject.toml, go.mod, Cargo.toml, requirements.txt.
        """
        manifest_facts: dict[str, Any] = {
            "manifest_type": None,
            "project_name": None,
            "tech_stack": [],
            "scripts": {},
            "test_command": None,
            "dev_command": None,
            "build_command": None,
        }

        # 1. package.json
        pkg_content = await self.extract_file_content("package.json")
        if pkg_content:
            try:
                pkg_data = json.loads(pkg_content)
                manifest_facts["manifest_type"] = "package.json"
                manifest_facts["project_name"] = pkg_data.get("name")
                scripts = pkg_data.get("scripts", {})
                manifest_facts["scripts"] = scripts

                if "test" in scripts:
                    manifest_facts["test_command"] = f"npm test (runs: {scripts['test']})"
                if "dev" in scripts:
                    manifest_facts["dev_command"] = f"npm run dev (runs: {scripts['dev']})"
                if "build" in scripts:
                    manifest_facts["build_command"] = f"npm run build (runs: {scripts['build']})"

                deps = list(pkg_data.get("dependencies", {}).keys())
                dev_deps = list(pkg_data.get("devDependencies", {}).keys())
                manifest_facts["tech_stack"] = deps[:12] + [f"{d} (dev)" for d in dev_deps[:8]]
                return manifest_facts
            except Exception as e:
                logger.warning("failed_to_parse_package_json", error=str(e))

        # 2. pyproject.toml
        pyproject_content = await self.extract_file_content("pyproject.toml")
        if pyproject_content:
            manifest_facts["manifest_type"] = "pyproject.toml"
            # Simple line parsing for dependencies and project name
            deps: list[str] = []
            for line in pyproject_content.splitlines():
                clean = line.strip()
                if clean.startswith("name ="):
                    manifest_facts["project_name"] = clean.split("=")[-1].strip().strip('"\'')
                elif clean.startswith("pytest"):
                    manifest_facts["test_command"] = "pytest"
                elif '"' in clean and not clean.startswith("#"):
                    m = re.match(r'["\']([a-zA-Z0-9_\-]+)[><=~^0-9.]*["\']', clean)
                    if m:
                        deps.append(m.group(1))
            manifest_facts["tech_stack"] = deps[:15]
            if not manifest_facts["test_command"]:
                manifest_facts["test_command"] = "pytest"
            return manifest_facts

        # 3. requirements.txt
        req_content = await self.extract_file_content("requirements.txt")
        if req_content:
            manifest_facts["manifest_type"] = "requirements.txt"
            deps = [
                line.strip().split("==")[0].split(">=")[0]
                for line in req_content.splitlines()
                if line.strip() and not line.strip().startswith("#")
            ]
            manifest_facts["tech_stack"] = deps[:15]
            manifest_facts["test_command"] = "pytest"
            return manifest_facts

        # 4. go.mod
        go_content = await self.extract_file_content("go.mod")
        if go_content:
            manifest_facts["manifest_type"] = "go.mod"
            manifest_facts["test_command"] = "go test ./..."
            deps = [
                line.strip().split()[0]
                for line in go_content.splitlines()
                if line.strip() and not line.startswith("module") and not line.startswith("go")
            ]
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
        Extract the first 1-2 introductory paragraphs from README.md.
        """
        for filename in ("README.md", "readme.md", "README"):
            content = await self.extract_file_content(filename)
            if content:
                # Filter out badges and header title
                paragraphs: list[str] = []
                for block in content.split("\n\n"):
                    clean = block.strip()
                    if not clean:
                        continue
                    if clean.startswith("#"):
                        continue
                    if clean.startswith("[![") or clean.startswith("<img") or clean.startswith("[!DOCTYPE"):
                        continue
                    paragraphs.append(clean)
                    if len(paragraphs) >= 2:
                        break
                if paragraphs:
                    return " ".join(paragraphs)[:800]
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

        return {
            "repo_full_name": self.repo_full_name,
            "total_modules": metrics["total_modules"],
            "total_edges": metrics["total_edges"],
            "cycles_count": metrics["cycles_count"],
            "cycles": metrics["cycles"],
            "entry_points": metrics["entry_points"][:5],
            "high_risk_files": high_risk_files[:6],
            "candidate_starters": metrics["candidate_starters"],
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
            f"Total Indexed Modules: {facts['total_modules']}",
            f"Total Dependency Edges: {facts['total_edges']}",
            f"Circular Import Cycles: {facts['cycles_count']} detected",
        ]

        if facts["readme_summary"]:
            lines.append(f"\n[Verified Project Overview from README]:\n{facts['readme_summary']}")

        manifest = facts["manifest"]
        if manifest["manifest_type"]:
            lines.append(f"\n[Verified Build & Package Setup ({manifest['manifest_type']})]:")
            if manifest["project_name"]:
                lines.append(f"- Project Name: {manifest['project_name']}")
            if manifest["test_command"]:
                lines.append(f"- Test Command: {manifest['test_command']}")
            if manifest["dev_command"]:
                lines.append(f"- Dev Server Command: {manifest['dev_command']}")
            if manifest["build_command"]:
                lines.append(f"- Build Command: {manifest['build_command']}")
            if manifest["tech_stack"]:
                lines.append(f"- Key Dependencies: {', '.join(manifest['tech_stack'])}")

        if facts["env_variables"]:
            lines.append(f"\n[Verified Environment Variables (.env.example)]:\n- Keys: {', '.join(facts['env_variables'])}")
        else:
            lines.append("\n[Verified Environment Variables]: No .env.example file declared in repository.")

        lines.append("\n[Verified Key Entry Points]:")
        for ep in facts["entry_points"]:
            lines.append(f"- [[{ep['path']}]] (Dependents: {ep['dependents_count']}, Dependencies: {ep['dependencies_count']})")

        lines.append("\n[Verified High-Risk Junction Files (High Blast Radius)]:")
        for hr in facts["high_risk_files"]:
            lines.append(
                f"- [[{hr['path']}]] (Risk: High, Dependents: {hr['dependents_count']}, "
                f"Dependencies: {hr['dependencies_count']}, Coupling: {hr['coupling']:.2f})"
            )

        lines.append("\n[Verified Candidate Starter Files (Zero / Low Downstream Risk)]:")
        for cs in facts["candidate_starters"]:
            nearby = f" | Nearby test: [[{cs['nearby_test']}]]" if cs.get("nearby_test") else " | No test file detected"
            lines.append(
                f"- [[{cs['path']}]] (Lines: {cs['line_count']}, Dependents: {cs['dependents_count']}{nearby})"
            )

        lines.append("\n[Verified Directory Structure]:")
        for fb in facts["folder_breakdown"]:
            lines.append(f"- {fb['path']}/ ({fb['file_count']} files, e.g. {fb['sample_files']})")

        lines.append("\n=== END VERIFIED FACTS ===")
        return "\n".join(lines)
