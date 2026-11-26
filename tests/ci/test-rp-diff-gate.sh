#!/bin/bash
# The release-please diff gate (rp-diff-gate.yml) decides with the PR's
# event data: head branch, author login and the changed-files list. The
# repository release bot is orchestkit-release-bot[bot], not
# release-please[bot]; Codex found the wrong login skipped nothing, and a
# bare plugins/* glob would have counted ordinary plugin source as release
# output (review of #5470).
#
# Decision logic lives in scripts/ci/rp-diff-gate-decision.sh so this test
# feeds it recorded event data without a stub gh.
#
# Outputs go to files and are grepped there: no here-strings, no pipes
# into grep -q (#603, ork#3348).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DECISION="$PROJECT_ROOT/scripts/ci/rp-diff-gate-decision.sh"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
PASS=0; FAIL=0
log_pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
log_fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
section() { echo; echo "${YELLOW}$1${NC}"; }

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ork-rp-gate.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT
OUT="$WORK_DIR/out.txt"

decide() {
  # $1: files list path, $2: HEAD_REF, $3: PR_AUTHOR, $4: PR_NUMBER,
  # $5: optional RP_ALLOWLIST_FILE override, $6: optional RP_COMMITS_FILE
  RP_FILES_FILE="$1" \
    HEAD_REF="$2" PR_AUTHOR="$3" PR_NUMBER="$4" RP_ALLOWLIST_FILE="${5:-}" \
    RP_COMMITS_FILE="${6:-}" \
    bash "$DECISION" > "$OUT" 2>&1
}

# The real changed-files list and commit authors of release PR #5463,
# fetched from the API (3 commits, all the release bot).
REAL_5463="$SCRIPT_DIR/fixtures/rp-diff-gate-files-5463.txt"
COMMITS_5463="$SCRIPT_DIR/fixtures/rp-diff-gate-commits-5463.txt"

section "1. The repository release bot with the real #5463 diff skips"
decide "$REAL_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "$COMMITS_5463"
if grep -qx 'skip=true' "$OUT"; then
  log_pass "release-please-only diff skips the heavy suites"
else
  log_fail "real #5463 event data did not skip: $(cat "$OUT")"
fi

section "2. An ordinary plugin source file stops the skip"
MIXED="$WORK_DIR/files-mixed.txt"
cp "$REAL_5463" "$MIXED"
echo "plugins/ork/skills/npm-ci-symlink-guard/SKILL.md" >> "$MIXED"
decide "$MIXED" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463"
if grep -qx 'skip=false' "$OUT" && grep -qF 'non-release-owned file: plugins/ork/skills/npm-ci-symlink-guard/SKILL.md' "$OUT"; then
  log_pass "plugin source is not release-owned"
else
  log_fail "ordinary plugin source counted as release output: $(cat "$OUT")"
fi

section "3. The wrong bot login does not skip"
decide "$REAL_5463" "release-please--branches--main" "release-please[bot]" "5463"
if grep -qx 'skip=false' "$OUT"; then
  log_pass "foreign bot login does not skip"
else
  log_fail "release-please[bot] skipped; only orchestkit-release-bot[bot] may"
fi

section "4. The right bot on a non-release branch does not skip"
decide "$REAL_5463" "feat/whatever" "orchestkit-release-bot[bot]" "5463"
if grep -qx 'skip=false' "$OUT"; then
  log_pass "non-release branch does not skip"
else
  log_fail "a feat/ branch skipped the heavy suites"
fi

section "5. An empty file list fails closed"
EMPTY_LIST="$WORK_DIR/empty.txt"
: > "$EMPTY_LIST"
decide "$EMPTY_LIST" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463"
if grep -qx 'skip=false' "$OUT"; then
  log_pass "empty files list does not skip"
else
  log_fail "empty files list skipped"
fi

section "6. An allowlist error does not skip"
decide "$REAL_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "$WORK_DIR/missing-allowlist.txt"
if grep -qx 'skip=false' "$OUT" && grep -qF 'allowlist read or regex error' "$OUT"; then
  log_pass "an unreadable allowlist keeps the suites running"
else
  log_fail "an allowlist error silently skipped: $(cat "$OUT")"
fi

section "7. A non-PR event does not skip"
decide "$REAL_5463" "main" "orchestkit-release-bot[bot]" ""
if grep -qx 'skip=false' "$OUT"; then
  log_pass "no PR number does not skip"
else
  log_fail "missing PR number skipped"
fi

section "8. A non-release branch touching only dist and the lockfile does not skip"
DIST_ONLY="$WORK_DIR/files-dist-only.txt"
printf 'src/hooks/dist/pretool.mjs\nplugins/ork/hooks/dist/pretool.mjs\npackage-lock.json\npyproject.toml\n' > "$DIST_ONLY"
decide "$DIST_ONLY" "fix/hand-pushed" "orchestkit-release-bot[bot]" "9999" "" "$COMMITS_5463"
if grep -qx 'skip=false' "$OUT"; then
  log_pass "dist/lockfile-only diff on a non-release branch runs the suites"
else
  log_fail "a pushed release-please lookalike skipped: $(cat "$OUT")"
fi

section "9. A commit not authored by the release bot does not skip"
MIXED_COMMITS="$WORK_DIR/commits-mixed.txt"
printf 'orchestkit-release-bot[bot]\nsome-human\n' > "$MIXED_COMMITS"
decide "$REAL_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "$MIXED_COMMITS"
if grep -qx 'skip=false' "$OUT" && grep -qF 'non-release-bot commit author: some-human' "$OUT"; then
  log_pass "a hand-pushed commit on the release branch is caught"
else
  log_fail "commit-author check did not fire: $(cat "$OUT")"
fi

section "10. An empty commits list fails closed"
EMPTY_COMMITS="$WORK_DIR/commits-empty.txt"
: > "$EMPTY_COMMITS"
decide "$REAL_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "$EMPTY_COMMITS"
if grep -qx 'skip=false' "$OUT" && grep -qF 'empty commits list' "$OUT"; then
  log_pass "empty commits list does not skip"
else
  log_fail "empty commits list skipped: $(cat "$OUT")"
fi

echo
if [[ $FAIL -gt 0 ]]; then
  echo "${RED}FAILED${NC}: $FAIL failed, $PASS passed"
  exit 1
fi
echo "${GREEN}PASSED${NC}: $PASS checks"
