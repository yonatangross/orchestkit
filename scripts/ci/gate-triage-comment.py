#!/usr/bin/env python3
"""Gate triage model output before it is posted as a public issue comment
(#4747 review round 2, SHOULD 1; XREVIEW 6209271782).

The triage job reads attacker-influenceable issue text, so its output is
not trusted enough to post as Markdown. This script is the check the comment
job runs first:

- REJECT (exit 1, no output written) when the body is empty, over
  MAX_BYTES, or contains a token-shaped string (GitHub PAT/OAuth prefixes,
  Anthropic/OpenAI style sk- keys, Slack xox*, 1Password ops_ service
  tokens, AWS AKIA*, JWTs, PEM blocks).
- QUOTE (exit 0): the whole body is posted inside one fenced code block
  whose backtick fence is longer than any backtick run in the body, so the
  body cannot close it. Inside a fenced block GitHub renders text only: no
  mention notifies, no link or image is clickable or loaded, no HTML is
  parsed. This replaces rewriting mentions and links one form at a time
  (code spans, letter case, Markdown and reference links, raw HTML, hosts a
  browser and a URL parser read differently): each of those rewrites was a
  parser differential, and a fence closes the whole class.

Usage: gate-triage-comment.py <input.md> <output.md>
"""

import re
import sys

MAX_BYTES = 10000

# (rule name, pattern). The name, never the matched text, goes to the log:
# the rejection line lands in a public CI job log.
TOKEN_PATTERNS = [
    ("github-fine-grained-pat", re.compile(r"github_pat_[A-Za-z0-9_]{20,}")),
    ("github-token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}")),
    ("sk-key", re.compile(r"\bsk-[A-Za-z0-9_-]{16,}")),
    ("slack-token", re.compile(r"\bxox[bapors]-[A-Za-z0-9-]{8,}")),
    ("1password-service-token", re.compile(r"\bops_[A-Za-z0-9]{20,}")),
    ("aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}")),
    ("pem-private-key", re.compile(r"-{3,}\s*BEGIN [A-Z ]+PRIVATE KEY")),
]

HEADER = "Automated triage output, shown as plain text (links and mentions are inactive):"


def reject(reason: str) -> int:
    print(f"gate-triage-comment: rejected ({reason})", file=sys.stderr)
    return 1


def fence_for(text: str) -> str:
    longest = max((len(run) for run in re.findall(r"`+", text)), default=0)
    return "`" * max(3, longest + 1)


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 1
    try:
        with open(sys.argv[1], encoding="utf-8") as fh:
            text = fh.read()
    except OSError as exc:
        return reject(f"cannot read {sys.argv[1]}: {exc}")

    if not text.strip():
        return reject("empty body")
    if len(text.encode("utf-8")) > MAX_BYTES:
        return reject(f"over {MAX_BYTES} bytes")
    for rule, pat in TOKEN_PATTERNS:
        m = pat.search(text)
        if m:
            line = text.count("\n", 0, m.start()) + 1
            return reject(f"token-shaped string, rule {rule}, at {sys.argv[1]}:{line}")

    # A carriage return or other line break GitHub honors could end the
    # fence line early; normalize every line ending to \n first.
    body = re.sub(r"\r\n?|[  \x0b\x0c\x85]", "\n", text).rstrip("\n")
    fence = fence_for(body)

    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        fh.write(f"{HEADER}\n\n{fence}text\n{body}\n{fence}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
