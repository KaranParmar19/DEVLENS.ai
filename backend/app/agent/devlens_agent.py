"""
DevLens AI - LangChain ReAct Agent
The AI brain of DevLens. Uses OpenAI-compatible LLMs (GPT-4o, Claude, Groq, Ollama, DeepSeek)
with custom tools grounded in PostgreSQL pgvector code chunks and NetworkX dependency graphs.
"""

import re
import uuid
import asyncio
from pathlib import PurePosixPath
from typing import Any
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


def _is_valid_prose_purpose(text: str | None) -> bool:
    """Verify that a candidate purpose string is clean prose and not a code line."""
    if not text or not text.strip():
        return False
    s = text.strip()
    if s.lower() == "purpose not verified":
        return False
    core = s.rstrip(".")
    if len(core) < 12:
        return False
    if not core[0].isalpha():
        return False
    # Reject trailing code punctuation
    if core.endswith(("{", "}", ",", "(", ")", ";", "[", "]", ":", "=")):
        return False
    # Reject code syntax patterns
    code_patterns = (
        "return <", "return (", "=>", "export const", "export default", "export function",
        "import ", "from '", 'from "', "const ", "let ", "var ", "def ", "class ",
        "function(", "function ", "interface ", "type ", "//", "/*", "*/",
    )
    s_lower = core.lower()
    if any(pat in s_lower for pat in code_patterns):
        return False
    if s_lower.startswith((
        "eslint-", "@ts-", "todo", "fixme", "noqa", "type: ignore", "coding:", "-*-",
        "file:", "function:", "class:", "method:", "module-level code",
    )):
        return False
    # Require at least 3 alphabetic words
    words = re.findall(r"[A-Za-z]{2,}", core)
    if len(words) < 3:
        return False
    return True


def _first_sentence(text: str) -> str:
    """Extract the first sentence from prose text and ensure it ends with a period."""
    cleaned = re.sub(r"[─━═=\-*_]{3,}", " ", text.replace("\u2014", " - ").replace("\u2013", "-"))
    collapsed = " ".join(cleaned.split()).strip()
    sentence = re.split(r"\.(?:\s+|$)", collapsed)[0].strip()
    sentence = sentence.rstrip(".")
    return f"{sentence}." if sentence else ""


def _extract_leading_comment_or_docstring(snippet: str) -> str | None:
    """
    If snippet starts with a module docstring or leading comment (ignoring blank lines,
    shebang, encoding declarations, or synthetic chunker headers), extract its first sentence.
    Stops at the first blank line, section underline, or ALL-CAPS header inside a docstring.
    Otherwise return None.
    """
    all_lines = [l.strip() for l in snippet.splitlines()]
    idx = 0
    while idx < len(all_lines):
        line = all_lines[idx]
        if not line:
            idx += 1
            continue
        if (
            line.startswith("#!")
            or re.match(r"^#.*coding[:=]", line)
            or re.match(r"^(?:#|//)\s*(?:File:|Function:|Class:|Method:|Module-level code)", line, re.IGNORECASE)
        ):
            idx += 1
            continue
        break

    if idx >= len(all_lines):
        return None

    first = all_lines[idx]

    # Case 1: Leading docstring or block comment (""", ''', /*, /**)
    for delim in ('"""', "'''", "/**", "/*"):
        if first.startswith(delim):
            closing = "*/" if delim.startswith("/*") else delim
            after_open = first[len(delim):].strip()
            collected: list[str] = []
            if closing in after_open:
                before_close = after_open.split(closing, 1)[0].strip().lstrip("*").strip()
                if before_close:
                    collected.append(before_close)
            else:
                if after_open.lstrip("*").strip():
                    collected.append(after_open.lstrip("*").strip())
                for sub_line in all_lines[idx + 1 : idx + 20]:
                    if closing in sub_line:
                        before_close = sub_line.split(closing, 1)[0].strip().lstrip("*").strip()
                        if before_close and not re.fullmatch(r"[─━═=\-*_~]{3,}", before_close):
                            collected.append(before_close)
                        break
                    cleaned_sub = sub_line.lstrip("*").strip()
                    if not cleaned_sub:
                        if collected:
                            break
                        continue
                    if re.fullmatch(r"[─━═=\-*_~]{3,}", cleaned_sub):
                        if collected:
                            break
                        continue
                    if cleaned_sub.isupper() and len(cleaned_sub) >= 4 and collected:
                        break
                    collected.append(cleaned_sub)
            joined = " ".join(collected).strip()
            if joined:
                cand = _first_sentence(joined)
                if _is_valid_prose_purpose(cand):
                    return cand
            return None

    # Case 2: Leading single-line comment (# or //), excluding C preprocessor directives
    if first.startswith(("//", "#")) and not re.match(r"^#\s*(?:include|define|ifdef|ifndef|if\b|endif|pragma)\b", first):
        collected_comments: list[str] = []
        for sub_line in all_lines[idx : idx + 12]:
            if not sub_line:
                if collected_comments:
                    break
                continue
            if re.match(r"^#\s*(?:include|define|ifdef|ifndef|if\b|endif|pragma)\b", sub_line):
                break
            if sub_line.startswith("//"):
                c_text = re.sub(r"^/{2,}\s*", "", sub_line).strip()
            elif sub_line.startswith("#"):
                c_text = re.sub(r"^#+\s*", "", sub_line).strip()
            else:
                break
            if not c_text or re.fullmatch(r"[─━═=\-*_~]{3,}", c_text):
                if collected_comments:
                    break
                continue
            if c_text.lower().startswith(("eslint-", "@ts-", "noqa", "type: ignore", "ruff:", "fmt:")):
                continue
            collected_comments.append(c_text)
        joined = " ".join(collected_comments).strip()
        if joined:
            cand = _first_sentence(joined)
            if _is_valid_prose_purpose(cand):
                return cand
        return None

    return None


