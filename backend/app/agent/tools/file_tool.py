"""
DevLens AI — File Reader Tool
Fetches all indexed code chunks for a specific file path from the vector store.
Used by the agent when it needs to see the full contents of a particular file.
"""

from langchain_core.tools import Tool
from app.rag.vector_store import VectorStore


def make_file_tool(vector_store: VectorStore) -> Tool:
    """
    Returns a LangChain Tool that fetches all chunks for a given file path.

    The tool searches for chunks matching the exact file path and stitches
    them back into a readable output. Useful when the agent needs to read
    a full file rather than a semantic snippet.
    """

    async def read_file(file_path: str) -> str:
        """
        Read the full indexed content of a specific file in the codebase.
        Returns all code chunks for that file, ordered by line number.
        Use when you need to see the full contents of a particular file.
        Input: exact file path as it appears in the repo (e.g. 'src/auth/jwt.py')
        """
        # Retrieve a broad set of results and filter by exact path
        results = await vector_store.get_chunks_by_file(file_path)

        if not results:
            # Fallback: try similarity search scoped to file path
            all_results = await vector_store.similarity_search(file_path, top_k=30)
            results = [r for r in all_results if r["file_path"] == file_path]

        if not results:
            return (
                f"File not found in index: `{file_path}`\n\n"
                "Tip: use the search_code tool to find files by content description."
            )

        # Sort chunks by start_line for coherent reading
        results.sort(key=lambda r: r.get("start_line") or 0)

        # Stitch chunks into a readable document
        language = results[0].get("language", "").lower() if results else ""
        parts = [
            f"# {file_path}\n",
            f"*Language: {language} | {len(results)} chunk(s)*\n",
            "---\n",
        ]

        for chunk in results:
            start = chunk.get("start_line", "?")
            end = chunk.get("end_line", "?")
            chunk_type = chunk.get("chunk_type", "code")
            parts.append(
                f"\n**Lines {start}–{end}** [{chunk_type}]\n"
                f"```{language}\n{chunk['content']}\n```"
            )

        full_content = "\n".join(parts)
        # Hard cap at 4000 chars to avoid context overflow
        if len(full_content) > 4000:
            full_content = full_content[:4000] + "\n\n*[content truncated — file too large]*"

        return full_content

    return Tool(
        name="read_file",
        func=read_file,
        coroutine=read_file,
        description=read_file.__doc__,
    )
