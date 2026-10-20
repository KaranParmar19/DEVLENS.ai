"""DevLens AI — Search Tool: semantic & hybrid vector search over indexed code chunks."""

from langchain_core.tools import Tool
from app.rag.vector_store import VectorStore


def make_search_tool(vector_store: VectorStore) -> Tool:
    async def search_code(query: str) -> str:
        """
        Semantically search the indexed codebase for code relevant to the query.
        Returns the top matching code chunks with file paths and line numbers.
        Use this first when answering questions about how something works or where a symbol is defined.
        """
        results = await vector_store.similarity_search(query, top_k=6)
        if not results:
            return "No relevant code found for this query."
        parts = []
        for r in results:
            loc = f"lines {r['start_line']}-{r['end_line']}" if r.get("start_line") else ""
            symbol = f" (symbol: `{r['symbol_name']}`)" if r.get("symbol_name") else ""
            parts.append(
                f"**[[{r['file_path']}]]** {loc}{symbol} (score: {r['similarity']})\n"
                f"```{r['language'].lower()}\n{r['content'][:600]}\n```"
            )
        return "\n\n---\n\n".join(parts)

    return Tool(
        name="search_code",
        func=search_code,
        coroutine=search_code,
        description=search_code.__doc__,
    )