def _extract_purpose_from_snippet(
    snippet: str | None,
    model_purpose: str | None = None,
    evidence_quote: str | None = None,
) -> str:
    """
    Purpose is verified ONLY if:
    1. The snippet starts with a docstring or leading comment (use its first sentence), OR
    2. The model gives an evidence_quote that is an exact substring of the snippet
       (and a valid prose sentence).
    Otherwise return 'purpose not verified'.
    """
    if not snippet or not snippet.strip():
        return "purpose not verified"

    # Rule 1: Snippet starts with a docstring or leading comment
    leading = _extract_leading_comment_or_docstring(snippet)
    if leading:
        return leading

    # Rule 2: Model provides an evidence_quote that is an exact substring of the snippet
    if evidence_quote and evidence_quote.strip():
        quote = evidence_quote.strip()
        if len(quote) >= 5 and quote in snippet:
            if model_purpose and model_purpose.strip():
                cand = _first_sentence(model_purpose.strip())
                if _is_valid_prose_purpose(cand):
                    return cand
            # Fallback if evidence_quote itself is a comment/prose sentence inside the snippet
            clean_q = re.sub(r"^(/{2,}|#+|/\*+|\*+|\"\"\"|\'\'\')\s*", "", quote).rstrip("*/\"' ").strip()
            cand_q = _first_sentence(clean_q)
            if _is_valid_prose_purpose(cand_q):
                return cand_q

    return "purpose not verified"


def _resolve_graph_path(path: str, known_paths: set[str]) -> str | None:
    """
    Resolve a cited path to its exact canonical path in `known_paths` (the repository graph).
    Resolves README references (README, README.md, README.rst, README.txt) to the actual
    README filename present in `known_paths`. Returns None if not in `known_paths`.
    """
    clean = path.replace("[[", "").replace("]]", "").strip()
    if not clean:
        return None
    if clean in known_paths:
        return clean

    lower_map = {k.lower(): k for k in known_paths}
    c_lower = clean.lower().replace("\\", "/")
    if c_lower in lower_map:
        return lower_map[c_lower]

    if c_lower in ("readme", "readme.md", "readme.rst", "readme.txt"):
        for cand in ("readme.rst", "readme.md", "readme.txt", "readme"):
            if cand in lower_map:
                return lower_map[cand]

    return None


def _is_valid_source_file(path: str, known_paths: set[str]) -> bool:
    """Validate if path resolves to an actual indexed file in `known_paths`."""
    return _resolve_graph_path(path, known_paths) is not None


def _clean_markdown_citations(
    text: str,
    known_paths: set[str],
    drops: list[str] | None = None,
    drops_by_section: dict[str, list[str]] | None = None,
) -> str:
    """Validate all [[citations]] in prose. Resolves README to its real filename and converts any non-graph path to plain text."""
    if not text:
        return text

    def repl(m: re.Match) -> str:
        raw = m.group(1).strip()
        resolved = _resolve_graph_path(raw, known_paths)
        if resolved is not None:
            return f"[[{resolved}]]"
        if drops is not None:
            msg = f"unwrapped invalid citation '[[{raw}]]' (not an indexed graph file)"
            drops.append(f"paths: {msg}")
            if drops_by_section is not None:
                drops_by_section["paths"].append(msg)
        return raw

    return re.sub(r"\[\[(.*?)\]\]", repl, text)


