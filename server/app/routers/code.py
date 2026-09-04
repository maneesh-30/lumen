"""Code endpoint — returns a slice of a source file for the code sidebar."""
import os

from fastapi import APIRouter, HTTPException

from app.config import settings

router = APIRouter(prefix="/api", tags=["code"])


@router.get("/code")
def get_code(repo: str, path: str, start: int = 1, end: int = 0, context: int = 3) -> dict:
    base = os.path.abspath(settings.repos_storage_path)
    full = os.path.abspath(os.path.join(base, repo, path))

    # security: never read outside the repos storage directory
    if not (full == base or full.startswith(base + os.sep)):
        raise HTTPException(status_code=400, detail="invalid path")
    if not os.path.isfile(full):
        raise HTTPException(status_code=404, detail="file not found")

    with open(full, encoding="utf-8", errors="ignore") as f:
        all_lines = f.readlines()
    n = len(all_lines)

    end = end if end and end >= start else start
    s = max(1, start - context)
    e = min(n, end + context)
    lines = [{"n": i, "text": all_lines[i - 1].rstrip("\n")} for i in range(s, e + 1)]

    return {
        "repo": repo, "path": path,
        "start": start, "end": end,
        "lines": lines,
    }
