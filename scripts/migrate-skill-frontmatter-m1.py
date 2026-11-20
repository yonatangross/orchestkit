#!/usr/bin/env python3
"""Move ork house keys in src/**/SKILL.md frontmatter to the spec shape (m1).

The Agent Skills spec allows name, description, license, compatibility,
metadata and allowed-tools at top level; configs/standards.json adds the keys
Claude Code reads. The ork house keys below are neither, so G1
(scripts/check-frontmatter.py) reports them as house-key:<key>. This script
fixes the source files once, reproducibly:

  version, author, complexity, tags   move under metadata as quoted strings
                                      (tags [a, b] becomes "a, b")
  persuasion-type                     deleted (nothing in the tree reads it)

Readers keep working because the two shared frontmatter parsers
(scripts/lib/parse-frontmatter.js and parse_frontmatter in
scripts/_build-docs-generate.py) lift these keys back out of metadata.

Keys this script leaves alone on purpose (see the m1 PR for why): agent
(a Claude Code skill key the registry does not list yet), allowed-tools list
form (Claude Code's string split is not proven by a test here), triggers,
skills, targets, path_patterns, invocation_hooks, tool-coverage and
upstream-version-tested (nested shapes or runtime readers).

Dry run by default: prints the plan and exits 1 if any file would change.
--apply writes. Idempotent: a second run finds nothing to do and exits 0.
Refuses (exit 2) on a shape it does not understand instead of guessing.
Standard library only.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOVE = ("version", "author", "complexity", "tags")
DELETE = ("persuasion-type",)
TOP = re.compile(r"^([A-Za-z0-9_][A-Za-z0-9_-]*):(?:[ \t]+(.*))?$")
CHILD = re.compile(r"^(\s+)([A-Za-z0-9_.-]+):(?:[ \t]+(.*))?$")


class Refuse(Exception):
    """A shape the script will not guess about."""


def skill_files(root: Path) -> list[Path]:
    out = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--", "src"],
        capture_output=True,
        check=True,
    ).stdout.decode("utf-8")
    return [root / p for p in out.split("\0") if p.endswith("/SKILL.md")]


def to_string(key: str, raw: str) -> str:
    raw = raw.strip()
    if key == "tags":
        if not (raw.startswith("[") and raw.endswith("]")):
            raise Refuse(f"tags is not an inline list: {raw!r}")
        items = [i.strip().strip("\"'") for i in raw[1:-1].split(",")]
        return ", ".join(i for i in items if i)
    if raw[:1] in "[{|>&*!":
        raise Refuse(f"{key} is not a scalar: {raw!r}")
    if raw[:1] == '"':
        return str(json.loads(raw))
    if raw[:1] == "'" and raw.endswith("'"):
        return raw[1:-1].replace("''", "'")
    return raw


def migrate(text: str) -> tuple[str, list[str]]:
    lines = text.split("\n")
    if not lines or lines[0].rstrip() != "---":
        return text, []
    end = next((i for i in range(1, len(lines)) if lines[i].rstrip() == "---"), None)
    if end is None:
        raise Refuse("unterminated frontmatter")
    fm = lines[1:end]

    moved: dict[str, str] = {}
    changes: list[str] = []
    kept: list[str] = []
    i = 0
    while i < len(fm):
        line = fm[i]
        m = TOP.match(line)
        key = m.group(1) if m else None
        if key in MOVE or key in DELETE:
            raw = m.group(2) or ""
            children = []
            while i + 1 < len(fm) and fm[i + 1][:1] in (" ", "\t"):
                children.append(fm[i + 1].strip())
                i += 1
            if children:
                # Only a bare `tags:` over `- item` lines is understood.
                if key != "tags" or raw.strip() or not all(c.startswith("- ") for c in children):
                    raise Refuse(f"{key} has indented children of an unknown shape")
                raw = "[" + ", ".join(c[2:].strip() for c in children) + "]"
            if key in moved:
                raise Refuse(f"duplicate {key}")
            if key in MOVE:
                moved[key] = to_string(key, raw)
                changes.append(f"move {key}")
            else:
                changes.append(f"delete {key}")
            i += 1
            continue
        kept.append(line)
        i += 1
    if not moved:
        return "\n".join([lines[0], *kept, *lines[end:]]), changes

    # Find the metadata block in what is left.
    meta_at = next(
        (j for j, ln in enumerate(kept) if TOP.match(ln) and TOP.match(ln).group(1) == "metadata"),
        None,
    )
    if meta_at is None:
        kept.append("metadata:")
        meta_at = len(kept) - 1
        indent = "  "
        block_end = len(kept)
        existing: dict[str, str] = {}
    else:
        if (TOP.match(kept[meta_at]).group(2) or "").strip():
            raise Refuse("metadata is not a block mapping")
        block_end = meta_at + 1
        while block_end < len(kept) and (
            not kept[block_end].strip() or kept[block_end][:1] in (" ", "\t")
        ):
            block_end += 1
        while block_end > meta_at + 1 and not kept[block_end - 1].strip():
            block_end -= 1
        indent = None
        existing = {}
        for ln in kept[meta_at + 1 : block_end]:
            c = CHILD.match(ln)
            if c and (indent is None or c.group(1) == indent):
                indent = indent or c.group(1)
                existing[c.group(2)] = (c.group(3) or "").strip()
        indent = indent or "  "

    new_children = []
    for key in MOVE:
        if key not in moved:
            continue
        if key in existing:
            # An existing child is already a scalar string, never an inline list.
            if to_string("value", existing[key]) != moved[key]:
                raise Refuse(f"metadata.{key} already set to a different value")
            continue
        new_children.append(f"{indent}{key}: {json.dumps(moved[key], ensure_ascii=False)}")
    kept[block_end:block_end] = new_children
    return "\n".join([lines[0], *kept, *lines[end:]]), changes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0] if __doc__ else "")
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args(argv)
    root = Path(args.root)
    pending = 0
    tally: dict[str, int] = {}
    for path in skill_files(root):
        rel = path.relative_to(root)
        text = path.read_text(encoding="utf-8")
        try:
            new, changes = migrate(text)
        except Refuse as exc:
            print(f"REFUSED {rel}: {exc}")
            return 2
        if new == text:
            continue
        pending += 1
        for c in changes:
            tally[c] = tally.get(c, 0) + 1
        if args.apply:
            path.write_text(new, encoding="utf-8")
        print(f"{'wrote' if args.apply else 'would change'} {rel}: {', '.join(changes)}")
    summary = ", ".join(f"{k} x{v}" for k, v in sorted(tally.items())) or "nothing to do"
    print(f"{'applied' if args.apply else 'dry run'}: {pending} file(s); {summary}")
    return 0 if (args.apply or pending == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
