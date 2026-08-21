#!/usr/bin/env bash
# Test: no bare `mktemp` survives on the CI-executed surface.
#
# Why (the #3564 class, fifth sighting):
#
# `mktemp` called with NO TEMPLATE writes to the system temp dir and — on macOS —
# IGNORES $TMPDIR entirely. When that write is denied the call dies, and under
# `set -e` it takes the whole script with it. Today that produced, in four
# separate files: a silently zeroed hook subcount reported as false drift, a test
# runner that killed every commit before running a test, and an eval suite
# reporting 5 failures that were not failures.
#
# The repair is the TEMPLATE, not the directory: `mktemp "${TMPDIR:-/tmp}/x.XXXXXX"`
# honours TMPDIR, a bare `mktemp` cannot. This is why `TMPDIR=/unwritable` looks
# like it disproves the bug — it changes nothing for a bare call.
#
# This gate exists because the previous two sweeps of this class each MISSED
# most of the surface and reported success:
#   - #3550 swept `.github/` only, so bin/ci-setup.sh kept hanging jobs
#   - a `git grep -E '\s'` scan silently matched nothing useful, because ERE has
#     no \s, so a 76-file surface was measured as 30
# A gate that scans the whole tree in one dialect is the only thing that can
# claim coverage.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Bare mktemp Test ==="
echo ""

FAILED=0
HITS=$(cd "$REPO_ROOT" && git ls-files tests bin scripts .github | python3 -c '
import sys, re, pathlib
# One dialect, one scan. $(mktemp) / `mktemp` / $(mktemp -d), comments excluded.
BARE = re.compile(r"(\$\(|\`)\s*mktemp(\s+-d)?\s*(\)|\`)")
for f in sys.stdin.read().split():
    p = pathlib.Path(f)
    if not p.is_file():
        continue
    try:
        text = p.read_text()
    except Exception:
        continue
    for i, line in enumerate(text.split("\n"), 1):
        if line.lstrip().startswith("#"):
            continue
        if BARE.search(line):
            print(f"{f}:{i}:{line.strip()[:80]}")
')

if [ -z "$HITS" ]; then
    echo "  PASS: no bare mktemp on the CI-executed surface"
else
    while IFS= read -r h; do
        [ -n "$h" ] || continue
        echo "  FAIL: $h"
        FAILED=1
    done <<< "$HITS"
fi

echo ""
if [ "$FAILED" -ne 0 ]; then
    echo "RESULT: FAIL"
    echo ""
    echo 'Give the call an explicit template so it honours TMPDIR:'
    echo '    tmp=$(mktemp "${TMPDIR:-/tmp}/ork.XXXXXX")'
    echo '    dir=$(mktemp -d "${TMPDIR:-/tmp}/ork.XXXXXX")'
    exit 1
fi

echo "RESULT: PASS"
exit 0
