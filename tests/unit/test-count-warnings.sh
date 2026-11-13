#!/usr/bin/env bash
# Controls for the warning counter in tests/run-all-tests.sh (orchestkit row 11, 2026-11-13).
#
# count_warnings used to miss two colour-coded "Warnings:" lines, so the ratchet
# baseline (267) undercounted the true total (271) and an undercount could pass for a
# clean run. This test feeds the runner's real counter code the exact line shapes the
# tests print, and keeps a copy of the pre-fix counter to show it returns 0 on the
# coloured shapes (so the assertions are not vacuous).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER="$REPO_ROOT/tests/run-all-tests.sh"

PASS=0
FAIL=0
ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/ork.countwarn.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# The counters stay inline in the runner (tests/ci/test-run-all-tests-no-mutation.sh runs a
# lone copy of it), so extract exactly that code between its markers and source it.
sed -n '/^# BEGIN warnings-count$/,/^# END warnings-count$/p' "$RUNNER" > "$TMP/counters.sh"
if [[ "$(grep --count --regexp='^count_warnings()' --regexp='^count_tests_run()' "$TMP/counters.sh")" -ne 2 ]]; then
    echo "FAIL: could not extract count_warnings and count_tests_run from $RUNNER"
    exit 1
fi
# shellcheck source=/dev/null
source "$TMP/counters.sh"

# The pre-fix counter, verbatim from run-all-tests.sh before row 11.
old_count_warnings() {
    awk 'match($0, /Warnings:[[:space:]]+[0-9]+/) {
           n = substr($0, RSTART, RLENGTH); sub(/^Warnings:[[:space:]]+/, "", n); s += n
         } END {print s + 0}' "$1"
}

ESC=$'\033'
write() { printf '%b' "$2" > "$TMP/$1"; }

# The line shapes the tests really print (see tests/skills/test-frontend-skills.sh,
# tests/plugins/structure/test-plugin-structure-compliance.sh and the plain ones).
write plain       "  Warnings:        93\nWarnings: 45\nWarnings: 15 skills (missing 'Use when' triggers)\n"
write value-color "Warnings: ${ESC}[1;33m8${ESC}[0m\n"
write label-color "${ESC}[1;33mWarnings:${ESC}[0m 1\n"
write all-shapes  "  Warnings:        93\nWarnings: ${ESC}[1;33m8${ESC}[0m\n${ESC}[1;33mWarnings:${ESC}[0m 1\n"
write none        "PASS everything\nno counts here\n"
write empty       ""

check() {
    local label="$1" got="$2" want="$3"
    if [[ "$got" == "$want" ]]; then ok "$label (got $got)"; else bad "$label (got $got, want $want)"; fi
}

echo "count_warnings"
check "plain lines sum"                         "$(count_warnings "$TMP/plain")"       "153"
check "colour code around the number"           "$(count_warnings "$TMP/value-color")" "8"
check "colour code around the label"            "$(count_warnings "$TMP/label-color")" "1"
check "all three shapes in one transcript"      "$(count_warnings "$TMP/all-shapes")"  "102"
check "no warnings line reads as a clean 0"     "$(count_warnings "$TMP/none")"        "0"
check "empty transcript reads as 0"             "$(count_warnings "$TMP/empty")"       "0"

echo "control: the pre-fix counter really missed the coloured shapes"
check "old counter on colour around the number" "$(old_count_warnings "$TMP/value-color")" "0"
check "old counter on colour around the label"  "$(old_count_warnings "$TMP/label-color")" "0"
check "old counter on all shapes (misses 9)"    "$(old_count_warnings "$TMP/all-shapes")"  "93"

echo "count_tests_run"
write runs "${ESC}[0;34m[RUN]${ESC}[0m /x/tests/a/test-one.sh\n${ESC}[0;32m[PASS]${ESC}[0m /x/tests/a/test-one.sh (1s)\n${ESC}[0;34m[RUN]${ESC}[0m /x/tests/a/test-two.sh\n[RUN] /x/tests/b/test-three.mjs\n"
check "one [RUN] line per test, colour or not"  "$(count_tests_run "$TMP/runs")"  "3"
check "a transcript with no tests reads as 0"   "$(count_tests_run "$TMP/none")"  "0"

echo "runner wiring"
if grep --quiet --fixed-strings 'Skills run floor' "$RUNNER"; then
    ok "run-all-tests.sh carries the skills undercount floor"
else
    bad "run-all-tests.sh has no skills undercount floor"
fi
if grep --quiet --fixed-strings 'ORK_SKILLS_MIN_TESTS' "$RUNNER"; then
    ok "the floor reads its minimum from ORK_SKILLS_MIN_TESTS"
else
    bad "the floor has no ORK_SKILLS_MIN_TESTS override"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
