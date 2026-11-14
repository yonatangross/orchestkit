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

# Row 12: the ratchet verdict is inline in the runner too, between its own markers.
sed -n '/^# BEGIN warnings-ratchet$/,/^# END warnings-ratchet$/p' "$RUNNER" > "$TMP/ratchet.sh"
if [[ "$(grep --count --regexp='^ratchet_check()' "$TMP/ratchet.sh")" -ne 1 ]]; then
    echo "FAIL: could not extract ratchet_check from $RUNNER"
    exit 1
fi
# shellcheck source=/dev/null
source "$TMP/ratchet.sh"

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

# The labels below must not contain the literal "Warnings" plus a colon: this test's own
# output is read by the runner's counter when the runner runs it, and would count itself.
echo "count_unreadable_warnings (a warnings line with no number must be seen, not skipped)"
write unreadable "Warnings: 5\n${ESC}[1;33mWarnings:${ESC}[0m lots\nWarnings: n/a\n"
check "two lines name the label without a number"  "$(count_unreadable_warnings "$TMP/unreadable")" "2"
check "every numeric shape is readable"            "$(count_unreadable_warnings "$TMP/all-shapes")" "0"
check "no warnings line, nothing unreadable"       "$(count_unreadable_warnings "$TMP/none")"       "0"

echo "ratchet_check (0 only at the baseline, 1 above it, 3 below it, 2 when a number is unreadable)"
verdict() { local rc=0 msg; msg="$(ratchet_check "$1" "$2" "${3:-}")" || rc=$?; echo "$rc|$msg"; }
check "above the baseline returns 1"      "$(verdict 268 267 | cut -d'|' -f1)" "1"
check "growth names count and baseline"   "$(verdict 268 267 | cut -d'|' -f2 | cut -c1-40)" "Advisory warnings: 268 (baseline 267) GR"
check "at the baseline returns 0"         "$(verdict 267 267)" "0|Advisory warnings: 267 (baseline 267)"
check "below the baseline returns 3 (strict, no slack)" "$(verdict 266 267 | cut -d'|' -f1)" "3"
check "below the baseline names the exact aggregate line" "$(verdict 266 267 | cut -d'|' -f2 | grep --count 'BELOW the baseline: set WARNINGS_BASELINE to 266 in tests/run-all-tests.sh')" "1"
check "a category below its line returns 3"  "$(verdict 265 266 Skills | cut -d'|' -f1)" "3"
check "a category below its line names category, count, baseline and the line to write" \
    "$(verdict 265 266 Skills | cut -d'|' -f2 | grep --count "^Advisory warnings: 265 (baseline 266) BELOW the baseline in category Skills: write the line 'Skills=265' in tests/warnings-baselines.txt")" "1"
check "a category above its line names the category" \
    "$(verdict 267 266 Skills | cut -d'|' -f2 | grep --count '^Advisory warnings: 267 (baseline 266) GREW in category Skills')" "1"
check "a category at its line returns 0"     "$(verdict 266 266 Skills)" "0|Advisory warnings: 266 (baseline 266)"
check "an empty count returns 2"          "$(verdict '' 267 | cut -d'|' -f1)" "2"
check "a non-numeric count returns 2"     "$(verdict many 267 | cut -d'|' -f1)" "2"
check "a non-numeric baseline returns 2"  "$(verdict 5 abc | cut -d'|' -f1)" "2"
check "a leading zero is not octal (010 equals 10)" "$(verdict 010 10 | cut -d'|' -f1)" "0"
check "the unknown message is not the growth message" "$(verdict many 267 | cut -d'|' -f2 | grep --count 'GREW')" "0"

echo "category_baseline (one label=N line per category)"
write baselines "# comment\n\nUnit=12  \nSkill Efficiency Scorecard (advisory)=4\nBad=lots\nDup=1\nDup=2\n"
check "a plain category"                          "$(category_baseline "$TMP/baselines" Unit)" "12"
check "a label with spaces and parentheses"       "$(category_baseline "$TMP/baselines" "Skill Efficiency Scorecard (advisory)")" "4"
check "a non-numeric value is returned as is, for ratchet_check to refuse" "$(category_baseline "$TMP/baselines" Bad)" "lots"
check "the first of two duplicate lines wins"     "$(category_baseline "$TMP/baselines" Dup)" "1"
missing_rc=0
category_baseline "$TMP/baselines" Nope > /dev/null || missing_rc=$?
check "a category with no line returns 1"         "$missing_rc" "1"
prefix_rc=0
category_baseline "$TMP/baselines" Uni > /dev/null || prefix_rc=$?
check "a prefix of a label is not a match"        "$prefix_rc" "1"
comment_rc=0
category_baseline "$TMP/baselines" "# comment" > /dev/null || comment_rc=$?
check "a comment line is not a category"          "$comment_rc" "1"

echo "runner wiring"
if grep --quiet --fixed-strings 'ratchet_check "$skills_warnings" "$WARNINGS_BASELINE"' "$RUNNER"; then
    ok "run-all-tests.sh gates the skills warning count with ratchet_check"
else
    bad "run-all-tests.sh does not call ratchet_check on the skills warning count"
fi
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
