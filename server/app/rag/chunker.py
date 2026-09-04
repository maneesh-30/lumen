"""Split a cloned repo into small, line-labeled chunks.

Each chunk keeps its file path and exact line range, so answers can cite a real
`file:line` and the UI can show the source at the right spot.
"""
import os

TEXT_EXTS = {
    ".py", ".md", ".txt", ".html", ".js", ".ts", ".tsx", ".jsx", ".json",
    ".yaml", ".yml", ".toml", ".cfg", ".ini", ".sh", ".css", ".go", ".rs",
    ".java", ".c", ".cpp", ".h",
}
MAX_FILE_BYTES = 200_000
CHUNK_LINES = 50
OVERLAP = 8


def chunk_repo(repo_dir: str, repo_name: str) -> list[dict]:
    chunks: list[dict] = []
    for root, dirs, files in os.walk(repo_dir):
        if ".git" in dirs:
            dirs.remove(".git")
        for fn in files:
            ext = os.path.splitext(fn)[1].lower()
            if ext not in TEXT_EXTS:
                continue
            path = os.path.join(root, fn)
            try:
                if os.path.getsize(path) > MAX_FILE_BYTES:
                    continue
                with open(path, encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
            except OSError:
                continue

            rel = os.path.relpath(path, repo_dir).replace("\\", "/")
            i = 0
            while i < len(lines):
                seg = lines[i:i + CHUNK_LINES]
                text = "".join(seg).strip()
                if text:
                    chunks.append({
                        "repo": repo_name,
                        "file": rel,
                        "start_line": i + 1,
                        "end_line": i + len(seg),
                        "language": ext.lstrip("."),
                        "text": text,
                    })
                if i + CHUNK_LINES >= len(lines):
                    break
                i += CHUNK_LINES - OVERLAP
    return chunks
