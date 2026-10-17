#!/usr/bin/env python3
"""Test oracle for tests/ci/test-triage-comment-gate.sh (XREVIEW 6209271782).

Reads a gate output file and exits 1 if, after removing code (fenced blocks
and CommonMark code spans), any text could still notify someone or carry a
clickable link to a host outside the allowlist. Exit 0 means safe.

This is written apart from scripts/ci/gate-triage-comment.py on purpose: it
follows the CommonMark code span rule (a backtick run closes only at the next
run of the SAME length) so a gate that wraps text in backticks is checked by
the rule GitHub renders with, not by the gate's own idea of it.
"""

import re
import sys

ALLOWED = ("github.com", "www.github.com", "orchestkit.yonyon.ai")


def strip_code(text: str) -> str:
    # Fenced blocks first: a line of 3+ backticks or tildes opens, the same
    # char run of at least that length closes. Unclosed runs to the end.
    out, fence = [], None
    for line in text.split("\n"):
        m = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if fence is None and m:
            fence = m.group(1)
            continue
        if fence is not None:
            if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence):
                fence = None
            continue
        out.append(line)
    text = "\n".join(out)
    # Inline code spans.
    result, i = [], 0
    while i < len(text):
        if text[i] != "`":
            result.append(text[i])
            i += 1
            continue
        j = i
        while j < len(text) and text[j] == "`":
            j += 1
        run = j - i
        k = j
        close = -1
        while k < len(text):
            if text[k] == "`":
                e = k
                while e < len(text) and text[e] == "`":
                    e += 1
                if e - k == run:
                    close = k
                    break
                k = e
            else:
                k += 1
        if close < 0:
            result.append(text[i:j])  # literal backticks, no span
            i = j
        else:
            result.append(" ")
            i = close + run
    return "".join(result)


def host_ok(host: str) -> bool:
    host = host.lower()
    return host in ALLOWED or host.endswith(".github.com")


def problems(text: str):
    live = strip_code(text)
    found = []
    if re.search(r"(?<![A-Za-z0-9`])@[A-Za-z0-9]", live):
        found.append("live mention")
    # Host as a browser reads it: a backslash ends the authority like a slash,
    # and userinfo before the last @ is not the host.
    for m in re.finditer(r"(?i)\b[a-z][a-z0-9+.-]*://([^/\\?#\s)\]>\"'<]*)", live):
        if not host_ok(m.group(1).split("@")[-1].split(":")[0]):
            found.append(f"outside link {m.group(0)}")
    for m in re.finditer(r"(?i)(?<![A-Za-z0-9./])www\.([^/\s)\]>\"'<]+)", live):
        if not host_ok("www." + m.group(1)):
            found.append(f"www autolink {m.group(0)}")
    if re.search(r"\]\(", live):
        found.append("markdown link or image")
    if re.search(r"(?m)^ {0,3}\[[^\]]+\]:", live):
        found.append("reference definition")
    if re.search(r"<[A-Za-z!?/]", live):
        found.append("raw html (its text is not Markdown, so a wrap does not neutralize it)")
    return found


def main() -> int:
    with open(sys.argv[1], encoding="utf-8") as fh:
        found = problems(fh.read())
    for f in found:
        print(f"live-check: {f}", file=sys.stderr)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
