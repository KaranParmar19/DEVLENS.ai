"""
DevLens AI — Graph Builder
Constructs a directed dependency graph from the code chunks.
Parses import statements for each language, builds a NetworkX DiGraph,
computes Fruchterman-Reingold layout (normalised to 0-100% canvas coords),
and adds complexity/coupling scores to each node.

BUG-08 FIX: build() now takes no arguments — uses self.files set in __init__.
M-01  FIX:  JS/TS relative path resolution uses posixpath instead of
             pathlib.Path so it works correctly on Windows hosts.
"""

import re
import math
import posixpath                 # ← M-01: platform-independent path handling
import structlog
import networkx as nx
from pathlib import Path

from app.core.language_detector import detect_language
from app.schemas.repository import ArchNode, ArchEdge, GraphData, GraphMeta

logger = structlog.get_logger(__name__)


# ── Import Pattern Extractors ─────────────────────────────────────────────

def _extract_python_imports(content: str, file_path: str, all_paths: set[str]) -> list[str]:
    """Extract imported local modules from Python source."""
    deps = []
    for match in re.finditer(
        r"^(?:from|import)\s+([\w.]+)", content, re.MULTILINE
    ):
        mod = match.group(1).replace(".", "/")
        for candidate in [f"{mod}.py", f"{mod}/__init__.py"]:
            if candidate in all_paths:
                deps.append(candidate)
    return list(set(deps))


def _extract_js_ts_imports(content: str, file_path: str, all_paths: set[str]) -> list[str]:
    """
    Extract local imports from JS/TS (handles relative paths).
    M-01 FIX: Uses posixpath so resolution works on Windows too.
    """
    deps = []
    # Use posixpath: all repo paths use forward slashes regardless of host OS
    base_dir = posixpath.dirname(file_path.replace("\\", "/"))

    for match in re.finditer(
        r"""(?:import|from|require)\s*\(?['"](\.\.?/[^'"]+)['"]\)?""", content
    ):
        rel = match.group(1)
        resolved = posixpath.normpath(posixpath.join(base_dir, rel))

        for ext in [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]:
            if resolved.endswith(ext):
                candidate = resolved
            else:
                candidate = resolved + ext
            if candidate in all_paths:
                deps.append(candidate)
                break

    return list(set(deps))


def _extract_go_imports(content: str, file_path: str, all_paths: set[str]) -> list[str]:
    """Extract local Go imports (those matching repo file stems)."""
    deps = []
    in_import_block = False
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("import ("):
            in_import_block = True
        elif in_import_block and stripped == ")":
            in_import_block = False
        elif in_import_block or stripped.startswith("import "):
            match = re.search(r'"([^"]+)"', stripped)
            if match:
                pkg = match.group(1).split("/")[-1]
                for path in all_paths:
                    if Path(path).stem == pkg:
                        deps.append(path)
    return list(set(deps))


IMPORT_EXTRACTORS = {
    "Python":     _extract_python_imports,
    "JavaScript": _extract_js_ts_imports,
    "TypeScript": _extract_js_ts_imports,
    "Go":         _extract_go_imports,
}


# ── Graph Builder ─────────────────────────────────────────────────────────

