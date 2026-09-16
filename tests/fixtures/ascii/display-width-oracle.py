#!/usr/bin/env python3
"""Display-width oracle for the GH-4159 72-column cap test.

Usage: python3 display-width-oracle.py CAP FILE

Counts terminal cells per line: east_asian_width W/F plus the ambiguous
U+23F8 (pause glyph from the skill's closed vocabulary) take 2 cells, all
other characters take 1. Prints one summary line, then one line per
violation, and exits 1 if any line exceeds CAP.
"""
import sys
import unicodedata

EXTRA_WIDE = {0x23F8}  # codepoints outside EAW W/F that still take 2 cells


def width(s: str) -> int:
    n = 0
    for c in s:
        o = ord(c)
        if unicodedata.east_asian_width(c) in ("W", "F") or o in EXTRA_WIDE:
            n += 2
        else:
            n += 1
    return n


def main() -> int:
    cap = int(sys.argv[1])
    lines = open(sys.argv[2], encoding="utf-8").read().rstrip("\n").split("\n")
    worst = max(width(line) for line in lines)
    print(f"rendered lines: {len(lines)}, max display width: {worst} (cap {cap})")
    bad = [(width(line), line) for line in lines if width(line) > cap]
    for w, line in bad:
        print(f"✗ line is {w} columns, over the {cap}-column cap: {line}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
