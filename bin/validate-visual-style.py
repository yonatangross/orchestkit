#!/usr/bin/env python3
"""Validate text against the OrchestKit visual-style vocabulary.

Single source of truth for the emoji rules in `src/rules/visual-style.md`.
Both the CI workflow (.github/workflows/visual-style-lint.yml) and the local
pre-flight (bin/check-pr-visual-style.sh) call this script, so "passes locally"
is identical to "passes CI" — no duplicated, drift-prone vocab.

Two modes:
  --mode title   PR titles must be plain ASCII: ANY emoji is a violation.
  --mode body    PR bodies allow ONLY the closed vocabulary below; any emoji
                 outside it (decorative / LLM echo-chamber glyphs) fails.

Input precedence: positional FILE arg → --env VAR → stdin.

Exit codes: 0 = clean, 1 = violation(s) found, 2 = usage error.

When GITHUB_ACTIONS=true (or --github), violations print as ::error:: workflow
commands; otherwise plain human-readable lines for local use.
"""

from __future__ import annotations

import argparse
import os
import sys
import unicodedata

# The closed vocabulary from src/rules/visual-style.md. Keep BYTE-IDENTICAL to
# the rule's table — codepoints (not literal glyphs) so this source stays pure
# ASCII and the set is unambiguous. The drift-guard test
# (tests/unit/visual-style-vocab.test.js) asserts this set matches the rule doc
# and the workflow, so edits here must be mirrored there.
VOCAB = {
    # Core 12
    "✅",  # white check mark
    "❌",  # cross mark
    "⚠",  # warning sign
    "\U0001f504",  # counterclockwise arrows (refresh)
    "⏸",  # pause
    "\U0001f4a1",  # light bulb
    "\U0001f6a8",  # police-car light (siren)
    "\U0001f3af",  # direct hit (target)
    "\U0001f525",  # fire
    "\U0001f4dc",  # scroll
    "\U0001f916",  # robot face
    "⚡",  # high voltage (lightning)
    # Risk pair (green / yellow / red circles)
    "\U0001f7e2",
    "\U0001f7e1",
    "\U0001f534",
    # Ranking pair (gold / silver / bronze medals)
    "\U0001f947",
    "\U0001f948",
    "\U0001f949",
    # VS16 variation selector (renders the warning sign as an emoji)
    "️",
    # ZWJ for combined emoji sequences
    "‍",
}


def is_emoji(ch: str) -> bool:
    """Match the workflow's classifier exactly: Symbol-other, or >= U+1F000."""
    return unicodedata.category(ch) == "So" or ord(ch) >= 0x1F000


def find_violations(text: str, mode: str) -> list[str]:
    """Return the sorted unique offending glyphs (empty list == clean)."""
    found: set[str] = set()
    for ch in text:
        if mode == "body" and ch in VOCAB:
            continue
        if is_emoji(ch):
            found.add(ch)
    return sorted(found)


def read_input(args: argparse.Namespace) -> str:
    if args.file is not None:
        with open(args.file, encoding="utf-8") as fh:
            return fh.read()
    if args.env is not None:
        return os.environ.get(args.env, "") or ""
    return sys.stdin.read()


def emit(github: bool, level: str, msg: str) -> None:
    if github and level == "error":
        print(f"::error::{msg}")
    else:
        prefix = {"error": "VIOLATION", "notice": "OK"}.get(level, level.upper())
        print(f"[{prefix}] {msg}", file=sys.stderr if level == "error" else sys.stdout)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", required=True, choices=("title", "body"))
    parser.add_argument("file", nargs="?", help="file to read (default: stdin)")
    parser.add_argument("--env", help="read content from this env var instead")
    parser.add_argument(
        "--github",
        action="store_true",
        default=os.environ.get("GITHUB_ACTIONS") == "true",
        help="emit ::error:: workflow commands (auto-on under GitHub Actions)",
    )
    args = parser.parse_args()

    try:
        text = read_input(args)
    except OSError as exc:
        print(f"[ERROR] cannot read input: {exc}", file=sys.stderr)
        return 2

    violations = find_violations(text, args.mode)
    if not violations:
        emit(args.github, "notice", f"PR {args.mode} clean")
        return 0

    glyphs = "|".join(violations)
    if args.mode == "title":
        emit(args.github, "error", "PR title contains emoji (forbidden by visual-style.md)")
        emit(args.github, "error", f"Violating glyphs: {glyphs}")
        emit(args.github, "error", "Strip the emoji — PR titles are plain ASCII.")
    else:
        emit(args.github, "error", "PR body contains emoji outside the 12-glyph vocabulary")
        emit(args.github, "error", f"Violating glyphs: {glyphs}")
        emit(args.github, "error", "Allowed: white-check, red-X, warning, refresh, pause,")
        emit(args.github, "error", "  light-bulb, siren, target, fire, scroll, robot, lightning,")
        emit(args.github, "error", "  green/yellow/red circles, gold/silver/bronze medals.")
        emit(
            args.github,
            "error",
            "Common trap: U+2713/U+2717 check marks -> use the white-check / red-X.",
        )
        emit(
            args.github,
            "error",
            "See src/rules/visual-style.md; for exceptions apply 'visual-style-override'.",
        )
    return 1


if __name__ == "__main__":
    sys.exit(main())
