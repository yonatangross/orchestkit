#!/usr/bin/env bash
# Test: the pre-commit path of tests/run-all-tests.sh must leave the working
# tree exactly as it found it, and must fail with a named fix when a tracked
# .sh is not executable, instead of repairing the file in place.
#
# Why this exists (#4084):
#
# run-all-tests.sh opened with two `find ... -exec chmod +x {} \;` passes (over
# tests/ and src/hooks). chmod +x on a tracked .sh whose git mode was 100644
# flipped the on-disk mode and left the tree dirty after every pre-commit: the
# validator mutated the very worktree it was validating. It dirtied
# tests/test-ascii-density-ratchet.sh under lane fix-4070, so an unrelated
# commit carried a mode change its author never asked for.
#
# The runner now opens with a read-only exec-bit preflight: it fails the run
# and names the file plus the fix (chmod +x <file> && git add <file>), and it
# never chmods. This test exercises that contract in a throwaway git repo
# whose only tracked .sh is a copy of the runner itself:
#
#   1. a clean fixture runs green and `git status --porcelain` stays empty;
#   2. a stripped on-disk exec bit fails the run, names the file and the fix,
#      and the file is still not executable afterwards (no silent repair);
#   3. an index mode of 100644 with the disk bit set fails the same way, and
#      the index is still 100644 afterwards.
#
# The fixture has no tests/ci and no scripts/ci, so every --lint category
# SKIPs, each invocation costs milliseconds, and the exit code carries only
# the preflight verdict (the preflight runs before any category gate).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER="$REPO_ROOT/tests/run-all-tests.sh"

FAILED=0
echo "=== run-all-tests.sh No-Mutation Test ==="
echo ""

if [ ! -f "$RUNNER" ]; then
    echo "FAIL: missing $RUNNER"
    exit 1
fi

# A test about scratch files must not itself die on a denied mktemp. An
# explicit TEMPLATE is what makes TMPDIR effective, because macOS mktemp with
# no template ignores TMPDIR entirely. Falls back beside this script so the
# suite still runs in a sandboxed shell.
scratch_dir() {
    local d
    for base in "${TMPDIR:-/tmp}" /tmp "$SCRIPT_DIR/.tmp"; do
        [ -n "$base" ] || continue
        # silent: best-effort (an unwritable base falls through to the next candidate; the last one reports)
        mkdir -p "$base" 2>/dev/null || continue
        # silent: best-effort (a denied mktemp falls through to the next base dir; same contract as the runner's own scratch_file)
        if d=$(mktemp -d "${base%/}/ork-runner-test.XXXXXX" 2>/dev/null) && [ -w "$d" ]; then
            printf '%s' "$d"; return 0
        fi
    done
    echo "FAIL: no writable scratch dir (TMPDIR, /tmp, $SCRIPT_DIR/.tmp)" >&2
    return 1
}

FIXTURE="$(scratch_dir)"
trap 'rm -rf "$FIXTURE"' EXIT

# A pre-commit hook inherits GIT_INDEX_FILE (absolute in a linked worktree) and
# GIT_DIR / GIT_WORK_TREE / friends (#3822). Without the scrub, git calls aimed
# at the fixture write through to the REAL index: measured 2026-09-06, one
# commit attempt staged 6946 deletions. Same scrub the pre-commit hook applies
# to the lint suite itself.
git_env() {
    env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE -u GIT_PREFIX \
        -u GIT_COMMON_DIR -u GIT_OBJECT_DIRECTORY "$@"
}

# Throwaway repo whose only tracked .sh is a copy of the runner. No tests/ci,
# no scripts/ci: every --lint category SKIPs, so the run's exit code reflects
# the preflight alone. chmod 755 before the first add makes the fixture's
# tracked mode deterministic regardless of the caller's umask.
mkdir -p "$FIXTURE/tests"
cp "$RUNNER" "$FIXTURE/tests/run-all-tests.sh"
chmod 755 "$FIXTURE/tests/run-all-tests.sh"
git_env git -C "$FIXTURE" init -q
git_env git -C "$FIXTURE" add tests/run-all-tests.sh
git_env git -C "$FIXTURE" -c user.name=fixture -c user.email=fixture@example.test \
    commit -qm "fixture: copy of tests/run-all-tests.sh"

