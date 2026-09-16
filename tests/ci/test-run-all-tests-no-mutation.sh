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
#   4. (#4180) non-compliant fixtures whose names used to break the
#      enumeration (an ASCII name, a Hebrew name, and a name with a space,
#      all tracked at 100644) are all reported (3 of 3). With
#      core.quotePath at its default, ls-files C-quoted the Hebrew path, the
#      [ -f ] guard failed on the quoted spelling, and the file was skipped
#      silently: the gate failed open on exactly that input.
#   5. (#4180) a TAB and a NEWLINE inside a .sh path (both tracked at
#      100644) are reported too (2 of 2): control characters are always
#      C-quoted in non-z ls-files output, whatever core.quotePath says, so
#      only the -z enumeration can see their real bytes.
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

# --- 4: non-ASCII and space-named fixtures are enumerated, not skipped -------
# (#4180) The preflight enumerates NUL-delimited with core.quotePath=false, so
# a non-ASCII path arrives as its real bytes and the [ -f ] guard sees the
# real file. This section proves the gate names all three non-compliant
# fixtures (ascii, Hebrew, name-with-space, each tracked at 100644): with the
# old quoting enumeration the Hebrew file was silently skipped and only 2 of
# 3 were reported.
echo "--- 4: Hebrew and space-named 100644 fixtures: all 3 reported ---"
# Undo section 3's index-mode mutation so the fixture's only offenders are
# the three new files and the reported count is exactly 3.
git_env git -C "$FIXTURE" update-index --chmod=+x tests/run-all-tests.sh
chmod +x "$FIXTURE/tests/run-all-tests.sh"
printf '#!/bin/bash\necho ascii-extra\n' > "$FIXTURE/ascii-extra.sh"
printf '#!/bin/bash\necho hebrew\n' > "$FIXTURE/בדיקה.sh"
printf '#!/bin/bash\necho spaced\n' > "$FIXTURE/name with space.sh"
git_env git -C "$FIXTURE" add ascii-extra.sh "בדיקה.sh" "name with space.sh"
git_env git -C "$FIXTURE" -c user.name=fixture -c user.email=fixture@example.test \
    commit -qm "fixture: three 100644 fixtures, two with non-trivial names"
RC4=0
OUT4="$(run_precommit_path 2>&1)" || RC4=$?
LINES4="$(porcelain_count)"
if [ "$RC4" -ne 0 ] \
   && [[ "$OUT4" == *"Non-executable tracked .sh files: 3"* ]] \
   && [[ "$OUT4" == *"ascii-extra.sh"* ]] \
   && [[ "$OUT4" == *"בדיקה.sh"* ]] \
   && [[ "$OUT4" == *"name with space.sh"* ]] \
   && [ "$LINES4" -eq 0 ]; then
    echo "  PASS: exit non-zero, count line says 3, all three names printed"
else
    echo "  FAIL: exit=$RC4, porcelain lines=$LINES4"
    printf '%s\n' "$OUT4" | grep -a "Non-executable\|\.sh" | tail -8 | sed 's/^/    /'
    FAILED=1
fi

# --- 5: TAB and NEWLINE path names are enumerated, not skipped ---------------
# (#4180) Control characters are C-quoted in non-z ls-files output even with
# core.quotePath=false (quotePath covers only bytes above 0x7f), so a TAB or a
# NEWLINE inside a .sh path is exactly the input the -z enumeration exists to
# protect. Both fixtures are tracked at 100644 and must be reported (2 of 2);
# the old line-based enumeration skipped both.
echo "--- 5: TAB and NEWLINE 100644 fixtures: both reported ---"
# Make section 4's three files compliant again (disk bit plus index mode, one
# commit) so the fixture's only offenders are the two new files and the
# reported count is exactly 2.
for f in ascii-extra.sh "בדיקה.sh" "name with space.sh"; do
    chmod +x "$FIXTURE/$f"
    git_env git -C "$FIXTURE" update-index --chmod=+x "$f"
done
TAB_PATH="$FIXTURE/tab"$'\t'name.sh
NL_PATH="$FIXTURE/nl"$'\n'name.sh
printf '#!/bin/bash\necho tabby\n' > "$TAB_PATH"
printf '#!/bin/bash\necho nl-file\n' > "$NL_PATH"
git_env git -C "$FIXTURE" add "tab"$'\t'name.sh "nl"$'\n'name.sh
git_env git -C "$FIXTURE" -c user.name=fixture -c user.email=fixture@example.test \
    commit -qm "fixture: section 4 files compliant, TAB and NEWLINE fixtures at 100644"
RC5=0
OUT5="$(run_precommit_path 2>&1)" || RC5=$?
LINES5="$(porcelain_count)"
if [ "$RC5" -ne 0 ] \
   && [[ "$OUT5" == *"Non-executable tracked .sh files: 2"* ]] \
   && [[ "$OUT5" == *$'tab\tname.sh'* ]] \
   && [[ "$OUT5" == *$'nl\nname.sh'* ]] \
   && [ "$LINES5" -eq 0 ]; then
    echo "  PASS: exit non-zero, count line says 2, TAB and NEWLINE paths printed raw"
else
    echo "  FAIL: exit=$RC5, porcelain lines=$LINES5"
    printf '%s\n' "$OUT5" | grep -a "Non-executable\|\.sh" | tail -8 | sed 's/^/    /'
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
