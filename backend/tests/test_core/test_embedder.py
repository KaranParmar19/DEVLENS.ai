"""Embedder must never return fake vectors; failures must surface explicitly."""

import pytest

from app.core import embedder
from app.core.embedder import EmbeddingUnavailableError, embed_texts


async def test_empty_input_returns_empty(monkeypatch):
    assert await embed_texts([]) == []


async def test_missing_api_key_raises(monkeypatch):
    monkeypatch.setattr(embedder.settings, "openai_api_key", "   ")
    with pytest.raises(EmbeddingUnavailableError):
        await embed_texts(["def foo(): pass"])


async def test_provider_failure_raises_not_fake_vectors(monkeypatch):
    monkeypatch.setattr(embedder.settings, "openai_api_key", "AQ.fake-key")

    async def boom(client, batch, batch_start):
        raise RuntimeError("429 RESOURCE_EXHAUSTED")

    monkeypatch.setattr(embedder, "_embed_batch_with_retry", boom)
    with pytest.raises(EmbeddingUnavailableError):
        await embed_texts(["a", "b"])


async def test_success_returns_provider_vectors_in_order(monkeypatch):
    monkeypatch.setattr(embedder.settings, "openai_api_key", "AQ.fake-key")

    async def fake_batch(client, batch, batch_start):
        return [[float(len(t))] for t in batch]

    monkeypatch.setattr(embedder, "_embed_batch_with_retry", fake_batch)
    assert await embed_texts(["a", "bbb"]) == [[1.0], [3.0]]


def test_extract_retry_delay():
    from app.core.embedder import _extract_retry_delay

    class DummyExc(Exception):
        pass

    assert _extract_retry_delay(DummyExc("Please retry in 15.635s.")) == 15.635
    assert _extract_retry_delay(DummyExc("{'retryDelay': '15s'}")) == 15.0
    assert _extract_retry_delay(DummyExc("Rate limit reached. Retry after 2.5s")) == 2.5
    assert _extract_retry_delay(DummyExc("Generic 429 without time")) is None


async def test_rate_limit_fail_fast_on_quota(monkeypatch):
    from unittest.mock import AsyncMock
    from openai import RateLimitError
    import httpx

    response = httpx.Response(
        status_code=429,
        request=httpx.Request("POST", "http://localhost"),
        json={"error": {"message": "Resource exhausted: quota exceeded"}},
    )
    exc = RateLimitError("Resource exhausted: quota exceeded. retryDelay: 60s", response=response, body=None)

    mock_client = AsyncMock()
    mock_client.embeddings.create.side_effect = exc

    with pytest.raises(EmbeddingUnavailableError) as err:
        await embedder._embed_batch_with_retry(mock_client, ["test code"], 0)
    assert "Embedding provider rate limited or quota exceeded" in str(err.value)

