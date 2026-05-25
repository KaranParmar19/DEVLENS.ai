"""
DevLens AI — Blast Radius Tool
Performs depth-limited BFS on the reverse dependency graph to find all
files that would be affected (broken, needing updates) if a given file changes.

Architecture Note:
    The dependency graph is directed: A → B means "A imports B".
    The REVERSE graph flips these edges: B → A means "A depends on B".
    BFS on the reverse graph from file X gives: all files that (transitively)
    import X and would therefore be impacted by changes to X.
"""

from collections import deque
from langchain_core.tools import Tool


def make_blast_tool(graph_cache: dict) -> Tool:
    """
    Returns a LangChain Tool that computes blast radius via BFS.

    graph_cache is a dict with keys:
        'nodes': list of ArchNode dicts
        'edges': list of [source_id, target_id] pairs
    """

    def blast_radius(file_path: str) -> str:
        """
        Find all files that would be affected (broken) if the given file changes.
        Uses reverse dependency graph traversal (BFS up to depth 4).
        Also groups results by impact depth (direct, transitive-1, transitive-2, etc).
        Use this when asked 'what breaks if I change X?' or 'what is the blast radius of X?'
        Input: exact file path or node ID to analyse
        """
        nodes = {n["id"]: n for n in graph_cache.get("nodes", [])}
        edges = graph_cache.get("edges", [])

        # Resolve partial path match
        matched_id = None
        if file_path in nodes:
            matched_id = file_path
        else:
            for node_id in nodes:
                if file_path in node_id:
                    matched_id = node_id
                    break

        if not matched_id:
            return (
                f"File not found in dependency graph: `{file_path}`\n"
                "Tip: use query_graph tool to browse available nodes."
            )

        # Build reverse adjacency list: target → [sources that import it]
        reverse: dict[str, list[str]] = {}
        for src, tgt in edges:
            reverse.setdefault(tgt, []).append(src)

        # BFS with depth tracking (max depth = 4 to avoid whole-codebase results)
        MAX_DEPTH = 4
        visited: dict[str, int] = {}  # node_id → depth at which found
        queue: deque = deque([(matched_id, 0)])

        while queue:
            node, depth = queue.popleft()
            if depth >= MAX_DEPTH or node in visited:
                continue
            visited[node] = depth
            for neighbor in reverse.get(node, []):
                if neighbor not in visited:
                    queue.append((neighbor, depth + 1))

        # Remove the root node itself
        visited.pop(matched_id, None)

        if not visited:
            return (
                f"✅ **No blast radius** — `{matched_id}` has no dependents.\n"
                "This file is safe to change without impacting other modules."
            )

        # Group by depth level
        by_depth: dict[int, list[str]] = {}
        for node_id, depth in sorted(visited.items(), key=lambda x: (x[1], x[0])):
            by_depth.setdefault(depth, []).append(node_id)

        total = len(visited)
        risk_label = "🔴 HIGH" if total >= 10 else ("🟡 MEDIUM" if total >= 4 else "🟢 LOW")

        lines = [
            f"## Blast Radius: `{matched_id}`",
            f"**Risk:** {risk_label} — **{total} file(s) affected**",
            "",
        ]

        depth_labels = {
            1: "Direct dependents (imports this file directly)",
            2: "Transitive depth 2",
            3: "Transitive depth 3",
            4: "Transitive depth 4 (far blast radius)",
        }

        for depth, file_list in sorted(by_depth.items()):
            lines.append(f"**{depth_labels.get(depth, f'Depth {depth}')} ({len(file_list)}):**")
            for f in file_list:
                node = nodes.get(f, {})
                label = node.get("label", f)
                lines.append(f"  ⚠️  {f} ({label})")
            lines.append("")

        lines.append(
            "**Recommendation:** Before modifying this file, ensure tests exist "
            "for the files listed above."
        )

        return "\n".join(lines)

    return Tool(
        name="blast_radius",
        func=blast_radius,
        description=blast_radius.__doc__,
    )
