"""Quick retrieval test from the command line.

Usage: python query_cli.py how does audio capture work
"""
import sys

from app.tools.search_code import search_code

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) or "how does it work"
    print(f"query: {query}\n")
    for r in search_code(query):
        print(f"[{r['score']:.3f}] {r['file']}:{r['start_line']}-{r['end_line']}")
        preview = " ".join(r["text"].split())[:180]
        print(f"    {preview}")
        print("---")
