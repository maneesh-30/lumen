"""Embeddings via OpenRouter (OpenAI-compatible /embeddings endpoint)."""
from openai import OpenAI

from app.config import settings

_client = OpenAI(
    base_url=settings.openrouter_base_url,
    api_key=settings.openrouter_api_key,
)


def embed_texts(texts: list[str]) -> list[list[float]]:
    resp = _client.embeddings.create(model=settings.embed_model, input=texts)
    return [d.embedding for d in resp.data]
