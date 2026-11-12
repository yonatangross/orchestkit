#!/usr/bin/env bash
# Test: every tracked .sh is git mode 100755 AND has the exec bit on disk.
#
# Why: tests/run-all-tests.sh opens with an exec-bit preflight (#4084) that
# aborts the whole run when any tracked .sh is not 100755. The pre-commit hook
# runs `run-all-tests.sh --lint` with its output hidden, so one 100644 test file
# (tests/skills/test-workflow-calls-by-name.sh, added in #5197) failed every
# local commit as "quick lint tests FAILED" while CI stayed green: CI globs
# directories through scripts/ci/run-tests.sh and never runs that preflight.
# This test puts the same rule on the CI path so a 100644 .sh goes red in CI.
#
# Fail closed: outside a git work tree, or when the listing comes back empty
# (git failed, wrong cwd, wrong pathspec), the test FAILS rather than passing.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Tracked .sh Executable Test ==="
echo ""

# cd, then plain `git <subcommand>`: the lane guard cannot read a subcommand
# that follows an expanded `-C` argument and refuses the whole script.
cd "$REPO_ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "FAIL: $REPO_ROOT is not a git work tree; the check cannot run"
    exit 2
fi

CHECKED=0
BAD=()
while IFS= read -r -d '' entry; do
    meta="${entry%%$'\t'*}"      # "<mode> <sha> <stage>"
    path="${entry#*$'\t'}"       # raw path bytes, never C-quoted
    [ -n "$path" ] || continue
    [[ "${meta##* }" == "0" ]] || continue   # a merge lists 3 stages per path
    [ -f "$path" ] || continue     # deleted in the worktree
    CHECKED=$((CHECKED + 1))
    if [[ "${meta%% *}" != "100755" || ! -x "$path" ]]; then
        BAD+=("${meta%% *} $path")
    fi
done < <(git -c core.quotePath=false ls-files -s -z -- '*.sh')

# A failed or empty git listing lands here as CHECKED=0: fail, never pass.
if [[ $CHECKED -eq 0 ]]; then
    echo "FAIL: no tracked .sh files listed; the check cannot have run"
    exit 2
fi

if [[ ${#BAD[@]} -gt 0 ]]; then
    echo "FAIL: ${#BAD[@]} tracked .sh file(s) not 100755 with the exec bit:"
    for b in "${BAD[@]}"; do
        echo "  $b"
        echo "    fix: git update-index --chmod=+x ${b#* } && chmod +x ${b#* }"
    done
    exit 1
fi

echo "PASS: all $CHECKED tracked .sh files are 100755 and executable"
