"""
DevLens AI — Graph Query Tool
Queries the dependency graph for a specific file to reveal its
import relationships (what it depends on) and reverse relationships
(what depends on it).
"""

from langchain_core.tools import Tool


def make_graph_tool(graph_cache: dict) -> Tool:
    """
    Returns a LangChain Tool that queries the dependency graph.

    graph_cache is a dict with keys:
        'nodes': list of ArchNode dicts
        'edges': list of [source_id, target_id] pairs
    """

    def query_graph(file_path: str) -> str:
        """
        Query the dependency graph for a specific file.
        Returns which files it imports (dependencies) and which files import it (dependents).
        Use this to understand module relationships and coupling.
        Input: exact file path as it appears in the repo (e.g. 'src/auth/jwt.py')
        """
        nodes = {n["id"]: n for n in graph_cache.get("nodes", [])}
        edges = graph_cache.get("edges", [])

        # Support both exact path match and partial match
        matched_id = None
        if file_path in nodes:
            matched_id = file_path
        else:
            # Try partial match on path or label
            for node_id, node in nodes.items():
                if file_path in node_id or file_path in node.get("path", ""):
                    matched_id = node_id
                    break

        if not matched_id:
            # List closest matches for the agent to try
            all_ids = list(nodes.keys())[:15]
            return (
                f"File not found in dependency graph: `{file_path}`\n\n"
                f"Available nodes (first 15):\n"
                + "\n".join(f"  • {nid}" for nid in all_ids)
            )

        node = nodes[matched_id]
        deps = [e[1] for e in edges if e[0] == matched_id]
        dependents = [e[0] for e in edges if e[1] == matched_id]

        lines = [
            f"## Dependency Graph: `{matched_id}`",
            f"**Label:** {node.get('label', matched_id)}",
            f"**Path:** {node.get('path', matched_id)}",
            f"**Description:** {node.get('desc', 'N/A')}",
            "",
        ]

        if deps:
            lines.append(f"**Imports ({len(deps)} files):**")
            for d in sorted(deps):
                lines.append(f"  → {d}")
        else:
            lines.append("**Imports:** none (leaf node)")

        lines.append("")

        if dependents:
            lines.append(f"**Imported by ({len(dependents)} files):**")
            for d in sorted(dependents):
                lines.append(f"  ← {d}")
        else:
            lines.append("**Imported by:** none (dead code or entry point)")

        # Add complexity hint if available
        complexity = node.get("complexity")
        coupling = node.get("coupling")
        if complexity is not None or coupling is not None:
            lines.append("")
            lines.append(
                f"**Metrics:** complexity={complexity:.2f}, coupling={coupling:.2f}"
                if complexity is not None and coupling is not None
                else ""
            )

        return "\n".join(lines)

    return Tool(
        name="query_graph",
        func=query_graph,
        description=query_graph.__doc__,
    )
