#!/bin/bash
# The release-please diff gate (rp-diff-gate.yml) decides with the PR's
# event data: head branch, author login, the pulls/N counts, the
# changed-files list and the commits list. The repository release bot is
# orchestkit-release-bot[bot], not release-please[bot]; Codex found the
# wrong login skipped nothing, and a bare plugins/* glob would have
# counted ordinary plugin source as release output (review of #5470).
# Codex's #5479 review added the completeness arms: a truncated file or
# commit list, a rename whose source escapes the allowlist, and a branch
# that moved mid-read must all keep the suites running.
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

# The real event data of release PR #5463, fetched from the API: 39
# changed files, 3 commits all authored by the release bot, head sha aaa*.
FILES_5463="$SCRIPT_DIR/fixtures/rp-diff-gate-files-5463.json"
COMMITS_5463="$SCRIPT_DIR/fixtures/rp-diff-gate-commits-5463.json"
PR_5463="$SCRIPT_DIR/fixtures/rp-diff-gate-pr-5463.json"
HEAD_5463="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

mk_pr() {
  # Write a pulls/N-shaped object: $1 changed_files, $2 commits, $3 head sha.
  jq -n --argjson files "$1" --argjson commits "$2" --arg sha "$3" \
    '{changed_files: $files, commits: $commits, head: {sha: $sha}}' \
    > "$WORK_DIR/pr.json"
  printf '%s' "$WORK_DIR/pr.json"
}

decide() {
  # $1: files array path, $2: HEAD_REF, $3: PR_AUTHOR, $4: PR_NUMBER,
  # $5: optional RP_ALLOWLIST_FILE, $6: optional RP_COMMITS_JSON_FILE,
  # $7: optional RP_PR_JSON_FILE (defaults to the real #5463 object),
  # $8: optional HEAD_SHA (defaults to the real #5463 head)
  RP_FILES_JSON_FILE="$1" \
    HEAD_REF="$2" PR_AUTHOR="$3" PR_NUMBER="$4" RP_ALLOWLIST_FILE="${5:-}" \
    RP_COMMITS_JSON_FILE="${6:-$COMMITS_5463}" RP_PR_JSON_FILE="${7:-$PR_5463}" \
    HEAD_SHA="${8-$HEAD_5463}" \
    bash "$DECISION" > "$OUT" 2>&1
}

section "1. The repository release bot with the real #5463 diff skips"
decide "$FILES_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463"
if grep -qx 'skip=true' "$OUT"; then
  log_pass "release-please-only diff skips the heavy suites"
else
  log_fail "real #5463 event data did not skip: $(cat "$OUT")"
fi

section "2. An ordinary plugin source file stops the skip"
MIXED="$WORK_DIR/files-mixed.json"
jq '. + [{filename: "plugins/ork/skills/npm-ci-symlink-guard/SKILL.md"}]' "$FILES_5463" > "$MIXED"
decide "$MIXED" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "" "$(mk_pr 40 3 "$HEAD_5463")"
if grep -qx 'skip=false' "$OUT" && grep -qF 'non-release-owned file: plugins/ork/skills/npm-ci-symlink-guard/SKILL.md' "$OUT"; then
  log_pass "plugin source is not release-owned"
else
  log_fail "ordinary plugin source counted as release output: $(cat "$OUT")"
fi

section "3. The wrong bot login does not skip"
decide "$FILES_5463" "release-please--branches--main" "release-please[bot]" "5463"
if grep -qx 'skip=false' "$OUT"; then
  log_pass "foreign bot login does not skip"
else
  log_fail "release-please[bot] skipped; only orchestkit-release-bot[bot] may"
fi

section "4. The right bot on a non-release branch does not skip"
decide "$FILES_5463" "feat/whatever" "orchestkit-release-bot[bot]" "5463"
if grep -qx 'skip=false' "$OUT"; then
  log_pass "non-release branch does not skip"
else
  log_fail "a feat/ branch skipped the heavy suites"
fi

section "5. An empty file list fails closed"
printf '[]\n' > "$WORK_DIR/files-empty.json"
decide "$WORK_DIR/files-empty.json" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "" "$(mk_pr 0 3 "$HEAD_5463")"
if grep -qx 'skip=false' "$OUT" && grep -qF 'empty changed-file list' "$OUT"; then
  log_pass "empty files list does not skip"
else
  log_fail "empty files list skipped: $(cat "$OUT")"
fi

section "6. An allowlist error does not skip"
decide "$FILES_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "$WORK_DIR/missing-allowlist.txt"
if grep -qx 'skip=false' "$OUT" && grep -qF 'allowlist read or regex error' "$OUT"; then
  log_pass "an unreadable allowlist keeps the suites running"
else
  log_fail "an allowlist error silently skipped: $(cat "$OUT")"
fi

section "7. A non-PR event does not skip"
decide "$FILES_5463" "main" "orchestkit-release-bot[bot]" ""
if grep -qx 'skip=false' "$OUT"; then
  log_pass "no PR number does not skip"
else
  log_fail "missing PR number skipped"
fi

