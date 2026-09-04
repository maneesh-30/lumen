"""Ask the agent a question from the command line (text-only test of the loop).

Usage: python ask_cli.py how does the vlm answer questions
"""
import sys

from app.agent.loop import answer

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

if __name__ == "__main__":
    question = " ".join(sys.argv[1:]) or "what does this project do"
    res = answer(question)
    print(f"Q: {question}\n")
    print("ANSWER:")
    print(f"  {res['answer']}\n")
    print("CITATIONS:")
    for c in res["citations"]:
        print(f"  [{c['id']}] {c['file']}:{c['start_line']}-{c['end_line']}")
    if not res["citations"]:
        print("  (none)")
    print("\nTRACE:")
    for t in res["trace"]:
        print(f"  {t}")
    print(f"\nabstained: {res['abstained']}")
