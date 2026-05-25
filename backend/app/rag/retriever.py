"""
DevLens AI — LangChain Retriever Wrapper
Wraps the pgvector VectorStore as a LangChain BaseRetriever so it can be
used directly in LCEL chains, RAG pipelines, and the ReAct agent's
retrieval-augmented context building.
"""

import uuid
from typing import List

from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from pydantic import Field

from app.rag.vector_store import VectorStore


class DevLensRetriever(BaseRetriever):
    """
    LangChain-compatible retriever backed by pgvector.

    Scopes all searches to a specific repository (repo_id) so that
    different users' codebases never bleed into each other's sessions.

    Usage:
        retriever = DevLensRetriever(vector_store=vs, repo_id=repo_uuid, top_k=6)
        docs = await retriever.aget_relevant_documents("how does auth work?")
    """

    vector_store: VectorStore = Field(...)
    repo_id: uuid.UUID = Field(...)
    top_k: int = Field(default=6)

    class Config:
        arbitrary_types_allowed = True

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> List[Document]:
        """Synchronous retrieval — not used in async context but required by base class."""
        raise NotImplementedError(
            "DevLensRetriever is async-only. Use aget_relevant_documents()."
        )

    async def _aget_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> List[Document]:
        """
        Run pgvector similarity search and return LangChain Document objects.

        Each Document's page_content is the code chunk content.
        Metadata carries file_path, language, start_line, end_line, chunk_type,
        and similarity score — all accessible to chains that need source citation.
        """
        results = await self.vector_store.similarity_search(
            query=query,
            repo_id=self.repo_id,
            top_k=self.top_k,
        )

        documents = []
        for r in results:
            doc = Document(
                page_content=r["content"],
                metadata={
                    "file_path": r["file_path"],
                    "language": r.get("language", ""),
                    "start_line": r.get("start_line"),
                    "end_line": r.get("end_line"),
                    "chunk_type": r.get("chunk_type", "code"),
                    "similarity": r.get("similarity", 0.0),
                    "repo_id": str(self.repo_id),
                },
            )
            documents.append(doc)

        return documents


def make_retriever(
    vector_store: VectorStore,
    repo_id: uuid.UUID,
    top_k: int = 6,
) -> DevLensRetriever:
    """
    Factory function to create a scoped retriever for a specific repo.

    Args:
        vector_store: The pgvector VectorStore instance.
        repo_id:      UUID of the repository to scope searches to.
        top_k:        Number of chunks to retrieve per query.

    Returns:
        DevLensRetriever ready for use in LangChain chains.
    """
    return DevLensRetriever(
        vector_store=vector_store,
        repo_id=repo_id,
        top_k=top_k,
    )
