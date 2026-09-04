"""search_code — semantic search over ingested code chunks.

Returns the top matching chunks with their real file:line, for grounding answers.
"""
from app.rag import vectorstore
from app.rag.embeddings import embed_texts


def search_code(query: str, workspace_id: str = "demo", limit: int = 5) -> list[dict]:
    query_vec = embed_texts([query])[0]
    hits = vectorstore.search(query_vec, workspace_id, limit=limit)
    results = []
    for h in hits:
        p = h.payload or {}
        results.append({
            "score": h.score,
            "repo": p.get("repo"),
            "file": p.get("file"),
            "start_line": p.get("start_line"),
            "end_line": p.get("end_line"),
            "language": p.get("language"),
            "text": p.get("text"),
        })
    return results
