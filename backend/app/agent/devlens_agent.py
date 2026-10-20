"""
DevLens AI — LangChain ReAct Agent
The AI brain of DevLens. Uses OpenAI-compatible LLMs (GPT-4o, Claude, Groq, Ollama, DeepSeek)
with custom tools grounded in PostgreSQL pgvector code chunks and NetworkX dependency graphs.
"""

import re
import uuid
import asyncio
import structlog
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.agent.prompts import DEVLENS_SYSTEM_PROMPT
from app.agent.tools.search_tool import make_search_tool
from app.agent.tools.file_tool import make_file_tool
from app.agent.tools.graph_tool import make_graph_tool
from app.agent.tools.blast_tool import make_blast_tool
from app.rag.vector_store import VectorStore

logger = structlog.get_logger(__name__)
settings = get_settings()


class DevLensAgent:
    """
    Wraps a tool-calling agent grounded in the repository's AST index.
    Scoped to a single repository session — tools are bound to the repo's vector store
    and NetworkX dependency graph cache.
    """

    def __init__(
        self,
        db: AsyncSession,
        repo_id: uuid.UUID,
        repo_full_name: str,
        graph_cache: dict | None = None,
    ):
        self.db = db
        self.repo_id = repo_id
        self.repo_full_name = repo_full_name
        self.graph_cache = graph_cache or {}
        self.last_sources: list[str] = []

        # ── LLM Configuration (OpenAI, OpenRouter, Groq, Ollama, DeepSeek) ────
        llm_kwargs = {
            "model": settings.openai_chat_model,
            "openai_api_key": settings.openai_api_key,
            "temperature": 0.2,
            "max_tokens": 4096,
            "streaming": True,
        }
        if settings.openai_api_base:
            llm_kwargs["base_url"] = settings.openai_api_base

        self.llm = ChatOpenAI(**llm_kwargs)

        # ── Vector Store (pgvector + hybrid search) ───────────────────────────
        self.vector_store = VectorStore(db, repo_id)

        # ── Grounded Tools ────────────────────────────────────────────────────
        self.tools = [
            make_search_tool(self.vector_store),
            make_file_tool(self.vector_store),
            make_graph_tool(self.graph_cache),
            make_blast_tool(self.graph_cache),
        ]
        self._tool_map = {t.name: t for t in self.tools}

    # ── Context Retrieval & Grounding ─────────────────────────────────────────

    async def _retrieve_grounded_context(self, query: str) -> tuple[str, list[str]]:
        """
        Inspect query intent and fetch genuine codebase context from PostgreSQL & graph_cache.
        Returns (context_text, list_of_cited_file_paths).
        """
        sources: set[str] = set()
        context_sections: list[str] = []
        nodes = self.graph_cache.get("nodes", [])
        node_map = {n["id"]: n for n in nodes}
        all_paths = list(node_map.keys())

        query_lower = query.lower().strip()

        # 0. Slash Command Parsing & Keyword Normalization
        clean_query = query.strip()
        if clean_query.startswith("/blast"):
            arg = clean_query[len("/blast"):].strip()
            query_lower = f"blast radius breaking changes impact of {arg}".lower() if arg else "blast radius and high impact modules"
        elif clean_query.startswith("/cycles"):
            query_lower = "detect circular dependency cycles in modules"
        elif clean_query.startswith("/explain"):
            arg = clean_query[len("/explain"):].strip()
            query_lower = f"explain architecture role dependencies of {arg}".lower() if arg else "explain core architecture overview"
        elif clean_query.startswith("/test"):
            arg = clean_query[len("/test"):].strip()
            query_lower = f"generate unit tests for {arg}".lower() if arg else "generate unit tests"
        elif clean_query.startswith("/onboarding"):
            query_lower = "onboarding guide key entry points architecture overview"

        # 1. Check for specific file mentions in the query
        target_file = None
        for path in all_paths:
            stem = path.split("/")[-1]
            if stem.lower() in query_lower or path.lower() in query_lower:
                target_file = path
                sources.add(path)
                break

        # 2. Blast Radius or Breaking Change Query
        if any(w in query_lower for w in ("blast", "break", "impact", "delete", "change")):
            if target_file:
                blast_tool = self._tool_map.get("blast_radius")
                if blast_tool:
                    try:
                        blast_res = blast_tool.func(target_file)
                        context_sections.append(f"### Blast Radius Analysis for `{target_file}`:\n{blast_res}")
                        # Extract affected files
                        for f in all_paths:
                            if f in blast_res:
                                sources.add(f)
                    except Exception as e:
                        logger.warning("context_blast_failed", error=str(e))
            elif nodes:
                # Top high-coupling node context
                top_coupled = sorted(nodes, key=lambda n: n.get("coupling", 0), reverse=True)[:3]
                sample_blast = "\n".join(
                    f"- `{n['id']}` (coupling: {n.get('coupling', 0)}, complexity: {n.get('complexity', 1)})"
                    for n in top_coupled
                )
                context_sections.append(f"### Highest Impact / Central Modules:\n{sample_blast}")

        # 3. Circular Dependencies Query
        if any(w in query_lower for w in ("cycle", "circular", "loop")):
            cycles = self.graph_cache.get("meta", {}).get("cycles", [])
            if cycles:
                cycle_lines = [f"- Cycle {i+1}: " + " → ".join(f"`{p}`" for p in c) for i, c in enumerate(cycles[:5])]
                context_sections.append("### Detected Circular Dependencies:\n" + "\n".join(cycle_lines))
                for c in cycles[:5]:
                    for p in c:
                        sources.add(p)
            else:
                context_sections.append("### Circular Dependency Check:\n0 circular dependency cycles detected. The dependency graph is a strictly ordered Directed Acyclic Graph (DAG).")

        # 4. Entry Points & Architecture Overview
        if any(w in query_lower for w in ("entry", "start", "main", "architecture", "overview")):
            entry_nodes = [n for n in nodes if n.get("is_entry")]
            if entry_nodes:
                entry_lines = [f"- `[[{n['id']}]]` ({n.get('desc', 'Entry module')})" for n in entry_nodes[:6]]
                context_sections.append("### Architectural Entry Points:\n" + "\n".join(entry_lines))
                for n in entry_nodes[:6]:
                    sources.add(n["id"])

        # 4b. Target File Source Injection for Unit Test Generation
        if "test" in query_lower and target_file:
            try:
                file_tool = self._tool_map.get("read_file")
                if file_tool:
                    file_src = file_tool.func(target_file)
                    ext = target_file.split(".")[-1] if "." in target_file else "txt"
                    context_sections.append(
                        f"### Source Code for Unit Test Generation (`{target_file}`):\n```{ext}\n{file_src[:1400]}\n```"
                    )
            except Exception as e:
                logger.warning("context_test_fetch_failed", error=str(e))

        # 5. Hybrid Semantic & Symbol Search
        try:
            chunks = await self.vector_store.similarity_search(query, top_k=4)
            if chunks:
                chunk_parts = []
                for c in chunks:
                    sources.add(c["file_path"])
                    loc = f"lines {c['start_line']}–{c['end_line']}" if c.get("start_line") else ""
                    sym = f" [symbol: {c['symbol_name']}]" if c.get("symbol_name") else ""
                    chunk_parts.append(
                        f"#### File: [[{c['file_path']}]] {loc}{sym}\n```{c.get('language', '').lower()}\n{c['content'][:700]}\n```"
                    )
                context_sections.append("### Relevant Code Chunks from Index:\n" + "\n\n".join(chunk_parts))
        except Exception as e:
            logger.warning("context_search_failed", error=str(e))

        context_text = "\n\n".join(context_sections)
        return context_text, list(sources)

    # ── Deterministic AST Engine Fallback ─────────────────────────────────────

    def _generate_deterministic_fallback(self, query: str, context_text: str, sources: list[str]) -> str:
        """
        Generates an honest, grounded analysis from local AST chunks & NetworkX graph
        when external LLM keys are unconfigured or unavailable.
        """
        lines = [
            f"### Analysis for `{self.repo_full_name}`",
            "*(Answer generated via local DevLens AST Index & Dependency Graph)*\n",
        ]

        if context_text.strip():
            lines.append(context_text)
        else:
            nodes = self.graph_cache.get("nodes", [])
            edges = self.graph_cache.get("edges", [])
            lines.append(
                f"**Repository Topological Summary:**\n"
                f"- **Total Indexed Modules**: {len(nodes)}\n"
                f"- **Dependency Edges**: {len(edges)}\n"
                f"- **Analyzed Query**: *\"{query}\"*\n"
            )
            if nodes:
                lines.append("**Sample Key Modules:**")
                for n in nodes[:5]:
                    lines.append(f"- `[[{n['id']}]]` — {n.get('desc', 'N/A')}")

        lines.append(
            "\n---\n"
            "💡 *Tip: DevLens AI is operating in AST Engine mode. To enable conversational synthesis, "
            "set `OPENAI_API_KEY` (or compatible endpoint via `OPENAI_API_BASE`) in `backend/.env`.*"
        )
        return "\n".join(lines)

    # ── Synchronous / REST Chat ───────────────────────────────────────────────

    async def chat(
        self,
        message: str,
        history: list[dict],
    ) -> tuple[str, list[str]]:
        """
        Single-turn Q&A with conversation history.
        Executes tools in a ReAct loop and returns (reply_text, cited_sources).
        """
        context_text, retrieved_sources = await self._retrieve_grounded_context(message)
        system = DEVLENS_SYSTEM_PROMPT.format(repo_full_name=self.repo_full_name)
        if context_text:
            system += f"\n\nActive Codebase Grounding Context:\n{context_text}"

        messages = [HumanMessage(content=system)]
        for turn in history[-10:]:
            if turn["role"] == "user":
                messages.append(HumanMessage(content=turn["content"]))
            else:
                messages.append(AIMessage(content=turn["content"]))
        messages.append(HumanMessage(content=message))

        collected_sources: set[str] = set(retrieved_sources)
        full_reply = ""

        is_gemini = "generativelanguage.googleapis.com" in settings.openai_api_base or settings.openai_api_key.startswith("AQ.")

        if is_gemini:
            # Direct prompt invocation with rich grounded context (avoids Gemini function-calling proxy schema quirks)
            try:
                response = await self.llm.ainvoke(messages)
                full_reply = response.content or ""
            except Exception as exc:
                logger.warning("gemini_chat_failed_using_grounded_fallback", error=str(exc))
                full_reply = self._generate_deterministic_fallback(message, context_text, list(collected_sources))
        else:
            try:
                llm_with_tools = self.llm.bind_tools(self.tools)

                # Tool calling loop (up to 3 iterations)
                for _ in range(3):
                    response = await llm_with_tools.ainvoke(messages)
                    messages.append(response)

                    if not getattr(response, "tool_calls", None):
                        full_reply = response.content or ""
                        break

                    for tc in response.tool_calls:
                        t_name = tc["name"]
                        t_args = tc.get("args", {})
                        tool = self._tool_map.get(t_name)

                        if "file_path" in t_args:
                            collected_sources.add(t_args["file_path"])

                        if tool:
                            try:
                                if getattr(tool, "coroutine", None):
                                    t_res = await tool.coroutine(**t_args)
                                elif asyncio.iscoroutinefunction(tool.func):
                                    t_res = await tool.func(**t_args)
                                else:
                                    t_res = tool.func(**t_args)
                            except Exception as tool_err:
                                t_res = f"Tool execution failed: {tool_err}"
                        else:
                            t_res = f"Tool '{t_name}' not recognized."

                        # Extract any file paths from tool result
                        for f in re.findall(r"\[\[(.*?)\]\]", str(t_res)):
                            collected_sources.add(f)

                        messages.append(ToolMessage(content=str(t_res), tool_call_id=tc["id"]))
                else:
                    final_res = await self.llm.ainvoke(messages)
                    full_reply = final_res.content or ""

            except Exception as exc:
                logger.warning("agent_llm_failed_using_grounded_fallback", error=str(exc))
                full_reply = self._generate_deterministic_fallback(message, context_text, list(collected_sources))

        # Extract any [[file_path]] citations from final response
        for citation in re.findall(r"\[\[(.*?)\]\]", full_reply):
            collected_sources.add(citation)

        self.last_sources = sorted(list(collected_sources))
        return full_reply, self.last_sources

    # ── WebSocket Streaming Chat ──────────────────────────────────────────────

    async def stream_chat(
        self,
        message: str,
        history: list[dict],
    ):
        """
        Token-by-token streaming generator.
        Grounded in retrieved AST context. Yields str tokens as they arrive.
        Populates self.last_sources for StreamDone delivery.
        """
        context_text, retrieved_sources = await self._retrieve_grounded_context(message)
        collected_sources: set[str] = set(retrieved_sources)

        system = DEVLENS_SYSTEM_PROMPT.format(repo_full_name=self.repo_full_name)
        if context_text:
            system += f"\n\nActive Codebase Grounding Context:\n{context_text}"

        messages = [HumanMessage(content=system)]
        for turn in history[-10:]:
            if turn["role"] == "user":
                messages.append(HumanMessage(content=turn["content"]))
            else:
                messages.append(AIMessage(content=turn["content"]))
        messages.append(HumanMessage(content=message))

        streamed_chunks = []

        try:
            async for chunk in self.llm.astream(messages):
                if hasattr(chunk, "content") and chunk.content:
                    streamed_chunks.append(chunk.content)
                    yield chunk.content

            full_text = "".join(streamed_chunks)
            for citation in re.findall(r"\[\[(.*?)\]\]", full_text):
                collected_sources.add(citation)

        except Exception as exc:
            logger.warning("agent_stream_failed_using_grounded_fallback", error=str(exc))
            fallback_text = self._generate_deterministic_fallback(message, context_text, list(collected_sources))
            for citation in re.findall(r"\[\[(.*?)\]\]", fallback_text):
                collected_sources.add(citation)

            # Stream words with light pacing for smooth UI rendering
            for word in fallback_text.split(" "):
                yield word + " "
                await asyncio.sleep(0.015)

        self.last_sources = sorted(list(collected_sources))

    # ── Onboarding Document Generator ─────────────────────────────────────────

    async def generate_onboarding_doc(self) -> str:
        """
        Generate a comprehensive onboarding walkthrough document.
        Combines top entry points, architecture metrics, and critical code chunks.
        """
        from app.agent.prompts import ONBOARDING_DOC_PROMPT

        queries = [
            "application startup and entry point",
            "core architecture modules",
            "routing and api endpoints",
            "data models and storage",
            "error handling and middleware",
        ]

        context_parts = []
        for q in queries:
            try:
                results = await self.vector_store.similarity_search(q, top_k=2)
                for r in results:
                    loc = f"lines {r['start_line']}–{r['end_line']}" if r.get("start_line") else ""
                    context_parts.append(
                        f"### [[{r['file_path']}]] {loc}\n```{r.get('language', '').lower()}\n{r['content'][:600]}\n```"
                    )
            except Exception as e:
                logger.warning("onboarding_query_failed", query=q, error=str(e))

        context = "\n\n".join(context_parts[:10])
        prompt = ONBOARDING_DOC_PROMPT.format(
            repo_full_name=self.repo_full_name,
            context=context or "Topological graph indexed.",
        )

        try:
            res = await self.llm.ainvoke([HumanMessage(content=prompt)])
            return res.content
        except Exception as exc:
            logger.warning("onboarding_llm_failed_using_ast_doc", error=str(exc))
            nodes = self.graph_cache.get("nodes", [])
            entry_points = [n["id"] for n in nodes if n.get("is_entry")]
            cycles = self.graph_cache.get("meta", {}).get("cycles", [])

            return f"""# Getting Started with {self.repo_full_name}

*(Architectural Walkthrough generated via DevLens AST & Topological Analysis)*

---

## 1. System Overview
**{self.repo_full_name}** has been ingested and mapped into a directed dependency graph.
- **Total Indexed Modules**: {len(nodes)}
- **Cyclic Dependencies**: {len(cycles)} detected
- **Identified Entry Points**: {len(entry_points)}

## 2. Key Entry Points
{chr(10).join(f"- `[[{p}]]`" for p in entry_points[:6]) if entry_points else "- Standard module package structure."}

## 3. Discovered Core Modules
{chr(10).join(f"- `[[{p.split('### ')[1].split(']]')[0]}]]`" for p in context_parts[:8] if "### [[" in p) if context_parts else "- Inspect the Modules tab for the full topological index."}

## 4. Architectural Stability
{"⚠️ **Notice**: Circular dependency cycles detected. Review the Architecture Graph tab to inspect tight couplings." if cycles else "✅ **DAG Stable**: No circular cycles detected. Modules follow a clean acyclic hierarchy."}
"""
