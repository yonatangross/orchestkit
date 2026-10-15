#!/usr/bin/env python3
"""Gate triage model output before it is posted as a public issue comment
(#4747 review round 2, SHOULD 1).

The triage job reads attacker-influenceable issue text, so its output is
not trusted enough to post verbatim. This script is the check the comment
job runs first:

- REJECT (exit 1, no output written) when the body is empty, over
  MAX_BYTES, or contains a token-shaped string (GitHub PAT/OAuth prefixes,
  Anthropic/OpenAI style sk- keys, Slack xox*, 1Password ops_ service
  tokens, AWS AKIA*, JWTs, PEM blocks).
- NEUTRALIZE (exit 0, rewritten output): `@` mentions are wrapped in code
  spans so they do not notify, and links whose host is outside the
  allowlist (github.com, orchestkit.yonyon.ai) are wrapped in code spans so
  they are not clickable. Neutralization keeps the text readable while
  removing the public-side effect.

Usage: gate-triage-comment.py <input.md> <output.md>
"""

import re
import sys
from urllib.parse import urlparse

MAX_BYTES = 10000

TOKEN_PATTERNS = [
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"\bxox[bapors]-[A-Za-z0-9-]{8,}"),
    re.compile(r"\bops_[A-Za-z0-9]{20,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}"),
    re.compile(r"-{3,}\s*BEGIN [A-Z ]+PRIVATE KEY"),
]

MENTION = re.compile(r"@([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:/[A-Za-z0-9_-]+)?)")
URL = re.compile(r"https?://[^\s)\]>`'\"]+")
ALLOWED_HOSTS = {"github.com", "www.github.com", "orchestkit.yonyon.ai"}


def reject(reason: str) -> int:
    print(f"gate-triage-comment: rejected ({reason})", file=sys.stderr)
    return 1


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
    for pat in TOKEN_PATTERNS:
        m = pat.search(text)
        if m:
            return reject(f"token-shaped string ({m.group(0)[:12]}...)")

    def neutralize_mention(m: re.Match) -> str:
        return f"`{m.group(0)}`"

    def neutralize_url(m: re.Match) -> str:
        host = urlparse(m.group(0)).hostname or ""
        host = host.lower()
        allowed = host in ALLOWED_HOSTS or host.endswith(".github.com")
        return m.group(0) if allowed else f"`{m.group(0)}`"

    text = MENTION.sub(neutralize_mention, text)
    text = URL.sub(neutralize_url, text)

    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        fh.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
