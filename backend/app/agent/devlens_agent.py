"""
DevLens AI - LangChain ReAct Agent
The AI brain of DevLens. Uses OpenAI-compatible LLMs (GPT-4o, Claude, Groq, Ollama, DeepSeek)
with custom tools grounded in PostgreSQL pgvector code chunks and NetworkX dependency graphs.
"""

import re
import uuid
import asyncio
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
        if qs.install_command:
            lines.append(f"- **Install**: `{qs.install_command}`")
        if qs.run_command:
            lines.append(f"- **Run/Dev**: `{qs.run_command}`")
        if qs.test_command:
            cmd_type = f" ({qs.test_command_type})" if qs.test_command_type else ""
            lines.append(f"- **Test**: `{qs.test_command}`{cmd_type}")
        if qs.env_variables:
            lines.append(f"- **Environment Variables**: {', '.join(qs.env_variables)}")
        else:
            lines.append("- **Environment Variables**: No .env.example declared in repository.")

        if doc.tech_stack:
            lines.append(f"- **Tech Stack**: {', '.join(doc.tech_stack)}")

        lines.append("\n## 3. Folder Map")
        if doc.folder_map:
            for fm in doc.folder_map:
                samples = f" (e.g. {fm.sample_files})" if fm.sample_files else ""
                lines.append(f"- **`{fm.path}/`** ({fm.file_count} files){samples}: {fm.role}")
        else:
            for fb in facts.get("folder_breakdown", []):
                lines.append(f"- **`{fb['path']}/`** ({fb['file_count']} files, e.g. {fb['sample_files']})")

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
        parsed_schema.quick_start = QuickStartInfo(
            install_command=manifest.get("install_command") or "",
            run_command=manifest.get("run_command") or manifest.get("dev_command"),
            test_command=manifest.get("test_command"),
            test_command_type=manifest.get("test_command_type") or "declared",
            env_variables=facts.get("env_variables", []),
        )

        # 2. Filter & overwrite careful_files with ground truth file_metrics
        valid_careful_files: list[CarefulFileItem] = []
        for cf in parsed_schema.careful_files:
            clean_path = cf.path.replace("[[", "").replace("]]", "").strip()
            if clean_path in file_metrics:
                m = file_metrics[clean_path]
                cf.path = clean_path
                cf.risk_level = m["risk_level"]
                cf.dependents_count = m["dependents_count"]
                cf.source_dependents_count = m["source_dependents_count"]
                cf.test_dependents_count = m["test_dependents_count"]
                cf.coupling = m["coupling"]
                valid_careful_files.append(cf)
            else:
                drops.append(f"careful_files: dropped '{cf.path}' (not in repository graph metrics)")

        if not valid_careful_files and facts.get("high_risk_files"):
            for hr in facts["high_risk_files"][:4]:
                valid_careful_files.append(CarefulFileItem(
                    path=hr["path"],
                    risk_level=hr["risk_level"],
                    dependents_count=hr["dependents_count"],
                    source_dependents_count=hr.get("source_dependents_count", 0),
                    test_dependents_count=hr.get("test_dependents_count", 0),
                    coupling=hr["coupling"],
                    reason=f"Central junction module with {hr['dependents_count']} dependent modules. Modifying this file affects downstream consumers.",
                ))
        parsed_schema.careful_files = valid_careful_files

        # 3. Drop gotchas without valid evidence path in repository
        valid_gotchas: list[GotchaItem] = []
        for g in parsed_schema.gotchas:
            clean_evidence = g.evidence_path.replace("[[", "").replace("]]", "").strip()
            if clean_evidence in all_known_paths:
                g.evidence_path = clean_evidence
                valid_gotchas.append(g)
            else:
                drops.append(f"gotchas: dropped rule '{g.title}' (evidence_path '{g.evidence_path}' is not an indexed file)")
        parsed_schema.gotchas = valid_gotchas

        # 4. Filter starter tasks: must exist in repo and respect verified_purpose
        valid_starters: list[StarterTaskItem] = []
        fact_starters_by_path = {cs["path"]: cs for cs in facts.get("candidate_starters", [])}
        for st in parsed_schema.first_task.suggested_files:
            clean_path = st.path.replace("[[", "").replace("]]", "").strip()
            if clean_path in fact_starters_by_path:
                cs = fact_starters_by_path[clean_path]
                st.path = clean_path
                st.line_count = cs["line_count"]
                st.source_dependents_count = cs["source_dependents_count"]
                st.nearby_test = cs.get("nearby_test")
                if not cs.get("first_30_lines"):
                    st.verified_purpose = "purpose not verified"
                valid_starters.append(st)
            else:
                drops.append(f"starter_tasks: dropped '{st.path}' (not in candidate starters list)")

        if not valid_starters and facts.get("candidate_starters"):
            for cs in facts["candidate_starters"][:3]:
                valid_starters.append(StarterTaskItem(
                    path=cs["path"],
                    line_count=cs["line_count"],
                    source_dependents_count=cs["source_dependents_count"],
                    nearby_test=cs.get("nearby_test"),
                    verified_purpose="purpose not verified" if not cs.get("first_30_lines") else "Low risk module verified from graph.",
                ))
        parsed_schema.first_task.suggested_files = valid_starters

        # 5. Filter glossary: defined_in must exist in repo
        valid_glossary = []
        for item in parsed_schema.glossary:
            clean_p = item.defined_in.replace("[[", "").replace("]]", "").strip()
            if clean_p in all_known_paths:
                item.defined_in = clean_p
                valid_glossary.append(item)
            else:
                drops.append(f"glossary: dropped term '{item.term}' (defined_in '{item.defined_in}' is not an indexed file)")
        parsed_schema.glossary = valid_glossary

        self.last_facts_block = facts_block
        self.last_raw_json = raw_output
        self.last_drops = drops
        self.last_structured_doc = parsed_schema.model_dump()
        return self._render_schema_to_markdown(parsed_schema, facts)
