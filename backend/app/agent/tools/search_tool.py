"""DevLens AI — Search Tool: semantic vector search over indexed code chunks."""

from langchain_core.tools import Tool
from app.rag.vector_store import VectorStore


def make_search_tool(vector_store: VectorStore) -> Tool:
    async def search_code(query: str) -> str:
        """
        Semantically search the indexed codebase for code relevant to the query.
        Returns the top matching code chunks with file paths and line numbers.
        Use this first when answering questions about how something works.
        """
        results = await vector_store.similarity_search(query, top_k=6)
        if not results:
            return "No relevant code found for this query."
        parts = []
        for r in results:
            loc = f"lines {r['start_line']}-{r['end_line']}" if r.get("start_line") else ""
            parts.append(
                f"**{r['file_path']}** {loc} (similarity: {r['similarity']})\n"
                f"```{r['language'].lower()}\n{r['content'][:600]}\n```"
            )
        return "\n\n---\n\n".join(parts)

    return Tool(name="search_code", func=search_code, coroutine=search_code,
                description=search_code.__doc__)


# ── File Tool ────────────────────────────────────────────────────────────────

def make_file_tool(vector_store: VectorStore) -> Tool:
    async def read_file(file_path: str) -> str:
        """
        Read all indexed chunks for a specific file path.
        Use when you need to see the full contents of a particular file.
        Input: exact file path (e.g. 'src/services/auth.service.ts')
        """
        results = await vector_store.similarity_search(f"file:{file_path}", top_k=20)
        file_chunks = [r for r in results if r["file_path"] == file_path]
        if not file_chunks:
            return f"File not found in index: {file_path}"
        content = "\n".join(c["content"] for c in file_chunks)
        return f"**{file_path}**\n\n{content[:3000]}"

    return Tool(name="read_file", func=read_file, coroutine=read_file,
                description=read_file.__doc__)


# ── Graph Tool ───────────────────────────────────────────────────────────────

def make_graph_tool(graph_cache: dict) -> Tool:
    def query_graph(file_path: str) -> str:
        """
        Query the dependency graph for a specific file.
        Returns which files it imports (dependencies) and which files import it (dependents).
        Use this to understand module relationships.
        Input: exact file path
        """
        nodes = {n["id"]: n for n in graph_cache.get("nodes", [])}
        edges = graph_cache.get("edges", [])

        if file_path not in nodes:
            return f"File not found in dependency graph: {file_path}"

        deps = [e[1] for e in edges if e[0] == file_path]
        dependents = [e[0] for e in edges if e[1] == file_path]

        return (
            f"**{file_path}**\n\n"
            f"Imports ({len(deps)}):\n" + "\n".join(f"  → {d}" for d in deps) + "\n\n"
            f"Imported by ({len(dependents)}):\n" + "\n".join(f"  ← {d}" for d in dependents)
        )

    return Tool(name="query_graph", func=query_graph, description=query_graph.__doc__)


# ── Blast Radius Tool ────────────────────────────────────────────────────────

def make_blast_tool(graph_cache: dict) -> Tool:
    def blast_radius(file_path: str) -> str:
        """
        Find all files that would be affected (broken) if the given file changes.
        Uses reverse dependency graph traversal (BFS, depth 3).
        Use this when asked 'what breaks if I change X?'
        Input: exact file path to analyse
        """
        edges = graph_cache.get("edges", [])
        # Build reverse adjacency
        reverse: dict[str, list[str]] = {}
        for src, tgt in edges:
            reverse.setdefault(tgt, []).append(src)

        # BFS on reverse graph
        visited: set[str] = set()
        queue = [(file_path, 0)]
        while queue:
            node, depth = queue.pop(0)
            if depth >= 3 or node in visited:
                continue
            visited.add(node)
            for neighbor in reverse.get(node, []):
                queue.append((neighbor, depth + 1))

        visited.discard(file_path)
        if not visited:
            return f"No files depend on {file_path} — safe to change in isolation."

        affected = sorted(visited)
        return (
            f"**{len(affected)} files affected by changes to `{file_path}`:**\n\n"
            + "\n".join(f"  ⚠️  {f}" for f in affected)
        )

    return Tool(name="blast_radius", func=blast_radius, description=blast_radius.__doc__)
