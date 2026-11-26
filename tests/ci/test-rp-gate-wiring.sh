#!/bin/bash
# The rp-diff-gate consumer wiring must FAIL CLOSED (#5470, Opus HOLD 2):
# an `if: needs.rp-gate.outputs.skip != 'true'` alone gets an implicit
# success() prefix, so a failed or cancelled gate skipped every heavy job
# and CI Summary still read green. The contract now is:
#
#   - every consumer `if` evaluates needs.rp-gate.result, not just the
#     output: only (gate success AND skip=true) skips; a failed, cancelled
#     or skipped gate runs the suites;
#   - every consumer `if` carries a status function (!cancelled()) so
#     GitHub evaluates it instead of skipping on a failed need;
#   - CI Summary needs rp-gate and turns red on any non-success result;
#   - every rp-gate calling job passes the permissions the reusable asks.
#
# Outputs go to files and are grepped there: no here-strings, no pipes
# into grep -q (#603, ork#3348).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WF_DIR="$SCRIPT_DIR/../../.github/workflows"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
PASS=0; FAIL=0
log_pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
log_fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
section() { echo; echo "${YELLOW}$1${NC}"; }

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ork-rp-wiring.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

SKIP_TERM="needs.rp-gate.outputs.skip == 'true'"
RESULT_TERM="needs.rp-gate.result == 'success'"
NEGATED_TERM="!(needs.rp-gate.result == 'success' && needs.rp-gate.outputs.skip == 'true')"

CONSUMERS="ci.yml codeql.yml eval-index-effectiveness.yml eval-routing.yml plugin-eval.yml visual-style-lint.yml"

section "1. Every rp-gate caller job passes the reusable's permissions"
for wf in $CONSUMERS; do
  grep -A4 'uses: ./.github/workflows/rp-diff-gate.yml' "$WF_DIR/$wf" > "$WORK_DIR/rp-$wf.txt"
  if grep -qF 'pull-requests: read' "$WORK_DIR/rp-$wf.txt" && grep -qF 'contents: read' "$WORK_DIR/rp-$wf.txt"; then
    log_pass "$wf: rp-gate job grants contents+pull-requests read"
  else
    log_fail "$wf: rp-gate job missing permissions (startup_failure risk)"
  fi
done

section "2. Every skip check is gated on gate success (fail closed)"
for wf in $CONSUMERS; do
  bad_rc=0
  grep -nF "$SKIP_TERM" "$WF_DIR/$wf" | grep -vF "$NEGATED_TERM" > "$WORK_DIR/bad-$wf.txt" || bad_rc=$?
  if [[ $bad_rc -eq 0 && -s "$WORK_DIR/bad-$wf.txt" ]]; then
    log_fail "$wf: skip used without the gate-success guard: $(cat "$WORK_DIR/bad-$wf.txt")"
  else
    log_pass "$wf: every skip term is wrapped in !(gate success && skip)"
  fi
done

section "3. Every gated if: carries a status function and a need result"
for wf in $CONSUMERS; do
  bad_rc=0
  grep -nF "$NEGATED_TERM" "$WF_DIR/$wf" | grep -vF '!cancelled()' > "$WORK_DIR/noefc-$wf.txt" || bad_rc=$?
  if [[ $bad_rc -eq 0 && -s "$WORK_DIR/noefc-$wf.txt" ]]; then
    log_fail "$wf: a gated if: has no !cancelled(), a failed gate still skips: $(cat "$WORK_DIR/noefc-$wf.txt")"
  else
    log_pass "$wf: gated ifs evaluate even when a need fails"
  fi
done

section "3b. Every consumer workflow actually has a gated if (no vacuous pass)"
for wf in codeql.yml eval-index-effectiveness.yml eval-routing.yml plugin-eval.yml visual-style-lint.yml; do
  gated_count=$(grep -cF "$NEGATED_TERM" "$WF_DIR/$wf")
  if [[ $gated_count -ge 1 ]]; then
    log_pass "$wf: $gated_count gated consumer if(s)"
  else
    log_fail "$wf: no consumer if gates on the rp-gate skip output"
  fi
done
ci_gated=$(grep -cF "$NEGATED_TERM" "$WF_DIR/ci.yml")
if [[ $ci_gated -ge 8 ]]; then
  log_pass "ci.yml: $ci_gated gated consumer ifs"
else
  log_fail "ci.yml: only $ci_gated gated ifs, expected >= 8 consumers"
fi

section "4. ci.yml non-gate needs are required as success, not merely present"
bp_rc=0
grep -nF 'needs.build-plugins.result' "$WF_DIR/ci.yml" > "$WORK_DIR/bp.txt" || bp_rc=$?
if [[ $bp_rc -eq 0 && $(wc -l < "$WORK_DIR/bp.txt" | tr -d ' ') -ge 5 ]]; then
  log_pass "build-plugins result is required by $(wc -l < "$WORK_DIR/bp.txt" | tr -d ' ') gated jobs"
else
  log_fail "gated jobs no longer require build-plugins to succeed"
fi
ut_rc=0
grep -nF 'needs.unit-tests.result' "$WF_DIR/ci.yml" > "$WORK_DIR/ut.txt" || ut_rc=$?
if [[ $ut_rc -eq 0 && $(wc -l < "$WORK_DIR/ut.txt" | tr -d ' ') -ge 2 ]]; then
  log_pass "integration/coverage still require unit-tests success"
else
  log_fail "integration/coverage lost their unit-tests requirement"
fi

section "5. CI Summary aggregates rp-gate and turns red on non-success"
SUMMARY_BLOCK="$WORK_DIR/summary.txt"
awk '/^  summary:/,/^    runs-on/' "$WF_DIR/ci.yml" > "$SUMMARY_BLOCK"
if grep -qF 'rp-gate' "$SUMMARY_BLOCK"; then
  log_pass "CI Summary needs rp-gate"
else
  log_fail "CI Summary does not need rp-gate: gate failure is invisible"
fi
if grep -qF 'needs.rp-gate.result' "$WF_DIR/ci.yml" && grep -qF 'rp-gate result is' "$WF_DIR/ci.yml"; then
  log_pass "CI Summary fails when the gate result is not success"
else
  log_fail "CI Summary does not fail on a non-success gate"
fi

section "6. The gate job is wired before build, not inside a suite"
if [[ $(grep -cF 'uses: ./.github/workflows/rp-diff-gate.yml' "$WF_DIR/ci.yml") -eq 1 ]]; then
  log_pass "exactly one rp-gate caller in ci.yml"
else
  log_fail "rp-gate caller count drifted in ci.yml"
fi

echo
if [[ $FAIL -gt 0 ]]; then
  echo "${RED}FAILED${NC}: $FAIL failed, $PASS passed"
  exit 1
fi
echo "${GREEN}PASSED${NC}: $PASS checks"
