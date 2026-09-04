"""Qdrant vector store: one collection, per-workspace filtering.

Every point carries a `workspace_id` in its payload and searches filter on it, so
one workspace can never read another's data.
"""
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app.config import settings

COLLECTION = "lumen_chunks"

_client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)


def ensure_collection() -> None:
    existing = [c.name for c in _client.get_collections().collections]
    if COLLECTION not in existing:
        _client.create_collection(
            COLLECTION,
            vectors_config=VectorParams(size=settings.embed_dim, distance=Distance.COSINE),
        )


def upsert_chunks(chunks: list[dict], vectors: list[list[float]], workspace_id: str) -> None:
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vec,
            payload={**ch, "workspace_id": workspace_id},
        )
        for ch, vec in zip(chunks, vectors)
    ]
    _client.upsert(COLLECTION, points=points)


def search(vector: list[float], workspace_id: str, limit: int = 5):
    flt = Filter(must=[FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id))])
    return _client.query_points(
        COLLECTION, query=vector, query_filter=flt, limit=limit
    ).points
