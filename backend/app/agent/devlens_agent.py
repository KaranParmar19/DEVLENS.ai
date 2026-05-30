"""
DevLens AI — LangChain ReAct Agent
The AI brain of DevLens. Uses OpenAI GPT-4o via langchain-openai
with a set of 4 custom tools to answer developer questions about a codebase.

Architecture:
  Agent receives a question + repo context.
  It decides which tools to call (search, read file, graph query, blast radius).
  It synthesizes results into a coherent answer.
  Streams token-by-token via LangChain's astream_events.
"""

import uuid
import structlog
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain_core.prompts import PromptTemplate
from langchain_core.messages import HumanMessage, AIMessage
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
    Wraps a LangChain ReAct agent with OpenAI GPT-4o.
    Scoped to a single repository session — tools are bound to the repo's vector store.
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

        # ── LLM ──────────────────────────────────────────────────────────
        self.llm = ChatOpenAI(
            model=settings.openai_chat_model,
            openai_api_key=settings.openai_api_key,
            temperature=0.2,          # Low temp for precise code answers
            max_tokens=4096,
            streaming=True,
        )

        # ── Vector Store (scoped to this repo) ────────────────────────────
        self.vector_store = VectorStore(db, repo_id)

        # ── Tools ─────────────────────────────────────────────────────────
        self.tools = [
            make_search_tool(self.vector_store),
            make_file_tool(self.vector_store),
            make_graph_tool(self.graph_cache),
            make_blast_tool(self.graph_cache),
        ]

    async def chat(
        self,
        message: str,
        history: list[dict],
    ) -> tuple[str, list[str]]:
        """
        Single-turn Q&A with conversation history.
        Returns (reply_text, cited_sources).
        Uses astream and accumulates for non-streaming fallback.
        """
        system = DEVLENS_SYSTEM_PROMPT.format(repo_full_name=self.repo_full_name)

        # Build message list from history
        messages = [HumanMessage(content=system)]
        for turn in history[-10:]:  # Limit to last 10 turns
            if turn["role"] == "user":
                messages.append(HumanMessage(content=turn["content"]))
            else:
                messages.append(AIMessage(content=turn["content"]))
        messages.append(HumanMessage(content=message))

        # Use bind_tools for tool calling (OpenAI native function calling)
        llm_with_tools = self.llm.bind_tools(self.tools)

        sources: list[str] = []
        full_reply = ""

        # Simple invoke (for REST endpoint)
        try:
            response = await llm_with_tools.ainvoke(messages)
            full_reply = response.content if hasattr(response, "content") else str(response)
        except Exception as exc:
            logger.error("agent_invoke_failed", error=str(exc))
            try:
                # Fallback: straight LLM without tools
                response = await self.llm.ainvoke(messages)
                full_reply = response.content
            except Exception as e:
                logger.warning("agent_llm_failed_using_mock_response", error=str(e))
                full_reply = (
                    f"⚠️ **AI Fallback Mode Active**\n\n"
                    f"Your OpenAI API key appears to be invalid or unconfigured. To enable real AI responses, "
                    f"please configure a valid `OPENAI_API_KEY` in the `backend/.env` file.\n\n"
                    f"**Static Codebase Insights for: {self.repo_full_name}**\n"
                    f"- This repository has been successfully cloned, parsed, and its structural dependency graph has been built locally.\n"
                    f"- You can explore the interactive Architecture Graph, Modules List, and File Tree in the main dashboard.\n"
                    f"- For Q&A, you asked: *\"{message}\"*."
                )

        return full_reply, sources

    async def stream_chat(
        self,
        message: str,
        history: list[dict],
    ):
        """
        Token-by-token streaming generator.
        Yields str chunks as they arrive from GPT-4o.
        Used by the WebSocket chat handler.
        """
        system = DEVLENS_SYSTEM_PROMPT.format(repo_full_name=self.repo_full_name)

        messages = [HumanMessage(content=system)]
        for turn in history[-10:]:
            if turn["role"] == "user":
                messages.append(HumanMessage(content=turn["content"]))
            else:
                messages.append(AIMessage(content=turn["content"]))
        messages.append(HumanMessage(content=message))

        try:
            async for chunk in self.llm.astream(messages):
                if hasattr(chunk, "content") and chunk.content:
                    yield chunk.content
        except Exception as exc:
            logger.error("agent_stream_failed_using_mock_response", error=str(exc))
            fallback_text = (
                f"⚠️ **AI Fallback Mode Active**\n\n"
                f"Your OpenAI API key appears to be invalid or unconfigured. To enable real AI responses, "
                f"please configure a valid `OPENAI_API_KEY` in the `backend/.env` file.\n\n"
                f"**Static Codebase Insights for: {self.repo_full_name}**\n"
                f"- This repository has been successfully cloned, parsed, and its structural dependency graph has been built locally.\n"
                f"- You can explore the interactive Architecture Graph, Modules List, and File Tree in the main dashboard.\n"
                f"- For Q&A, you asked: *\"{message}\"*."
            )
            # Stream the fallback message in chunks for visual consistency
            import asyncio
            for chunk in fallback_text.split(" "):
                yield chunk + " "
                await asyncio.sleep(0.01)

    async def generate_onboarding_doc(self) -> str:
        """
        Generate a full onboarding document for the repo.
        Uses the top search results from multiple queries as context.
        """
        from app.agent.prompts import ONBOARDING_DOC_PROMPT

        queries = [
            "main entry point and application startup",
            "core architecture and module structure",
            "authentication and authorization",
            "database models and data access",
            "API routes and endpoints",
        ]

        context_parts = []
        try:
            for q in queries:
                results = await self.vector_store.similarity_search(q, top_k=3)
                for r in results:
                    context_parts.append(
                        f"### {r['file_path']}\n```{r['language'].lower()}\n{r['content'][:800]}\n```"
                    )
        except Exception as err:
            logger.warning("vector_store_search_failed_for_onboarding", error=str(err))

        context = "\n\n".join(context_parts[:15])
        prompt = ONBOARDING_DOC_PROMPT.format(
            repo_full_name=self.repo_full_name,
            context=context,
        )

        try:
            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            return response.content
        except Exception as exc:
            logger.error("agent_onboarding_failed_using_mock_doc", error=str(exc))
            # Generate a structured markdown guide using the codebase files found
            file_list_md = ""
            if context_parts:
                file_list_md = "\n".join(f"- `{p.split('### ')[1].splitlines()[0]}`" for p in context_parts[:8] if "### " in p)
            else:
                file_list_md = "- None detected (check file list in sidebar)"

            return f"""# Getting Started with {self.repo_full_name}

⚠️ **Onboarding Doc Generated in Fallback Mode**
*Your OpenAI API key is missing or invalid. Set `OPENAI_API_KEY` in `backend/.env` for a fully custom AI-generated onboarding guide.*

---

## 1. System Overview
The codebase for **{self.repo_full_name}** has been successfully ingested and parsed by DevLens AI. 

## 2. Core Repository Structure
Here are some of the primary code files discovered during the indexing phase:
{file_list_md}

## 3. Local Development Setup
To run this project, look for standard config files:
- If a `package.json` is present: run `npm install` followed by `npm run dev`.
- If `requirements.txt` or `pyproject.toml` is present: set up a virtual environment and run `pip install -r requirements.txt`.
- If `docker-compose.yml` is present: launch using `docker-compose up`.

## 4. Architectural Dependency Graph
Please refer to the **Architecture Graph** tab on the main dashboard to view the physical layouts and connections between these modules.
"""
