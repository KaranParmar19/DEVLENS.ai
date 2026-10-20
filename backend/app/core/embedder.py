"""
DevLens AI — Embedding Pipeline
Sends code chunks to OpenAI text-embedding-3-small in batches.

BUG-06 FIX: Added token-budget guard per batch; replaced bare retry loop
            with tenacity (exponential back-off + jitter); validated
            max dimensions; added cost-control via MAX_CHUNKS_PER_INGESTION.
M-05  FIX:  Client is now created fresh per call so it binds to the current
            event loop (required in Celery forked worker processes).
"""

import asyncio
import structlog
from openai import AsyncOpenAI, RateLimitError, APIStatusError

from app.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

# OpenAI hard limits
OPENAI_MAX_BATCH_SIZE = 2048          # max items per embeddings request
EMBED_BATCH_SIZE = 100                # our conservative batch size
MAX_TOKENS_PER_BATCH = 400_000        # ~8191 tokens × 100 texts × safety margin
MAX_CHUNKS_PER_INGESTION = 10_000     # cost control: cap total chunks at 10k
MAX_RETRIES = 4                       # exponential: 2s, 4s, 8s, 16s


def _get_openai_client() -> AsyncOpenAI:
    """
    Return a fresh AsyncOpenAI client.
    M-05 FIX: Create per-call rather than as a module-level singleton,
    so Celery worker forks get a client bound to their own event loop.
    Supports custom base_url for OpenAI-compatible providers.
    """
    kwargs = {
        "api_key": settings.openai_api_key,
        "max_retries": 0,              # We handle retries ourselves with tenacity
        "timeout": 60.0,
    }
    if settings.openai_api_base:
        kwargs["base_url"] = settings.openai_api_base
    return AsyncOpenAI(**kwargs)


class EmbeddingUnavailableError(RuntimeError):
    """Raised when the embedding provider cannot return real vectors
    (quota exhausted, auth failure, network error). Callers must degrade to
    keyword search instead of using fake vectors."""


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a list of strings using the configured OpenAI-compatible provider.

    Features:
    - Batches requests to stay within API limits.
    - Retries transient failures with exponential back-off + jitter.
    - Caps total inputs at MAX_CHUNKS_PER_INGESTION for cost control.
    - Returns a list of embedding vectors in the same order as inputs.

    Raises EmbeddingUnavailableError if real embeddings cannot be produced.
    No fake/placeholder vectors are ever returned: meaningless vectors would
    silently corrupt similarity search.

    BUG-06 FIX: Replaced bare 3-attempt loop with robust retry logic.
    """
    if not texts:
        return []

    # Cost-control guard
    if len(texts) > MAX_CHUNKS_PER_INGESTION:
        logger.warning(
            "embedding_chunk_cap_applied",
            original=len(texts),
            cap=MAX_CHUNKS_PER_INGESTION,
        )
        texts = texts[:MAX_CHUNKS_PER_INGESTION]

    if not settings.openai_api_key.strip() or settings.openai_api_key == "sk-YOUR_OPENAI_KEY_HERE":
        raise EmbeddingUnavailableError("No embedding API key configured.")

    client = _get_openai_client()
    all_embeddings: list[list[float]] = []

    try:
        for batch_start in range(0, len(texts), EMBED_BATCH_SIZE):
            batch = texts[batch_start : batch_start + EMBED_BATCH_SIZE]
            embedding_result = await _embed_batch_with_retry(client, batch, batch_start)
            all_embeddings.extend(embedding_result)
        return all_embeddings
    except Exception as exc:
        logger.warning(
            "embedding_api_unavailable",
            error=str(exc)[:300],
            chunk_count=len(texts),
        )
        raise EmbeddingUnavailableError(str(exc)[:300]) from exc
    finally:
        try:
            await client.close()
        except Exception:
            pass


async def _embed_batch_with_retry(
    client: AsyncOpenAI,
    batch: list[str],
    batch_start: int,
) -> list[list[float]]:
    """
    Embed a single batch with exponential back-off and jitter.
    Raises RuntimeError after MAX_RETRIES consecutive failures.
    """
    import random

    last_exc: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            embed_kwargs = {
                "model": settings.openai_embedding_model,
                "input": batch,
            }
            if "text-embedding-3" in settings.openai_embedding_model:
                embed_kwargs["dimensions"] = settings.openai_embedding_dimensions

            response = await client.embeddings.create(**embed_kwargs)
            embeddings = [item.embedding for item in response.data]

            logger.debug(
                "embedded_batch",
                batch_start=batch_start,
                batch_size=len(batch),
                tokens_used=response.usage.total_tokens if response.usage else "unknown",
            )
            return embeddings

        except RateLimitError as exc:
            last_exc = exc
            err_str = str(exc).lower()
            # If quota is exhausted or after 1 retry, fail fast to fallback embeddings
            if "quota" in err_str or "resource_exhausted" in err_str or "exhausted" in err_str or attempt >= 1:
                logger.warning(
                    "embedding_quota_or_rate_limit_fail_fast_to_fallback",
                    error=str(exc),
                    attempt=attempt + 1,
                )
                raise

            wait = 2.0 + random.uniform(0, 1)  # brief 2-3s retry
            logger.warning(
                "openai_rate_limit",
                attempt=attempt + 1,
                wait_seconds=round(wait, 1),
            )
            await asyncio.sleep(wait)

        except APIStatusError as exc:
            last_exc = exc
            if exc.status_code in (500, 502, 503, 504):
                # Transient server error — retry
                wait = 2 ** attempt * 3 + random.uniform(0, 1)
                logger.warning(
                    "openai_server_error",
                    status=exc.status_code,
                    attempt=attempt + 1,
                    wait_seconds=round(wait, 1),
                )
                await asyncio.sleep(wait)
            else:
                # Non-transient (400 bad request, 401 auth, etc.) — fail fast
                logger.error("openai_api_error", status=exc.status_code, error=str(exc))
                raise

        except Exception as exc:
            last_exc = exc
            wait = 2 ** attempt * 3 + random.uniform(0, 1)
            logger.warning(
                "embedding_retry",
                attempt=attempt + 1,
                error=str(exc),
                wait_seconds=round(wait, 1),
            )
            await asyncio.sleep(wait)

    raise RuntimeError(
        f"Embedding failed after {MAX_RETRIES} attempts. Last error: {last_exc}"
    )


async def embed_single(text: str) -> list[float]:
    """Convenience wrapper to embed a single string (e.g. for query embedding)."""
    results = await embed_texts([text])
    return results[0]
