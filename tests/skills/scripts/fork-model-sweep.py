#!/usr/bin/env python3
"""Fork-model currency sweep for skill docs (#3726).

Since CC 2.1.232 subagent forking is on by default and `subagent_type: "fork"`
is a first-class value. A skill doc that mentions CC 2.1.89 together with
forking must also carry the 2.1.232 note somewhere in the same file; one that
does not is presenting the pre-2.1.232 implicit 4-condition auto-detection as
the only route.

File-level granularity on purpose: historical mentions (origin notes,
graceful-degradation clauses) sit far from the update note, and a line-window
rule would false-positive on them. Roster is derived by grep, not hardcoded,
so the next stale instance is caught without a manual verifier sweep.

Usage: fork-model-sweep.py <skills-dir>
Exit 0 when every fork-context 2.1.89 doc carries the 2.1.232 note.
"""

import pathlib
import sys

WINDOW = 2  # lines on each side of a 2.1.89 mention to look for fork context


def main(skills_dir: pathlib.Path) -> int:
    stale = []
    checked = 0

    for path in sorted(skills_dir.rglob("*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        lowered = text.lower()
        if "2.1.89" not in lowered:
            continue
        # Fork context: "fork" within WINDOW lines of a 2.1.89 mention.
        # Mentions of 2.1.89 with no fork nearby are out of scope here.
        near_fork = False
        lines = lowered.splitlines()
        for idx, line in enumerate(lines):
            if "2.1.89" not in line:
                continue
            window = "\n".join(lines[max(0, idx - WINDOW): idx + WINDOW + 1])
            if "fork" in window:
                near_fork = True
                break
        if not near_fork:
            continue
        checked += 1
        if "2.1.232" not in lowered:
            stale.append(str(path))

    if checked == 0:
        print("FAIL: no skill doc mentions 2.1.89 in a fork context; the roster grep is broken, not the skills")
        return 1

    if stale:
        print("FAIL: docs still present CC 2.1.232 forking as implicit-only (#3726);")
        print("each file below mentions 2.1.89 fork eligibility without the 2.1.232 note:")
        for p in stale:
            print(f"  - {p}")
        return 1

    print(f"PASS: {checked} skill doc(s) pairing 2.1.89 fork text with the 2.1.232 explicit-fork note")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: fork-model-sweep.py <skills-dir>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(pathlib.Path(sys.argv[1])))