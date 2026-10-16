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
- REJECT (exit 1) Markdown that this gate cannot neutralize safely
  (XREVIEW 6209271782): a link or image whose target is not an absolute
  https URL on an allowlisted host, any reference definition (`[x]: url`),
  raw HTML links or embeds, and any backtick in a body that also holds a
  mention or an outside link (wrapping inside an existing code span can
  close that span and expose the mention or link).
- NEUTRALIZE (exit 0, rewritten output): `@` mentions are wrapped in code
  spans so they do not notify, and bare links (any letter case, plus www.
  autolinks) whose host is outside the allowlist (github.com,
  orchestkit.yonyon.ai) are wrapped in code spans so they are not
  clickable. Neutralization keeps the text readable while removing the
  public-side effect. It runs only on bodies with no backtick, so a wrap
  can never pair with a span that was already there.

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
URL = re.compile(r"(?i)\b(?:https?|ftp)://[^\s)\]>`'\"<]+")
WWW = re.compile(r"(?i)(?<![A-Za-z0-9./])www\.[^\s)\]>`'\"<]+")
ALLOWED_HOSTS = {"github.com", "www.github.com", "orchestkit.yonyon.ai"}

# Markdown and HTML forms that make a link the wrap cannot reach.
MD_LINK_TARGET = re.compile(r"\]\(\s*<?([^)\s>]*)")
MD_IMAGE = re.compile(r"!\[")
REF_DEFINITION = re.compile(r"(?m)^ {0,3}\[[^\]]+\]:")
HTML_LINK = re.compile(
    r"(?i)<\s*(?:a|img|iframe|video|audio|source|object|embed)\b|\b(?:href|src)\s*="
)


def host_allowed(url: str) -> bool:
    if url.lower().startswith("www."):
        url = "https://" + url
    host = (urlparse(url).hostname or "").lower()
    return host in ALLOWED_HOSTS or host.endswith(".github.com")


def allowed_absolute_https(url: str) -> bool:
    return url.lower().startswith("https://") and host_allowed(url)


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

    if MD_IMAGE.search(text):
        return reject("markdown image")
    for m in MD_LINK_TARGET.finditer(text):
        if not allowed_absolute_https(m.group(1)):
            return reject("markdown link to a target outside the allowlist")
    if REF_DEFINITION.search(text):
        return reject("markdown reference definition")
    if HTML_LINK.search(text):
        return reject("raw html link or embed")

    outside = [
        m.group(0)
        for pat in (URL, WWW)
        for m in pat.finditer(text)
        if not host_allowed(m.group(0))
    ]
    if "`" in text and (MENTION.search(text) or outside):
        return reject("backtick next to a mention or outside link")

    def neutralize_mention(m: re.Match) -> str:
        return f"`{m.group(0)}`"

    def neutralize_url(m: re.Match) -> str:
        return m.group(0) if host_allowed(m.group(0)) else f"`{m.group(0)}`"

    text = MENTION.sub(neutralize_mention, text)
    text = URL.sub(neutralize_url, text)
    text = WWW.sub(neutralize_url, text)

    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        fh.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