# The invocation bin/git-hooks/pre-commit step 7 makes, from the fixture root
# so the runner's git calls resolve to the fixture repo, never to ours.
run_precommit_path() {
    (cd "$FIXTURE" && git_env bash tests/run-all-tests.sh --lint)
}

porcelain_count() {
    git_env git -C "$FIXTURE" status --porcelain | wc -l | tr -d ' '
}

# --- 1: a clean fixture runs green and mutates nothing -----------------------
echo "--- 1: clean fixture: green run, empty git status --porcelain ---"
RC1=0
OUT1="$(run_precommit_path 2>&1)" || RC1=$?
LINES1="$(porcelain_count)"
if [ "$RC1" -eq 0 ] && [ "$LINES1" -eq 0 ]; then
    echo "  PASS: exit 0, git status --porcelain empty"
else
    echo "  FAIL: exit=$RC1, porcelain lines=$LINES1"
    printf '%s\n' "$OUT1" | tail -5 | sed 's/^/    /'
    FAILED=1
fi

# --- 2: non-executable on disk fails the run and stays unfixed ---------------
echo "--- 2: disk exec bit stripped: run fails, names the fix, repairs nothing ---"
chmod -x "$FIXTURE/tests/run-all-tests.sh"
RC2=0
OUT2="$(run_precommit_path 2>&1)" || RC2=$?
LINES2="$(porcelain_count)"
NAMED_FIX="chmod +x tests/run-all-tests.sh && git add tests/run-all-tests.sh"
if [ "$RC2" -ne 0 ] \
   && [[ "$OUT2" == *"tests/run-all-tests.sh"* ]] \
   && [[ "$OUT2" == *"$NAMED_FIX"* ]] \
   && [ ! -x "$FIXTURE/tests/run-all-tests.sh" ] \
   && [ "$LINES2" -eq 1 ]; then
    echo "  PASS: exit non-zero, file and fix named, file still non-executable, 1 dirty line"
else
    echo "  FAIL: exit=$RC2, still-exec=$([ -x "$FIXTURE/tests/run-all-tests.sh" ] && echo yes || echo no), porcelain lines=$LINES2"
    printf '%s\n' "$OUT2" | tail -8 | sed 's/^/    /'
    FAILED=1
fi

# --- 3: index mode 100644 fails the run and stays unfixed --------------------
echo "--- 3: index mode 100644: run fails, names the fix, repairs nothing ---"
chmod +x "$FIXTURE/tests/run-all-tests.sh"
git_env git -C "$FIXTURE" update-index --chmod=-x tests/run-all-tests.sh
RC3=0
OUT3="$(run_precommit_path 2>&1)" || RC3=$?
LINES3="$(porcelain_count)"
INDEX_MODE="$(git_env git -C "$FIXTURE" ls-files -s tests/run-all-tests.sh | awk '{print $1}')"
if [ "$RC3" -ne 0 ] \
   && [[ "$OUT3" == *"$NAMED_FIX"* ]] \
   && [ "$INDEX_MODE" = "100644" ] \
   && [ -x "$FIXTURE/tests/run-all-tests.sh" ] \
   && [ "$LINES3" -eq 1 ]; then
    echo "  PASS: exit non-zero, fix named, index still 100644, disk bit untouched"
else
    echo "  FAIL: exit=$RC3, index mode=$INDEX_MODE, porcelain lines=$LINES3"
    printf '%s\n' "$OUT3" | tail -8 | sed 's/^/    /'
    FAILED=1
fi

echo ""
echo "=== Summary ==="

if [ "$FAILED" -ne 0 ]; then
    echo "RESULT: FAIL"
    exit 1
fi

echo "RESULT: PASS"
exit 0
