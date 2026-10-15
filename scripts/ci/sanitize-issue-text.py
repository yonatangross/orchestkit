#!/usr/bin/env python3
"""Strip prompt-injection surfaces from a GitHub issue JSON dump.

Input:  `gh issue view <n> --json title,body` output.
Output: a markdown file safe to embed in a model prompt (#4747).

Order matters (review round 2, SHOULD 3): format characters come off FIRST.
If comments were stripped first, an opener split by a zero-width char
(`<!` + U+200B + two hyphens) survived the comment pass and the format
strip then produced a well-formed comment that reached the model.

Removal passes, in order:

- Unicode format characters (category Cf): zero-width spaces, joiners,
  directional marks, bidi embeddings/overrides/isolates, word joiners, the
  BOM, soft hyphens. All of Cf, not a named list, so future invisible
  format chars are covered. Cost: emoji ZWJ sequences lose their join,
  acceptable for triage input.
- Supplementary-plane variation selectors U+E0100 to U+E01EF (category Mn,
  the range used to smuggle text inside emoji sequences). The basic
  variation selectors U+FE00 to U+FE0F stay: they are real emoji modifiers.
- HTML comments, closed by two hyphens and `>` or by the abrupt close two
  hyphens, bang, `>` (both legal per the HTML spec).
- An UNCLOSED comment opener truncates the rest of the body. Fail closed:
  text after an opener the regex cannot close is treated as comment
  content, not released to the model.
- Link reference definition lines (`[label]: target`), which render
  invisibly in markdown and can carry a hidden URL.
- Output capped at MAX_CHARS so a giant body cannot flood the prompt.

Usage: sanitize-issue-text.py <input.json> <output.md>
Exit 1 on malformed input so the fetch job fails loudly instead of
uploading a silently empty artifact.
"""

import json
import re
import sys
import unicodedata

MAX_CHARS = 20000

# Supplementary variation selectors: U+E0100 to U+E01EF, category Mn.
VS_SUPPLEMENT = re.compile("[\U000e0100-\U000e01ef]")

HTML_COMMENT = re.compile(r"<!--[\s\S]*?(?:-->|--!>)")
HTML_OPEN = re.compile(r"<!--")

# Link reference definition: a line that is only `[label]: target`.
LINK_REF_DEF = re.compile(r"^[ \t]*\[[^\]]*\]:\s*\S.*$", re.MULTILINE)


def sanitize(title: str, body: str) -> str:
    text = "# " + title.strip() + "\n\n" + body
    text = "".join(c for c in text if unicodedata.category(c) != "Cf")
    text = VS_SUPPLEMENT.sub("", text)
    text = HTML_COMMENT.sub("[html comment removed]", text)
    if HTML_OPEN.search(text):
        idx = text.index("<!--")
        text = text[:idx] + "[html comment removed to end]"
    text = LINK_REF_DEF.sub("[link reference removed]", text)
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
