"""
DevLens AI — Embedding Pipeline
Sends code chunks to OpenAI text-embedding-3-small in batches.
Handles retries, rate limits, and batch size limits.
Stores results directly to PostgreSQL via pgvector.
"""

import asyncio
import structlog
from openai import AsyncOpenAI

from app.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

# OpenAI allows up to 2048 inputs per batch, but we stay conservative
EMBED_BATCH_SIZE = 100

_openai_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    """Singleton OpenAI async client."""
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai_client


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a list of strings using OpenAI text-embedding-3-small.
    Batches requests to stay within API limits.
    Retries on transient failures with exponential backoff.
    Returns a list of embedding vectors in the same order as inputs.
    """
    client = get_openai_client()
    all_embeddings: list[list[float]] = []

    # Process in batches
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[i : i + EMBED_BATCH_SIZE]

        for attempt in range(3):
            try:
                response = await client.embeddings.create(
                    model=settings.openai_embedding_model,
                    input=batch,
                    dimensions=settings.openai_embedding_dimensions,
                )
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
                logger.debug(
                    "embedded_batch",
                    batch_start=i,
                    batch_size=len(batch),
                    total_so_far=len(all_embeddings),
                )
                break
            except Exception as exc:
                wait = 2 ** attempt * 5
                logger.warning(
                    "embedding_retry",
                    attempt=attempt + 1,
                    error=str(exc),
                    wait_seconds=wait,
                )
                if attempt == 2:
                    raise
                await asyncio.sleep(wait)

    return all_embeddings


async def embed_single(text: str) -> list[float]:
    """Convenience wrapper to embed a single string (e.g. for query embedding)."""
    results = await embed_texts([text])
    return results[0]