class GraphBuilder:
    """
    Builds a directed dependency graph from repo file contents.
    Nodes = files; Edges = import dependencies.

    Usage:
        builder = GraphBuilder(files)      # files: {path: content}
        graph_data = builder.build()       # returns GraphData (Pydantic model)
        affected = builder.get_blast_radius("src/db.py", depth=3)
    """

    def __init__(self, files: dict[str, str]):
        """
        files: {file_path: file_content} for all ingested files.
        """
        self.files = files
        self.all_paths = set(files.keys())
        self.graph = nx.DiGraph()

    def build(self) -> GraphData:   # ← BUG-08 FIX: no argument; uses self.files
        """
        Main build pipeline:
        1. Add all files as nodes
        2. Parse imports → add edges
        3. Compute layout + metrics
        4. Return GraphData (frontend-ready)
        """
        self._add_nodes()
        self._add_edges()
        positions = self._compute_layout()
        return self._build_graph_data(positions)

    def _add_nodes(self) -> None:
        for path, content in self.files.items():
            language = detect_language(path)
            self.graph.add_node(
                path,
                language=language,
                line_count=content.count("\n") + 1,
            )

    def _add_edges(self) -> None:
        for path, content in self.files.items():
            language = detect_language(path)
            extractor = IMPORT_EXTRACTORS.get(language)
            if not extractor:
                continue
            try:
                deps = extractor(content, path, self.all_paths)
                for dep in deps:
                    if dep != path and dep in self.graph:
                        self.graph.add_edge(path, dep)
            except Exception as exc:
                logger.debug("import_extraction_failed", path=path, error=str(exc))

    def _compute_layout(self) -> dict[str, tuple[float, float]]:
        """
        Fruchterman-Reingold spring layout, normalised to 5-95% canvas range.
        Falls back to circular layout for tiny graphs.
        """
        node_count = len(self.graph.nodes)
        if node_count == 0:
            return {}
        if node_count == 1:
            return {list(self.graph.nodes)[0]: (50.0, 50.0)}

        try:
            k = 2.0 / math.sqrt(node_count) if node_count > 1 else 1.0
            pos = nx.spring_layout(self.graph, seed=42, k=k, iterations=50)
        except Exception:
            pos = nx.circular_layout(self.graph)

        # Normalise to [5, 95] percentage range
        xs = [v[0] for v in pos.values()]
        ys = [v[1] for v in pos.values()]
        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)
        x_range = (x_max - x_min) or 1.0
        y_range = (y_max - y_min) or 1.0

        return {
            node: (
                round(((x - x_min) / x_range) * 90 + 5, 1),
                round(((y - y_min) / y_range) * 90 + 5, 1),
            )
            for node, (x, y) in pos.items()
        }

    def _compute_metrics(self) -> dict[str, dict]:
        """Compute coupling (degree) and complexity score per node."""
        max_degree = max(
            (self.graph.degree(n) for n in self.graph.nodes), default=1
        ) or 1
        max_lines = max(
            (self.graph.nodes[n].get("line_count", 0) for n in self.graph.nodes), default=1
        ) or 1

        return {
            node: {
                "coupling": round(self.graph.degree(node) / max_degree, 3),
                "complexity": round(
                    self.graph.nodes[node].get("line_count", 0) / max_lines, 3
                ),
                "is_entry": (
                    self.graph.in_degree(node) == 0
                    and self.graph.out_degree(node) > 0
                ),
            }
            for node in self.graph.nodes
        }

    def _build_graph_data(self, positions: dict[str, tuple[float, float]]) -> GraphData:
        metrics = self._compute_metrics()

        nodes = []
        for path in self.graph.nodes:
            x, y = positions.get(path, (50.0, 50.0))
            m = metrics.get(path, {})
            lang = self.graph.nodes[path].get("language", "Unknown")
            label = Path(path).stem[:24]        # Short label for the node

            nodes.append(ArchNode(
                id=path,
                x=x,
                y=y,
                label=label,
                path=path,
                desc=f"{lang} · {self.graph.nodes[path].get('line_count', 0)} lines",
                complexity=m.get("complexity", 0.0),
                coupling=m.get("coupling", 0.0),
                is_entry=m.get("is_entry", False),
                language=lang,
                line_count=self.graph.nodes[path].get("line_count", 0),
            ))

        edges = [[u, v] for u, v in self.graph.edges]

        return GraphData(
            nodes=nodes,
            edges=edges,
            meta=GraphMeta(
                total_files=len(self.files),
                total_nodes=len(nodes),
                total_edges=len(edges),
                languages={},           # Populated by caller after build()
                is_monorepo=False,      # Populated by caller after build()
                commit_sha=None,        # Populated by caller after build()
            ),
        )

    # ── Blast Radius ──────────────────────────────────────────────────────

    def get_blast_radius(self, file_path: str, depth: int = 3) -> list[str]:
        """
        BFS on the REVERSE graph to find all files that depend on file_path.
        Returns paths of files that would be affected if file_path changes.
        """
        if file_path not in self.graph:
            return []
        reverse = self.graph.reverse(copy=True)
        visited: set[str] = set()
        queue = [(file_path, 0)]
        while queue:
            node, d = queue.pop(0)
            if d >= depth or node in visited:
                continue
            visited.add(node)
            for neighbor in reverse.neighbors(node):
                queue.append((neighbor, d + 1))
        visited.discard(file_path)
        return list(visited)
