"""Lumen server — the FastAPI 'brain'.

For now this only exposes a health check. The agent loop, tools, and ingestion
land in later phases (see PLAN.md).
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Lumen", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "lumen-server"}