section "8. A non-release branch touching only dist and the lockfile does not skip"
DIST_ONLY="$WORK_DIR/files-dist-only.json"
jq -n '["src/hooks/dist/pretool.mjs", "plugins/ork/hooks/dist/pretool.mjs", "package-lock.json", "pyproject.toml"] | map({filename: .})' > "$DIST_ONLY"
decide "$DIST_ONLY" "fix/hand-pushed" "orchestkit-release-bot[bot]" "9999" "" "" "$(mk_pr 4 3 "$HEAD_5463")"
if grep -qx 'skip=false' "$OUT"; then
  log_pass "dist/lockfile-only diff on a non-release branch runs the suites"
else
  log_fail "a pushed release-please lookalike skipped: $(cat "$OUT")"
fi

section "9. A commit not authored by the release bot does not skip"
MIXED_COMMITS="$WORK_DIR/commits-mixed.json"
jq '.[2].author.login = "some-human"' "$COMMITS_5463" > "$MIXED_COMMITS"
decide "$FILES_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "$MIXED_COMMITS"
if grep -qx 'skip=false' "$OUT" && grep -qF 'non-release-bot commit author: some-human' "$OUT"; then
  log_pass "a hand-pushed commit on the release branch is caught"
else
  log_fail "commit-author check did not fire: $(cat "$OUT")"
fi

section "10. An incomplete commits list fails closed"
printf '[]\n' > "$WORK_DIR/commits-empty.json"
decide "$FILES_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "$WORK_DIR/commits-empty.json" "$(mk_pr 39 1 "$HEAD_5463")"
if grep -qx 'skip=false' "$OUT" && grep -qF 'commit list incomplete' "$OUT"; then
  log_pass "a short commits list does not skip"
else
  log_fail "incomplete commits list skipped: $(cat "$OUT")"
fi

section "11. An incomplete changed-file list fails closed"
decide "$FILES_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "" "$(mk_pr 40 3 "$HEAD_5463")"
if grep -qx 'skip=false' "$OUT" && grep -qF 'changed-file list incomplete (39 objects, PR reports 40)' "$OUT"; then
  log_pass "a truncated files list does not skip"
else
  log_fail "incomplete files list skipped: $(cat "$OUT")"
fi

section "12. A rename must clear its previous path through the allowlist"
RENAME_BAD="$WORK_DIR/files-rename-bad.json"
jq '.[0] += {previous_filename: "src/hooks/src/pretool.ts"}' "$FILES_5463" > "$RENAME_BAD"
decide "$RENAME_BAD" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463"
if grep -qx 'skip=false' "$OUT" && grep -qF 'non-release-owned file: src/hooks/src/pretool.ts' "$OUT"; then
  log_pass "a rename smuggling a source path is caught"
else
  log_fail "previous_filename escaped the allowlist: $(cat "$OUT")"
fi
RENAME_OK="$WORK_DIR/files-rename-ok.json"
jq '.[0] += {previous_filename: ".release-please-manifest.json"}' "$FILES_5463" > "$RENAME_OK"
decide "$RENAME_OK" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463"
if grep -qx 'skip=true' "$OUT"; then
  log_pass "a rename between release-owned paths still skips"
else
  log_fail "a clean rename did not skip: $(cat "$OUT")"
fi

section "13. The decision binds to the triggering head sha"
decide "$FILES_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "" "$(mk_pr 39 3 "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef")"
if grep -qx 'skip=false' "$OUT" && grep -qF 'pull head moved since the trigger sha' "$OUT"; then
  log_pass "a pull head newer than the trigger does not skip"
else
  log_fail "a moved pull head skipped: $(cat "$OUT")"
fi
decide "$FILES_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "" "$(mk_pr 39 3 "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef")" "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
if grep -qx 'skip=false' "$OUT" && grep -qF 'different head than the trigger sha' "$OUT"; then
  log_pass "a commits list ending at a stale head does not skip"
else
  log_fail "a stale commits tail skipped: $(cat "$OUT")"
fi
decide "$FILES_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "" "$PR_5463" ""
if grep -qx 'skip=false' "$OUT"; then
  log_pass "a missing trigger head sha does not skip"
else
  log_fail "empty HEAD_SHA skipped: $(cat "$OUT")"
fi

section "14. A commit with no linked GitHub author counts as not-bot"
UNLINKED="$WORK_DIR/commits-unlinked.json"
jq '.[2].author = null' "$COMMITS_5463" > "$UNLINKED"
decide "$FILES_5463" "release-please--branches--main" "orchestkit-release-bot[bot]" "5463" "" "$UNLINKED"
if grep -qx 'skip=false' "$OUT" && grep -qF 'commit without a linked GitHub author' "$OUT"; then
  log_pass "an unlinked-author commit does not skip"
else
  log_fail "an unlinked author was dropped from the check: $(cat "$OUT")"
fi

echo
if [[ $FAIL -gt 0 ]]; then
  echo "${RED}FAILED${NC}: $FAIL failed, $PASS passed"
  exit 1
fi
echo "${GREEN}PASSED${NC}: $PASS checks"
