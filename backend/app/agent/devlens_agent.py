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


def _is_valid_source_file(path: str, known_paths: set[str]) -> bool:
    """Validate if path is an indexed module, README, or build manifest."""
    clean = path.replace("[[", "").replace("]]", "").strip()
    if clean in known_paths:
        return True
    p_lower = clean.lower().replace("\\", "/")
    name = PurePosixPath(p_lower).name
    if name in ("readme", "readme.md", "readme.rst", "readme.txt"):
        return True
    manifest_names = ("package.json", "pyproject.toml", "requirements.txt", "makefile", "go.mod", "cargo.toml")
    if name in manifest_names:
        return True
    return False


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
        """Render a validated OnboardingDocSchema into clean, structured Markdown."""
        lines = [
            f"# {doc.repo_name}: Onboarding Guide\n",
            "## 1. Project Overview & Architecture",
            doc.summary,
            "",
            "## 2. Quick Start",
        ]

        qs = doc.quick_start
        manifest = facts.get("manifest", {})
        if manifest.get("monorepo_packages"):
            lines.append("- **Monorepo Packages Setup**:")
            for pkg in manifest["monorepo_packages"]:
                folder = pkg["folder"]
                lines.append(f"  - **`{folder}/`** ({pkg['manifest_type']}):")
                if pkg.get("install_command"):
                    lines.append(f"    - Install: `{pkg['install_command']}`")
                if pkg.get("run_command"):
                    lines.append(f"    - Run/Dev: `{pkg['run_command']}`")
                lines.append(f"    - Test: `{pkg['test_command']}`")
        else:
            if qs.install_command:
                lines.append(f"- **Install**: `{qs.install_command}`")
            if qs.run_command:
                lines.append(f"- **Run/Dev**: `{qs.run_command}`")
            if qs.test_command:
                if qs.test_command == "no tests found":
                    lines.append("- **Test**: no tests found")
                else:
                    cmd_type = f" ({qs.test_command_type})" if qs.test_command_type else ""
                    lines.append(f"- **Test**: `{qs.test_command}`{cmd_type}")
            else:
                lines.append("- **Test**: no tests found")
        if facts.get("grouped_env_variables"):
            lines.append("- **Environment Variables**:")
            for cat, items in facts["grouped_env_variables"].items():
                lines.append(f"  - **{cat}**:")
                for item in items:
                    usage = f" (read in code via {item['accessor']})" if item.get("read_in_code") else " (declared in .env.example)"
                    lines.append(f"    - `{item['key']}`{usage}")
        elif qs.env_variables:
            lines.append(f"- **Environment Variables**: {', '.join(qs.env_variables)}")
        else:
            lines.append("- **Environment Variables**: No .env.example declared in repository.")

        if doc.tech_stack:
            lines.append(f"- **Tech Stack**: {', '.join(doc.tech_stack)}")

        lines.append("\n## 3. Folder Map")
        if doc.folder_map:
            for fm in doc.folder_map:
                clean_p = fm.path.strip().rstrip("/")
                try:
                    cnt = int(fm.file_count)
                except (ValueError, TypeError):
                    cnt = 0
                plural = "1 file" if cnt == 1 else f"{cnt} files"
                samples = f" (e.g. {fm.sample_files})" if fm.sample_files else ""
                lines.append(f"- **`{clean_p}/`** ({plural}){samples}: {fm.role}")
        else:
            for fb in facts.get("folder_breakdown", []):
                clean_p = str(fb.get("path", "")).strip().rstrip("/")
                try:
                    cnt = int(fb.get("file_count", 0))
                except (ValueError, TypeError):
                    cnt = 0
                plural = "1 file" if cnt == 1 else f"{cnt} files"
                samples = f", e.g. {fb['sample_files']}" if fb.get("sample_files") else ""
                lines.append(f"- **`{clean_p}/`** ({plural}{samples})")

        lines.append("\n## 4. How It Works")
        lines.append(doc.how_it_works)

        lines.append("\n## 5. Files to Handle Carefully (High Blast Radius)")
        if doc.careful_files:
            for cf in doc.careful_files:
                deps_info = f"Total Dependents: {cf.dependents_count} (Source: {cf.source_dependents_count}, Tests: {cf.test_dependents_count})"
                lines.append(
                    f"- **[[{cf.path}]]** (Risk: {cf.risk_level}, {deps_info}, Coupling: {cf.coupling:.2f}):\n"
                    f"  {cf.reason}"
                )
        else:
            lines.append("- No single-point high-risk modules identified.")

        if doc.gotchas:
            lines.append("\n## 6. Repository Invariants & Gotchas")
            for g in doc.gotchas:
                lines.append(f"- **{g.title}** (Evidence: [[{g.evidence_path}]]):\n  {g.description}")

        lines.append("\n## 7. Recommended First Task")
        ft = doc.first_task
        lines.append(f"### {ft.title}")
        if ft.rationale:
            lines.append(ft.rationale)
        if ft.suggested_files:
            lines.append("\nSuggested starter files:")
            for sf in ft.suggested_files:
                test_str = f" | Test: [[{sf.nearby_test}]]" if sf.nearby_test else " | No dedicated test file detected"
                lines.append(
                    f"- **[[{sf.path}]]** ({sf.line_count} lines, {sf.source_dependents_count} source dependents{test_str}):\n"
                    f"  Verified purpose: {sf.verified_purpose}"
                )
        if ft.verification_steps:
            lines.append(f"\nVerification steps:\n{ft.verification_steps}")

        if doc.glossary:
            lines.append("\n## 8. Glossary")
            for gl in doc.glossary:
                lines.append(f"- **{gl.term}** (defined in [[{gl.defined_in}]]): {gl.definition}")

        return "\n".join(lines)

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

        # 1. Overwrite quick start with ground truth from manifest
        test_cmd = manifest.get("test_command")
        if facts.get("test_modules_count", 0) == 0:
            test_cmd = "no tests found"
        elif not test_cmd:
            test_cmd = "no tests found"

        parsed_schema.quick_start = QuickStartInfo(
            install_command=manifest.get("install_command") or "",
            run_command=manifest.get("run_command") or manifest.get("dev_command"),
            test_command=test_cmd,
            test_command_type=manifest.get("test_command_type") or "declared",
            env_variables=facts.get("env_variables", []),
        )

        # 2. Choose careful_files in code: Render every High-risk file from computed data
        # The model may only write the explanation, and only from the snippet
        model_reasons_by_path = {
            cf.path.replace("[[", "").replace("]]", "").strip(): cf.reason
            for cf in (parsed_schema.careful_files if parsed_schema else [])
        }

        computed_careful_files: list[CarefulFileItem] = []
        for hr in facts.get("high_risk_files", []):
            path = hr["path"]
            has_snippet = bool(hr.get("first_30_lines") and hr["first_30_lines"].strip())
            model_reason = model_reasons_by_path.get(path)

            source_deps = hr.get("source_dependents_count", 0)
            test_deps = hr.get("test_dependents_count", 0)

            # Model may only write explanation if snippet is present and explanation is grounded
            if has_snippet and model_reason and len(model_reason.strip()) > 10 and "not verified" not in model_reason.lower():
                reason = model_reason.strip()
            else:
                reason = (
                    f"Central junction module with {hr['dependents_count']} dependent modules "
                    f"(Source: {source_deps}, Tests: {test_deps}). "
                    "Modifying public interfaces affects downstream modules across the codebase."
                )

            computed_careful_files.append(CarefulFileItem(
                path=path,
                risk_level=hr.get("risk_level", "High"),
                dependents_count=hr.get("dependents_count", 0),
                source_dependents_count=source_deps,
                test_dependents_count=test_deps,
                coupling=hr.get("coupling", 0.0),
                reason=reason,
            ))
        parsed_schema.careful_files = computed_careful_files

        # 3. Filter gotchas: allow README and manifests as sources, but require that evidence chunk contains the claimed term
        valid_gotchas: list[GotchaItem] = []
        for g in parsed_schema.gotchas:
            clean_evidence = g.evidence_path.replace("[[", "").replace("]]", "").strip()
            if not _is_valid_source_file(clean_evidence, all_known_paths):
                drops.append(f"gotchas: dropped rule '{g.title}' (evidence_path '{g.evidence_path}' is not a recognized repository file)")
                continue

            content = await extractor.extract_file_content(clean_evidence)
            if not content:
                drops.append(f"gotchas: dropped rule '{g.title}' (evidence file '{clean_evidence}' has no indexed content)")
                continue

            # Verify that the evidence chunk contains the claimed term or title tokens
            title_tokens = [w for w in re.findall(r"[A-Za-z0-9_]+", g.title) if len(w) >= 4]
            term_matches = (g.title.lower() in content.lower()) or (title_tokens and any(tok.lower() in content.lower() for tok in title_tokens))
            if term_matches:
                g.evidence_path = clean_evidence
                valid_gotchas.append(g)
            else:
                drops.append(f"gotchas: dropped rule '{g.title}' (claimed term not found in chunk of '{clean_evidence}')")
        parsed_schema.gotchas = valid_gotchas

        # 4. Choose first_task in code, not the model. Pick starters from computed candidate_starters.
        computed_starters: list[StarterTaskItem] = []
        model_purposes = {
            st.path.replace("[[", "").replace("]]", "").strip(): st.verified_purpose
            for st in (parsed_schema.first_task.suggested_files if parsed_schema and parsed_schema.first_task else [])
        }

        candidate_starters = facts.get("candidate_starters", [])
        for cs in candidate_starters[:3]:
            cs_path = cs["path"]
            has_snippet = bool(cs.get("first_30_lines") and cs["first_30_lines"].strip())

            if not has_snippet:
                verified_purpose = "purpose not verified"
            else:
                model_exp = model_purposes.get(cs_path)
                if model_exp and model_exp.strip() and model_exp.strip().lower() != "purpose not verified":
                    verified_purpose = model_exp.strip()
                else:
                    verified_purpose = "Low-risk module verified from graph metrics."

            computed_starters.append(StarterTaskItem(
                path=cs_path,
                line_count=cs.get("line_count", 0),
                source_dependents_count=cs.get("source_dependents_count", 0),
                nearby_test=cs.get("nearby_test"),
                verified_purpose=verified_purpose,
            ))

        parsed_schema.first_task.suggested_files = computed_starters

        # Guard title and rationale of first_task (never infer from filename when purpose not verified)
        if computed_starters:
            top_st = computed_starters[0]
            file_name = PurePosixPath(top_st.path).name

            if top_st.verified_purpose == "purpose not verified":
                task_title = f"Add a test for {file_name}"
                task_rationale = (
                    f"Module [[{top_st.path}]] has low complexity ({top_st.line_count} lines) and "
                    f"{top_st.source_dependents_count} downstream source dependents. Adding unit test coverage "
                    "verifies the local development setup without risk of breaking other modules."
                )
            else:
                raw_title = (
                    parsed_schema.first_task.title.strip()
                    if (parsed_schema and parsed_schema.first_task and parsed_schema.first_task.title)
                    else ""
                )
                if not raw_title or raw_title in ("Explore Low-Risk Modules", "Recommended First Task"):
                    task_title = f"Add a test for {file_name}"
                else:
                    task_title = raw_title

                raw_rationale = (
                    parsed_schema.first_task.rationale.strip()
                    if (parsed_schema and parsed_schema.first_task and parsed_schema.first_task.rationale)
                    else ""
                )
                task_rationale = raw_rationale or (
                    f"Module [[{top_st.path}]] is an isolated leaf with {top_st.source_dependents_count} source dependents."
                )

            verification_steps = (
                parsed_schema.first_task.verification_steps.strip()
                if (parsed_schema and parsed_schema.first_task and parsed_schema.first_task.verification_steps)
                else (f"Run the test suite using `{facts.get('manifest', {}).get('test_command') or 'test runner'}` to verify changes.")
            )
        else:
            task_title = "Explore Repository Architecture"
            empty_reason = facts.get(
                "starter_empty_reason",
                "No low-risk starter modules identified: all core source modules have active dependents or are imported across the test suite."
            )
            task_rationale = empty_reason
            verification_steps = "Inspect entry points and run the verified test suite."

        parsed_schema.first_task.title = task_title
        parsed_schema.first_task.rationale = task_rationale
        parsed_schema.first_task.verification_steps = verification_steps

        # 5. Filter glossary: allow README and manifests as sources, but require that evidence chunk contains the claimed term
        valid_glossary: list[GlossaryItem] = []
        for item in parsed_schema.glossary:
            clean_p = item.defined_in.replace("[[", "").replace("]]", "").strip()
            if not _is_valid_source_file(clean_p, all_known_paths):
                drops.append(f"glossary: dropped term '{item.term}' (defined_in '{item.defined_in}' is not a recognized repository file)")
                continue

            content = await extractor.extract_file_content(clean_p)
            if not content:
                drops.append(f"glossary: dropped term '{item.term}' (defined_in '{clean_p}' has no indexed content)")
                continue

            # Require that the evidence file's chunk contains the claimed term
            if item.term.lower().strip() in content.lower():
                item.defined_in = clean_p
                valid_glossary.append(item)
            else:
                drops.append(f"glossary: dropped term '{item.term}' (term not found in chunk of '{clean_p}')")
        parsed_schema.glossary = valid_glossary

        self.last_facts_block = facts_block
        self.last_raw_json = raw_output
        self.last_drops = drops
        self.last_structured_doc = parsed_schema.model_dump()
        return self._render_schema_to_markdown(parsed_schema, facts)
