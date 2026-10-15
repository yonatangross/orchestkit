#!/usr/bin/env python3
"""Strip prompt-injection surfaces from a GitHub issue JSON dump.

Input:  `gh issue view <n> --json title,body` output.
Output: a markdown file safe to embed in a model prompt (#4747).

Two removal passes, both aimed at text a reviewer cannot see but the model
can:

- HTML comments (`<!-- ... -->`) are removed. They render invisibly on
  github.com and are the documented carrier for hidden instructions in
  issue bodies (Microsoft, 2026-06-05). They are replaced with a marker so
  the model can tell something was stripped rather than guessing.
- Unicode format characters (category Cf) are removed: zero-width spaces,
  zero-width joiners/non-joiners, directional marks, bidi embeddings,
  overrides and isolates, word joiners, soft hyphens, the BOM. Removing all
  of Cf is deliberate over enumeration: any future invisible format char
  is covered without another list edit. The cost is that emoji ZWJ
  sequences lose their join, acceptable for triage input.

The output is capped at MAX_CHARS so a giant body cannot flood the prompt.

Usage: sanitize-issue-text.py <input.json> <output.md>
Exit 1 on malformed input so the fetch job fails loudly instead of
uploading a silently empty artifact.
"""

import json
import re
import sys
import unicodedata

MAX_CHARS = 20000

HTML_COMMENT = re.compile(r"<!--[\s\S]*?-->")


def sanitize(title: str, body: str) -> str:
    text = "# " + title.strip() + "\n\n" + body
    text = HTML_COMMENT.sub("[html comment removed]", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Cf")
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS] + "\n\n[truncated]"
    return text


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 1
    try:
        with open(sys.argv[1], encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"sanitize-issue-text: cannot read {sys.argv[1]}: {exc}", file=sys.stderr)
        return 1
    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        print("sanitize-issue-text: issue JSON has no title", file=sys.stderr)
        return 1
    body = data.get("body") or ""
    if not isinstance(body, str):
        body = str(body)
    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        fh.write(sanitize(title, body))
    return 0


if __name__ == "__main__":
    sys.exit(main())
