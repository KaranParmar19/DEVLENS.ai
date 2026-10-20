"""Embedder must never return fake vectors; failures must surface explicitly."""

import pytest

from app.core import embedder
from app.core.embedder import EmbeddingUnavailableError, embed_texts


async def test_empty_input_returns_empty():
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
