"""Run ingestion from the command line.

Usage: python ingest_cli.py [repo_dir] [repo_name] [workspace_id]
"""
import sys

from app.rag.ingest import ingest_repo

if __name__ == "__main__":
    repo_dir = sys.argv[1] if len(sys.argv) > 1 else "repos_storage/BlindSpot"
    repo_name = sys.argv[2] if len(sys.argv) > 2 else "BlindSpot"
    workspace_id = sys.argv[3] if len(sys.argv) > 3 else "demo"
    n = ingest_repo(repo_dir, repo_name, workspace_id)
    print(f"ingested {n} chunks from {repo_name} into workspace '{workspace_id}'")
