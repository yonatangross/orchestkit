#!/usr/bin/env python3
"""Fail a PR while any bot review thread has no reply from a person or agent.

Operator word GROK-REVIEW-2121 (2026-10-22), items 1 and 2:
  1. NO SILENT RESOLVES. Every review thread a bot starts (CodeRabbit, Codex,
     any `[bot]` author) gets an in-thread reply: the fix commit link plus
     file:line plus the test, or won't-fix plus the reason. A thread is
     resolved only after the fix is verified.
  2. This is the repo-side check for item 1. It fails while any bot review
     thread has no later comment by a non-bot author, RESOLVED OR NOT: a
     resolved thread with no reply is exactly the silent resolve item 1 bans.

A thread a person starts is outside the rule. An agent replies through a user
account, so its reply counts as a reply. A bot replying to a bot does not.

Usage:
  review-thread-replies.py --repo OWNER/NAME --pr N   (reads GitHub via `gh`)
  review-thread-replies.py --threads-json FILE        (a reviewThreads.nodes
                                                       array; the test path)

Exit codes: 0 every bot thread has a reply, 1 at least one has none (each is
listed with file:line, state and link), 2 could not read the threads.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

QUERY = """
query($owner: String!, $name: String!, $pr: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          isResolved
          path
          line
          comments(first: 100) {
            pageInfo { hasNextPage }
            nodes { url author { login __typename } }
          }
        }
      }
    }
  }
}
"""


class ReadError(Exception):
    """The threads could not be read; the check cannot say pass or fail."""


def is_bot(author: object) -> bool:
    """A GitHub App (`__typename` Bot) or a login ending in `[bot]`."""
    if not isinstance(author, dict):
        return False  # a deleted account (author null) is not a bot reply
    login = str(author.get("login") or "")
    return author.get("__typename") == "Bot" or login.endswith("[bot]")


def evaluate(threads: list[dict]) -> tuple[int, list[str]]:
    """Return (bot thread count, one line per bot thread with no reply)."""
    bot_threads = 0
    failures: list[str] = []
    for thread in threads:
        comments_conn = thread.get("comments") or {}
        comments = comments_conn.get("nodes") or []
        if not comments or not is_bot(comments[0].get("author")):
            continue
        bot_threads += 1
        if any(not is_bot(c.get("author")) for c in comments[1:]):
            continue
        first = comments[0]
        who = (first.get("author") or {}).get("login") or "?"
        where = str(thread.get("path") or "?")
        if thread.get("line") is not None:
            where += f":{thread['line']}"
        state = "resolved with no reply" if thread.get("isResolved") else "open, no reply"
        if (comments_conn.get("pageInfo") or {}).get("hasNextPage"):
            state += " (thread has more than 100 comments; none of the first 100 is a reply)"
        failures.append(f"{where}  {who}  {state}  {first.get('url') or ''}".rstrip())
    return bot_threads, failures


def fetch(repo: str, pr: int) -> list[dict]:
    owner, _, name = repo.partition("/")
    if not owner or not name:
        raise ReadError(f"--repo must be OWNER/NAME, got {repo!r}")
    threads: list[dict] = []
    after: str | None = None
    while True:
        cmd = ["gh", "api", "graphql", "-f", f"query={QUERY}",
               "-F", f"owner={owner}", "-F", f"name={name}", "-F", f"pr={pr}"]
        if after:
            cmd += ["-F", f"after={after}"]
        run = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if run.returncode != 0:
            raise ReadError(f"gh api graphql exited {run.returncode}: {run.stderr.strip()[:300]}")
        try:
            conn = json.loads(run.stdout)["data"]["repository"]["pullRequest"]["reviewThreads"]
        except (ValueError, KeyError, TypeError) as exc:
            raise ReadError(f"unexpected GraphQL reply ({exc.__class__.__name__})") from exc
        threads.extend(conn.get("nodes") or [])
        page = conn.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            return threads
        after = page.get("endCursor")


def load(path: str) -> list[dict]:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ReadError(f"{path}: {exc}") from exc
    if not isinstance(data, list):
        raise ReadError(f"{path}: want a JSON array of review threads")
    return data


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Fail while any bot review thread has no reply.")
    ap.add_argument("--repo")
    ap.add_argument("--pr", type=int)
    ap.add_argument("--threads-json")
    args = ap.parse_args(argv)
    try:
        if args.threads_json:
            threads = load(args.threads_json)
        elif args.repo and args.pr:
            threads = fetch(args.repo, args.pr)
        else:
            ap.error("give --threads-json FILE, or --repo OWNER/NAME and --pr N")
    except ReadError as exc:
        print(f"review-thread-replies: could not read the review threads: {exc}", file=sys.stderr)
        return 2
    count, failures = evaluate(threads)
    if not failures:
        print(f"review-thread-replies: {count} bot review thread(s), all replied" if count
              else "review-thread-replies: 0 bot review thread(s)")
        return 0
    print(f"review-thread-replies: {len(failures)} of {count} bot review thread(s) have no reply "
          "from a person or agent. Reply in each thread (fix commit link + file:line + test, or "
          "won't-fix + reason), then resolve it:")
    for line in failures:
        print(f"  {line}")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
