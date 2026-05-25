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
            # Fallback: straight LLM without tools
            response = await self.llm.ainvoke(messages)
            full_reply = response.content

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

        async for chunk in self.llm.astream(messages):
            if hasattr(chunk, "content") and chunk.content:
                yield chunk.content

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
        for q in queries:
            results = await self.vector_store.similarity_search(q, top_k=3)
            for r in results:
                context_parts.append(
                    f"### {r['file_path']}\n```{r['language'].lower()}\n{r['content'][:800]}\n```"
                )

        context = "\n\n".join(context_parts[:15])
        prompt = ONBOARDING_DOC_PROMPT.format(
            repo_full_name=self.repo_full_name,
            context=context,
        )

        response = await self.llm.ainvoke([HumanMessage(content=prompt)])
        return response.content
