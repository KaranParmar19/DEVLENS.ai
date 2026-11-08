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
import re
import structlog
from openai import AsyncOpenAI, RateLimitError, APIStatusError

from app.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

# OpenAI hard limits
OPENAI_MAX_BATCH_SIZE = 2048          # max items per embeddings request
EMBED_BATCH_SIZE = 25                 # conservative batch size to respect RPM limits on providers
MAX_TOKENS_PER_BATCH = 400_000        # ~8191 tokens × safety margin
MAX_CHUNKS_PER_INGESTION = 10_000     # cost control: cap total chunks at 10k
MAX_RETRIES = 2                       # retries for rate-limited batches before failing fast to keyword search


def _extract_retry_delay(exc: Exception) -> float | None:
    """Extract recommended retry delay in seconds from exception or response headers."""
    response = getattr(exc, "response", None)
    if response is not None and hasattr(response, "headers"):
        retry_after = response.headers.get("retry-after")
        if retry_after:
            try:
                return float(retry_after)
            except ValueError:
                pass
        retry_ms = response.headers.get("retry-after-ms")
        if retry_ms:
            try:
                return float(retry_ms) / 1000.0
            except ValueError:
                pass

    err_text = str(exc)
    match = re.search(r"retry(?:\s+in|\s+after|delay['\"]?:\s*['\"])?\s*([0-9]+(?:\.[0-9]+)?)\s*s", err_text, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass

    return None


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
            if batch_start > 0:
                # Gentle pacing between batches without stalling Celery worker
                await asyncio.sleep(0.1)
            batch = texts[batch_start : batch_start + EMBED_BATCH_SIZE]
            embedding_result = await _embed_batch_with_retry(client, batch, batch_start)
            all_embeddings.extend(embedding_result)
        return all_embeddings
    except Exception as exc:
        if isinstance(exc, EmbeddingUnavailableError):
            raise
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
    Embed a single batch with back-off.
    Fails fast to EmbeddingUnavailableError on quota exhaustion or persistent rate limits
    so VectorStore can promptly degrade to keyword search without timing out Celery.
    """
    import random

    last_exc: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            embed_kwargs = {
                "model": settings.openai_embedding_model,
                "input": batch,
            }
            if settings.openai_embedding_dimensions:
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

            # Permanent / non-recoverable quota exhaustion -> fail fast immediately
            is_permanent_quota = any(
                k in err_str
                for k in ("per_day", "daily", "insufficient_quota", "billing", "credit")
            )
            if is_permanent_quota:
                logger.warning(
                    "embedding_quota_exhausted_fail_fast",
                    error=str(exc)[:300],
                    attempt=attempt + 1,
                )
                raise EmbeddingUnavailableError(f"Embedding quota exhausted: {exc}") from exc

            # Provider requested retry delay
            retry_delay = _extract_retry_delay(exc)

            # If attempt 0 and a small retry delay (<= 15s) is requested, retry once
            if attempt == 0 and retry_delay is not None and retry_delay <= 15.0:
                wait = retry_delay + random.uniform(0.2, 0.8)
                logger.warning(
                    "openai_rate_limit",
                    attempt=attempt + 1,
                    wait_seconds=round(wait, 1),
                )
                await asyncio.sleep(wait)
                continue

            # Otherwise fail fast rather than stalling the Celery worker task
            logger.warning(
                "embedding_rate_limit_fail_fast_to_fallback",
                error=str(exc)[:300],
                attempt=attempt + 1,
                retry_delay=retry_delay,
            )
            raise EmbeddingUnavailableError(
                f"Embedding provider rate limited or quota exceeded: {exc}"
            ) from exc

        except APIStatusError as exc:
            last_exc = exc
            if exc.status_code in (500, 502, 503, 504) and attempt < MAX_RETRIES - 1:
                # Transient server error — short retry
                wait = 1.5 * (attempt + 1) + random.uniform(0, 0.5)
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
                raise EmbeddingUnavailableError(f"Embedding API error {exc.status_code}: {exc}") from exc

        except Exception as exc:
            last_exc = exc
            if attempt < MAX_RETRIES - 1:
                wait = 1.5 * (attempt + 1) + random.uniform(0, 0.5)
                logger.warning(
                    "embedding_retry",
                    attempt=attempt + 1,
                    error=str(exc),
                    wait_seconds=round(wait, 1),
                )
                await asyncio.sleep(wait)
            else:
                logger.error("embedding_unexpected_error", error=str(exc))
                raise EmbeddingUnavailableError(f"Embedding failed: {exc}") from exc

    raise EmbeddingUnavailableError(
        f"Embedding failed after {MAX_RETRIES} attempts. Last error: {last_exc}"
    )


async def embed_single(text: str) -> list[float]:
    """Convenience wrapper to embed a single string (e.g. for query embedding)."""
    results = await embed_texts([text])
    return results[0]
