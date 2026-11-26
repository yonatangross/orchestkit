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
  # $1: files list path, $2: HEAD_REF, $3: PR_AUTHOR, $4: PR_NUMBER
  RP_FILES_FILE="$1" \
    HEAD_REF="$2" PR_AUTHOR="$3" PR_NUMBER="$4" \
    bash "$DECISION" > "$OUT" 2>&1
}

# The real changed-files list of release PR #5463, fetched from the API.
REAL_5463="$SCRIPT_DIR/fixtures/rp-diff-gate-files-5463.txt"

section "1. The repository release bot with the real #5463 diff skips"
decide "$REAL_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463"
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

section "6. A non-PR event does not skip"
decide "$REAL_5463" "main" "orchestkit-release-bot[bot]" ""
if grep -qx 'skip=false' "$OUT"; then
  log_pass "no PR number does not skip"
else
  log_fail "missing PR number skipped"
fi

echo
if [[ $FAIL -gt 0 ]]; then
  echo "${RED}FAILED${NC}: $FAIL failed, $PASS passed"
  exit 1
fi
echo "${GREEN}PASSED${NC}: $PASS checks"
