"""Ingest a cloned repo: chunk -> embed -> store in Qdrant."""
from app.rag import vectorstore
from app.rag.chunker import chunk_repo
from app.rag.embeddings import embed_texts


def ingest_repo(repo_dir: str, repo_name: str, workspace_id: str = "demo", batch_size: int = 64) -> int:
    vectorstore.ensure_collection()
    chunks = chunk_repo(repo_dir, repo_name)
    total = 0
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        vectors = embed_texts([c["text"] for c in batch])
        vectorstore.upsert_chunks(batch, vectors, workspace_id)
        total += len(batch)
    return total