class DevLensAgent:
    """
    Wraps a tool-calling agent grounded in the repository's AST index.
    Scoped to a single repository session: tools are bound to the repo's vector store
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
                    lines.append(f"- `[[{n['id']}]]` ({n.get('desc', 'N/A')})")

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

    def _render_schema_to_markdown(self, doc: Any, facts: dict[str, Any]) -> str:
        """Render a validated OnboardingDocSchema into clean, structured Markdown with sequential section numbering."""
        lines = [f"# {doc.repo_name}: Onboarding Guide\n"]
        sec_idx = 1

        # Section: Project Overview & Architecture
        if doc.summary and doc.summary.strip():
            lines.append(f"## {sec_idx}. Project Overview & Architecture")
            lines.append(doc.summary.strip())
            sec_idx += 1

        # Section: Quick Start
        quick_start_lines = []
        qs = doc.quick_start
        manifest = facts.get("manifest", {})
        if manifest.get("parse_error"):
            quick_start_lines.append(f"- {manifest['parse_error']}")
        elif manifest.get("monorepo_packages"):
            quick_start_lines.append("- **Monorepo Packages Setup**:")
            for pkg in manifest["monorepo_packages"]:
                folder = pkg["folder"]
                quick_start_lines.append(f"  - **`{folder}/`** ({pkg['manifest_type']}):")
                inst_cmd = pkg.get("install_command")
                inst_prov = pkg.get("install_provenance")
                if inst_cmd and inst_cmd != "not declared in repo":
                    prov_str = f" ({inst_prov})" if inst_prov else ""
                    quick_start_lines.append(f"    - Install: `{inst_cmd}`{prov_str}")
                else:
                    quick_start_lines.append("    - Install: not declared in repo")
                if pkg.get("run_command") and pkg["run_command"] != "no run command declared":
                    run_prov = pkg.get("run_provenance")
                    prov_str = f" ({run_prov})" if run_prov else ""
                    quick_start_lines.append(f"    - Run/Dev: `{pkg['run_command']}`{prov_str}")
                else:
                    quick_start_lines.append("    - Run/Dev: no run command declared")
                if pkg.get("test_command") and pkg["test_command"] not in ("no tests found", "not declared in repo"):
                    test_prov = pkg.get("test_provenance")
                    prov_str = f" ({test_prov})" if test_prov else ""
                    quick_start_lines.append(f"    - Test: `{pkg['test_command']}`{prov_str}")
                elif pkg.get("test_command") == "not declared in repo":
                    quick_start_lines.append("    - Test: not declared in repo")
                else:
                    quick_start_lines.append("    - Test: no tests found")
        else:
            if qs.install_command and qs.install_command != "not declared in repo":
                inst_prov = manifest.get("install_command_provenance")
                prov_str = f" ({inst_prov})" if inst_prov else ""
                quick_start_lines.append(f"- **Install**: `{qs.install_command}`{prov_str}")
            else:
                quick_start_lines.append("- **Install**: not declared in repo")
            if qs.run_command and qs.run_command not in ("no run command declared", "not declared in repo"):
                run_prov = manifest.get("run_command_provenance")
                prov_str = f" ({run_prov})" if run_prov else ""
                quick_start_lines.append(f"- **Run/Dev**: `{qs.run_command}`{prov_str}")
            else:
                quick_start_lines.append("- **Run/Dev**: no run command declared")
            if qs.test_command:
                if qs.test_command in ("no tests found", "not declared in repo"):
                    quick_start_lines.append(f"- **Test**: {qs.test_command}")
                else:
                    test_prov = manifest.get("test_command_provenance")
                    prov_str = f" ({test_prov})" if test_prov else ""
                    quick_start_lines.append(f"- **Test**: `{qs.test_command}`{prov_str}")
            else:
                quick_start_lines.append("- **Test**: no tests found")

        env_usage = facts.get("env_usage", {})
        if facts.get("grouped_env_variables"):
            quick_start_lines.append("- **Environment Variables**:")
            for cat, items in facts["grouped_env_variables"].items():
                quick_start_lines.append(f"  - **{cat}**:")
                for item in items:
                    usage = f" (read in code via {item['accessor']})" if item.get("read_in_code") else " (declared in .env.example)"
                    quick_start_lines.append(f"    - `{item['key']}`{usage}")
        elif qs.env_variables:
            quick_start_lines.append("- **Environment Variables**:")
            for k in qs.env_variables:
                usage = f" (read in code via {env_usage.get(k)})" if k in env_usage else " (declared in .env.example)"
                quick_start_lines.append(f"  - `{k}`{usage}")
        else:
            quick_start_lines.append("- **Environment Variables**: No .env.example declared in repository.")

        from app.core.facts_extractor import group_tech_stack

        tech_stack = doc.tech_stack if (hasattr(doc, "tech_stack") and doc.tech_stack) else (manifest.get("runtime_dependencies") or [])
        tech_stack = [str(t) for t in tech_stack if not str(t).endswith("(dev)") and not str(t).startswith("@types/")]
        grouped_stack = group_tech_stack(tech_stack, max_groups=12)
        if grouped_stack:
            quick_start_lines.append(f"- **Tech Stack**: {', '.join(grouped_stack)}")

        if quick_start_lines:
            lines.append(f"\n## {sec_idx}. Quick Start")
            lines.extend(quick_start_lines)
            sec_idx += 1

        # Section: Folder Map
        folder_entries = []
        if doc.folder_map:
            for fm in doc.folder_map:
                clean_p = fm.path.strip().rstrip("/")
                try:
                    cnt = int(fm.file_count)
                except (ValueError, TypeError):
                    cnt = 0
                plural = "1 file" if cnt == 1 else f"{cnt} files"
                samples = f" (e.g. {fm.sample_files})" if fm.sample_files else ""
                role_txt = fm.role.strip() if fm.role else ""
                if role_txt and role_txt.lower() not in ("application component directory", "not verified", "purpose not verified"):
                    folder_entries.append(f"- **`{clean_p}/`** ({plural}){samples}: {role_txt}")
                else:
                    folder_entries.append(f"- **`{clean_p}/`** ({plural}){samples}")
        elif facts.get("folder_breakdown"):
            for fb in facts.get("folder_breakdown", []):
                clean_p = str(fb.get("path", "")).strip().rstrip("/")
                try:
                    cnt = int(fb.get("file_count", 0))
                except (ValueError, TypeError):
                    cnt = 0
                plural = "1 file" if cnt == 1 else f"{cnt} files"
                samples = f", e.g. {fb['sample_files']}" if fb.get("sample_files") else ""
                folder_entries.append(f"- **`{clean_p}/`** ({plural}{sample})")

        if folder_entries:
            lines.append(f"\n## {sec_idx}. Folder Map")
            lines.extend(folder_entries)
            sec_idx += 1

        # Section: How It Works
        if doc.how_it_works and doc.how_it_works.strip():
            lines.append(f"\n## {sec_idx}. How It Works")
            lines.append(doc.how_it_works.strip())
            sec_idx += 1

        # Section: Files to Handle Carefully (High Blast Radius)
        careful_lines = []
        if doc.careful_files:
            for cf in doc.careful_files:
                deps_info = f"Total Dependents: {cf.dependents_count} (Source: {cf.source_dependents_count}, Tests: {cf.test_dependents_count})"
                careful_lines.append(
                    f"- **[[{cf.path}]]** (Risk: {cf.risk_level}, {deps_info}, Coupling: {cf.coupling:.2f}):\n"
                    f"  {cf.reason}"
                )
        if careful_lines:
            lines.append(f"\n## {sec_idx}. Files to Handle Carefully (High Blast Radius)")
            lines.extend(careful_lines)
            sec_idx += 1

        # Section: Repository Invariants & Gotchas (omit if empty, else renumber)
        if doc.gotchas:
            lines.append(f"\n## {sec_idx}. Repository Invariants & Gotchas")
            for g in doc.gotchas:
                lines.append(f"- **{g.title}** (Evidence: [[{g.evidence_path}]]):\n  {g.description}")
            sec_idx += 1

        # Section: Recommended First Task
        ft = doc.first_task
        if ft and (ft.suggested_files or ft.rationale):
            lines.append(f"\n## {sec_idx}. Recommended First Task")
            lines.append(f"### {ft.title}")
            if ft.rationale:
                lines.append(ft.rationale)
            if ft.suggested_files:
                lines.append("\nSuggested starter files:")
                for sf in ft.suggested_files:
                    test_str = f" | Test: [[{sf.nearby_test}]]" if sf.nearby_test else " | No dedicated test file detected"
                    dep_word = "1 source dependent" if sf.source_dependents_count == 1 else f"{sf.source_dependents_count} source dependents"
                    line_word = "1 line" if sf.line_count == 1 else f"{sf.line_count} lines"
                    lines.append(
                        f"- **[[{sf.path}]]** ({line_word}, {dep_word}{test_str}):\n"
                        f"  Verified purpose: {sf.verified_purpose}"
                    )
            if ft.verification_steps:
                lines.append(f"\nVerification steps:\n{ft.verification_steps}")
            sec_idx += 1

        # Section: Glossary (omit if empty, else renumber)
        if doc.glossary:
            lines.append(f"\n## {sec_idx}. Glossary")
            for gl in doc.glossary:
                lines.append(f"- **{gl.term}** (seen in [[{gl.seen_in}]]): {gl.definition}")
            sec_idx += 1

        from app.core.facts_extractor import format_snapshot_footer

        lines.append(format_snapshot_footer(facts))

        known_paths = set(facts.get("file_metrics", {}).keys())
        rendered_md = "\n".join(lines).replace("\u2014", " - ").replace("\u2013", "-")
        if known_paths:
            rendered_md = _clean_markdown_citations(rendered_md, known_paths)
        return rendered_md

    async def generate_onboarding_doc(self) -> str:
        """
        Generate an authoritative, production-grade architectural onboarding dossier.
        All metrics, entry points, risk levels, and starter tasks are computed in code
        via FactsExtractor and passed as an immutable FACTS block to the model.
        Outputs a machine-validated JSON schema and transforms it into verified markdown.
        """
        import json
        from app.core.facts_extractor import FactsExtractor, build_deterministic_fallback_doc
        from app.agent.prompts import ONBOARDING_DOC_JSON_PROMPT
        from app.schemas.onboarding import (
            OnboardingDocSchema,
            CarefulFileItem,
            GotchaItem,
            StarterTaskItem,
            FolderMapItem,
            QuickStartInfo,
        )

        extractor = FactsExtractor(
            db=self.db,
            repo_id=self.repo_id,
            repo_full_name=self.repo_full_name,
            graph_cache=self.graph_cache,
        )
        facts = await extractor.assemble_verified_facts()
        facts_block = extractor.format_facts_text(facts)

        # Pull real code chunks for key entry points, starter candidates, and high-risk junctions
        context_parts = []
        key_files = (
            [ep["path"] for ep in facts["entry_points"][:2]]
            + [cs["path"] for cs in facts["candidate_starters"][:3]]
            + [hr["path"] for hr in facts["high_risk_files"][:2]]
        )
        for path in key_files:
            try:
                chunks = await self.vector_store.get_chunks_by_file(path)
                if chunks:
                    c = chunks[0]
                    loc = f"lines {c['start_line']}–{c['end_line']}" if c.get("start_line") else ""
                    context_parts.append(
                        f"### [[{c['file_path']}]] {loc}\n```{c.get('language', '').lower()}\n{c['content'][:600]}\n```"
                    )
            except Exception as e:
                logger.warning("onboarding_context_fetch_failed", path=path, error=str(e))

        context = "\n\n".join(context_parts[:6]) or "Topological graph and manifest indexed."
        prompt = ONBOARDING_DOC_JSON_PROMPT.format(
            repo_full_name=self.repo_full_name,
            facts_block=facts_block,
            context=context,
        )

        parsed_schema: OnboardingDocSchema | None = None
        file_metrics = facts.get("file_metrics", {})
        all_known_paths = set(file_metrics.keys())
        raw_output = ""

        # Attempt LLM call with 1 retry on invalid JSON
        for attempt in range(2):
            try:
                if attempt == 0:
                    messages = [HumanMessage(content=prompt)]
                else:
                    messages = [
                        HumanMessage(content=prompt),
                        AIMessage(content=raw_output or ""),
                        HumanMessage(content="Your previous response was not valid JSON matching the requested schema. Return ONLY a valid JSON object matching the schema with no extra commentary."),
                    ]

                res = await self.llm.ainvoke(messages)
                raw_output = res.content or ""

                clean_json = raw_output.strip()
                if clean_json.startswith("```"):
                    lines = clean_json.splitlines()
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    clean_json = "\n".join(lines).strip()

                data = json.loads(clean_json)
                parsed_schema = OnboardingDocSchema.model_validate(data)
                break
            except Exception as parse_err:
                logger.warning("onboarding_json_attempt_failed", attempt=attempt, error=str(parse_err))

        if not parsed_schema:
            logger.warning("onboarding_json_failed_using_facts_fallback")
            return build_deterministic_fallback_doc(facts)

        # ── Post-processing Validation & Grounding Enforcement ──────────────────
        manifest = facts.get("manifest", {})

        drops: list[str] = []
        drops_by_section: dict[str, list[str]] = {
            "paths": [],
            "gotchas": [],
            "glossary": [],
            "starters": [],
        }

        # Store raw model output and citations before cleaning
        raw_summary_citations = re.findall(r"\[\[(.*?)\]\]", parsed_schema.summary or "")
        raw_how_citations = re.findall(r"\[\[(.*?)\]\]", parsed_schema.how_it_works or "")
        self.last_raw_citations_before_clean = raw_summary_citations + raw_how_citations
        self.last_raw_summary = parsed_schema.summary
        self.last_raw_how_it_works = parsed_schema.how_it_works
        try:
            self.last_raw_structured_doc = parsed_schema.model_dump()
        except Exception:
            self.last_raw_structured_doc = {}

        # Clean prose citations in summary and how_it_works to log any ungrounded model citations
        if parsed_schema.summary:
            _clean_markdown_citations(
                parsed_schema.summary, all_known_paths, drops, drops_by_section
            )
        if parsed_schema.how_it_works:
            _clean_markdown_citations(
                parsed_schema.how_it_works, all_known_paths, drops, drops_by_section
            )

        # Build summary strictly from README (when present) and computed repository counts
        langs = [
            f"{lang} ({cnt})"
            for lang, cnt in sorted(facts.get("language_breakdown", {}).items(), key=lambda x: x[1], reverse=True)
        ]
        lang_summary = f" Languages: {', '.join(langs)}." if langs else ""
        metrics_summary = (
            f"Indexed snapshot contains {facts.get('total_modules', 0)} total files "
            f"({facts.get('source_modules_count', 0)} source modules, "
            f"{facts.get('test_modules_count', 0)} test modules, "
            f"{facts.get('config_modules_count', 0)} config files, "
            f"{facts.get('docs_and_assets_count', 0)} docs/assets) "
            f"and {facts.get('total_edges', 0)} dependency edges "
            f"({facts.get('cycles_count', 0)} circular import cycles).{lang_summary}"
        )
        if facts.get("readme_summary"):
            parsed_schema.summary = f"{facts['readme_summary']}\n\n{metrics_summary}"
        else:
            parsed_schema.summary = f"No README is declared in this repository.\n\n{metrics_summary}"

        # Build how_it_works strictly from computed entry points, outgoing edges, and high-risk modules
        how_lines: list[str] = []
        if facts.get("entry_points"):
            for ep in facts["entry_points"]:
                ep_path = ep["path"]
                ep_out = ep.get("dependencies", [])
                if ep_out:
                    out_links = ", ".join(f"[[{d}]]" for d in ep_out[:6])
                    more = f" (+{len(ep_out) - 6} more)" if len(ep_out) > 6 else ""
                    how_lines.append(
                        f"- Entry point [[{ep_path}]] imports {len(ep_out)} local modules: {out_links}{more}."
                    )
                else:
                    how_lines.append(
                        f"- Entry point [[{ep_path}]] has {ep.get('source_dependents_count', 0)} source dependents "
                        f"and {ep.get('dependencies_count', 0)} local outgoing dependencies."
                    )
        if facts.get("high_risk_files"):
            for hr in facts["high_risk_files"][:3]:
                hr_path = hr["path"]
                src_callers = hr.get("source_dependents", [])
                tst_callers = hr.get("test_dependents", [])
                if src_callers:
                    caller_links = ", ".join(f"[[{c}]]" for c in src_callers[:5])
                    more_c = f" (+{len(src_callers) - 5} more)" if len(src_callers) > 5 else ""
                    how_lines.append(
                        f"- Shared module [[{hr_path}]] is imported by {len(src_callers)} source modules ({caller_links}{more_c})."
                    )
                elif tst_callers:
                    caller_links = ", ".join(f"[[{c}]]" for c in tst_callers[:5])
                    more_c = f" (+{len(tst_callers) - 5} more)" if len(tst_callers) > 5 else ""
                    how_lines.append(
                        f"- Core module [[{hr_path}]] is imported by {len(tst_callers)} test modules ({caller_links}{more_c})."
                    )
        if not how_lines:
            how_lines.append(
                f"- Repository index contains {facts.get('source_modules_count', 0)} source modules "
                f"and {facts.get('total_edges', 0)} resolved import edges."
            )
        parsed_schema.how_it_works = "\n".join(how_lines)

        # 1. Overwrite quick start with ground truth from manifest
        test_cmd = manifest.get("test_command")
        if facts.get("test_modules_count", 0) == 0:
            test_cmd = "no tests found"
        elif not test_cmd:
            test_cmd = "not declared in repo"

        parsed_schema.quick_start = QuickStartInfo(
            install_command=manifest.get("install_command") or "not declared in repo",
            run_command=manifest.get("run_command") or manifest.get("dev_command") or "no run command declared",
            test_command=test_cmd,
            test_command_type=manifest.get("test_command_type") or "not declared",
            env_variables=facts.get("env_variables", []),
        )

        # 1b. Overwrite folder_map strictly from computed folder_breakdown (no unverified role prose)
        valid_folder_map: list[FolderMapItem] = []
        for fb in facts.get("folder_breakdown", []):
            valid_folder_map.append(FolderMapItem(
                path=fb["path"].strip().rstrip("/"),
                role="",
                file_count=int(fb.get("file_count", 0)),
                sample_files=fb.get("sample_files", ""),
            ))
        parsed_schema.folder_map = valid_folder_map

        # 1c. Overwrite tech_stack strictly from runtime_dependencies only (exclude devDependencies, @types/*)
        runtime_deps = manifest.get("runtime_dependencies") or []
        parsed_schema.tech_stack = [
            str(dep) for dep in runtime_deps
            if not str(dep).startswith("@types/")
            and not str(dep).endswith("(dev)")
        ]

        # 2. Choose careful_files in code: Render every High-risk file from computed data
        # Reason is verified via docstring/leading comment or exact evidence_quote from snippet
        computed_hr_paths = {hr["path"] for hr in facts.get("high_risk_files", [])}
        for cf in (parsed_schema.careful_files if parsed_schema else []):
            clean_cf = cf.path.replace("[[", "").replace("]]", "").strip()
            if clean_cf not in computed_hr_paths:
                msg = f"dropped non-computed careful file '{cf.path}'"
                drops.append(f"paths: {msg}")
                drops_by_section["paths"].append(msg)

        model_cf_by_path = {
            cf.path.replace("[[", "").replace("]]", "").strip(): cf
            for cf in (parsed_schema.careful_files if parsed_schema else [])
        }

        computed_careful_files: list[CarefulFileItem] = []
        for hr in facts.get("high_risk_files", []):
            path = hr["path"]
            snippet = hr.get("first_30_lines")
            has_snippet = bool(snippet and snippet.strip())
            model_cf = model_cf_by_path.get(path)

            source_deps = hr.get("source_dependents_count", 0)
            test_deps = hr.get("test_dependents_count", 0)

            verified_hr_purpose = "purpose not verified"
            valid_hr_quote = None
            if has_snippet:
                m_reason = model_cf.reason if model_cf else None
                m_quote = model_cf.evidence_quote if model_cf else None
                verified_hr_purpose = _extract_purpose_from_snippet(
                    snippet,
                    model_purpose=m_reason,
                    evidence_quote=m_quote,
                )
                if m_quote and m_quote.strip() and m_quote.strip() in (snippet or "") and verified_hr_purpose != "purpose not verified":
                    valid_hr_quote = m_quote.strip()

            if verified_hr_purpose != "purpose not verified":
                reason = (
                    f"{verified_hr_purpose} Imported by {hr['dependents_count']} modules "
                    f"(Source: {source_deps}, Tests: {test_deps})."
                )
            else:
                reason = (
                    f"Imported by {hr['dependents_count']} modules "
                    f"(Source: {source_deps}, Tests: {test_deps}, Outgoing dependencies: {hr.get('dependencies_count', 0)})."
                )

            computed_careful_files.append(CarefulFileItem(
                path=path,
                risk_level=hr.get("risk_level", "High"),
                dependents_count=hr.get("dependents_count", 0),
                source_dependents_count=source_deps,
                test_dependents_count=test_deps,
                coupling=hr.get("coupling", 0.0),
                reason=reason,
                evidence_quote=valid_hr_quote,
            ))
        parsed_schema.careful_files = computed_careful_files

        # 3. Filter gotchas: require resolved graph path AND an exact evidence_quote substring in that file
        valid_gotchas: list[GotchaItem] = []
        for g in parsed_schema.gotchas:
            resolved_evidence = _resolve_graph_path(g.evidence_path, all_known_paths)
            if not resolved_evidence:
                msg = f"dropped rule '{g.title}' (evidence_path '{g.evidence_path}' is not a recognized repository file)"
                drops.append(f"gotchas: {msg}")
                drops_by_section["gotchas"].append(msg)
                continue

            content = await extractor.extract_file_content(resolved_evidence)
            if not content:
                msg = f"dropped rule '{g.title}' (evidence file '{resolved_evidence}' has no indexed content)"
                drops.append(f"gotchas: {msg}")
                drops_by_section["gotchas"].append(msg)
                continue

            quote = (g.evidence_quote or "").strip()
            if len(quote) >= 5 and quote in content:
                g.evidence_path = resolved_evidence
                g.evidence_quote = quote
                g.description = _clean_markdown_citations(g.description, all_known_paths, drops, drops_by_section)
                valid_gotchas.append(g)
            else:
                msg = f"dropped rule '{g.title}' (missing or unverified evidence_quote in '{resolved_evidence}')"
                drops.append(f"gotchas: {msg}")
                drops_by_section["gotchas"].append(msg)
        parsed_schema.gotchas = valid_gotchas

        # 4. Choose first_task in code, not the model. Pick starters from computed candidate_starters.
        computed_starters: list[StarterTaskItem] = []
        candidate_starters = facts.get("candidate_starters", [])
        computed_starter_paths = {cs["path"] for cs in candidate_starters[:3]}

        model_starters_by_path: dict[str, StarterTaskItem] = {}
        for st in (parsed_schema.first_task.suggested_files if parsed_schema and parsed_schema.first_task else []):
            clean_st = st.path.replace("[[", "").replace("]]", "").strip()
            if clean_st not in computed_starter_paths:
                msg = f"dropped model starter '{st.path}' (not a computed candidate starter)"
                drops.append(f"starters: {msg}")
                drops_by_section["starters"].append(msg)
            else:
                model_starters_by_path[clean_st] = st

        for cs in candidate_starters[:3]:
            cs_path = cs["path"]
            snippet = cs.get("first_30_lines")
            has_snippet = bool(snippet and snippet.strip())
            model_st = model_starters_by_path.get(cs_path)

            if not has_snippet:
                verified_purpose = "purpose not verified"
                valid_quote = None
            else:
                m_purpose = model_st.verified_purpose if model_st else None
                m_quote = model_st.evidence_quote if model_st else None
                verified_purpose = _extract_purpose_from_snippet(
                    snippet,
                    model_purpose=m_purpose,
                    evidence_quote=m_quote,
                )
                valid_quote = (
                    m_quote.strip()
                    if (m_quote and m_quote.strip() and m_quote.strip() in snippet and verified_purpose != "purpose not verified")
                    else None
                )

            computed_starters.append(StarterTaskItem(
                path=cs_path,
                line_count=cs.get("line_count", 0),
                source_dependents_count=cs.get("source_dependents_count", 0),
                nearby_test=cs.get("nearby_test"),
                verified_purpose=verified_purpose,
                evidence_quote=valid_quote,
            ))

        parsed_schema.first_task.suggested_files = computed_starters

        # Build title, rationale, and verification steps entirely in code
        # Use the exact command strings from quick_start so Quick Start and first_task always match
        test_cmd = parsed_schema.quick_start.test_command
        has_tests = bool(
            facts.get("test_modules_count", 0) > 0
            and test_cmd
            and test_cmd not in ("no tests found", "not declared in repo")
        )
        raw_run_cmd = parsed_schema.quick_start.run_command
        run_cmd = raw_run_cmd if (raw_run_cmd and raw_run_cmd != "no run command declared") else "no run command declared"
        fallback_paths = [
            p for p, m in sorted(facts.get("file_metrics", {}).items())
            if m.get("source_dependents_count", 0) >= 0 and not p.startswith(".")
        ] or sorted(facts.get("file_metrics", {}).keys())

        if computed_starters:
            top_st = computed_starters[0]
            file_name = PurePosixPath(top_st.path).name
            entry_file = (
                facts.get("entry_points", [{}])[0].get("path")
                if facts.get("entry_points")
                else top_st.path
            )
            dep_cnt = top_st.source_dependents_count
            dep_phrase = (
                "1 downstream source dependent"
                if dep_cnt == 1
                else f"{dep_cnt} downstream source dependents"
            )
            line_phrase = "1 line" if top_st.line_count == 1 else f"{top_st.line_count} lines"

            if has_tests:
                task_title = f"Add a test for {file_name}"
                if top_st.verified_purpose == "purpose not verified":
                    task_rationale = f"[[{top_st.path}]] has {line_phrase} and {dep_phrase}."
                else:
                    clean_purpose = top_st.verified_purpose.rstrip(".")
                    task_rationale = f"[[{top_st.path}]] ({clean_purpose}) has {line_phrase} and {dep_phrase}."
                if top_st.nearby_test:
                    verification_steps = f"Run `{test_cmd}` (targeting [[{top_st.nearby_test}]]) to verify changes."
                else:
                    verification_steps = f"Run `{test_cmd}` to verify that existing test suites pass."
            else:
                task_title = f"Read {entry_file}, then run {run_cmd}"
                if top_st.verified_purpose == "purpose not verified":
                    task_rationale = (
                        f"No test suite is declared in this repository. Read [[{entry_file}]] "
                        f"and inspect [[{top_st.path}]] ({line_phrase}, {dep_phrase})."
                    )
                else:
                    clean_purpose = top_st.verified_purpose.rstrip(".")
                    task_rationale = (
                        f"No test suite is declared in this repository. Read [[{entry_file}]] "
                        f"and inspect [[{top_st.path}]] ({clean_purpose}, {line_phrase}, {dep_phrase})."
                    )
                if run_cmd == "no run command declared":
                    verification_steps = f"Read [[{entry_file}]], then run: no run command declared."
                else:
                    verification_steps = f"Read [[{entry_file}]], then run `{run_cmd}`."
        else:
            entry_file = (
                facts.get("entry_points", [{}])[0].get("path")
                if facts.get("entry_points")
                else (
                    facts.get("high_risk_files", [{}])[0].get("path")
                    if facts.get("high_risk_files")
                    else (fallback_paths[0] if fallback_paths else "")
                )
            )
            empty_reason = facts.get("starter_empty_reason") or "0 candidate starter modules identified."
            task_rationale = empty_reason
            if has_tests:
                target_name = PurePosixPath(entry_file).name if entry_file else "repository"
                task_title = f"Add a test for {target_name}"
                verification_steps = f"Run `{test_cmd}` to verify that existing test suites pass."
            else:
                task_title = f"Read {entry_file}, then run {run_cmd}"
                if run_cmd == "no run command declared":
                    verification_steps = f"Read [[{entry_file}]], then run: no run command declared."
                else:
                    verification_steps = f"Read [[{entry_file}]], then run `{run_cmd}`."

        parsed_schema.first_task.title = task_title
        parsed_schema.first_task.rationale = task_rationale
        parsed_schema.first_task.verification_steps = verification_steps

        # 5. Filter glossary: resolve seen_in to a real graph path and require the term to appear in that file
        terms_returned_count = len(parsed_schema.glossary) if parsed_schema else 0
        valid_glossary: list[GlossaryItem] = []
        for item in (parsed_schema.glossary if parsed_schema else []):
            resolved_p = _resolve_graph_path(item.seen_in, all_known_paths)
            if not resolved_p:
                msg = f"dropped term '{item.term}' (seen_in '{item.seen_in}' is not a recognized repository file)"
                drops.append(f"glossary: {msg}")
                drops_by_section["glossary"].append(msg)
                continue

            content = await extractor.extract_file_content(resolved_p)
            if not content:
                all_chunks = await self.vector_store.get_chunks_by_file(resolved_p)
                if all_chunks:
                    content = "\n".join(c["content"] for c in all_chunks)

            if not content:
                msg = f"dropped term '{item.term}' (seen_in '{resolved_p}' has no indexed content)"
                drops.append(f"glossary: {msg}")
                drops_by_section["glossary"].append(msg)
                continue

            # Require that the evidence file contains both the claimed term and an exact evidence_quote
            gl_quote = (item.evidence_quote or "").strip()
            if item.term.lower().strip() in content.lower() and len(gl_quote) >= 3 and gl_quote in content:
                item.seen_in = resolved_p
                item.evidence_quote = gl_quote
                item.definition = _clean_markdown_citations(item.definition, all_known_paths, drops, drops_by_section)
                valid_glossary.append(item)
            else:
                msg = f"dropped term '{item.term}' (missing/unverified evidence_quote or term not found in '{resolved_p}')"
                drops.append(f"glossary: {msg}")
                drops_by_section["glossary"].append(msg)

        parsed_schema.glossary = valid_glossary
        terms_kept_count = len(valid_glossary)
        self.last_glossary_stats = {
            "returned": terms_returned_count,
            "kept": terms_kept_count,
        }

        self.last_facts_block = facts_block
        self.last_raw_json = raw_output
        self.last_drops = drops
        self.last_drops_by_section = drops_by_section
        self.last_structured_doc = parsed_schema.model_dump()
        return self._render_schema_to_markdown(parsed_schema, facts)
