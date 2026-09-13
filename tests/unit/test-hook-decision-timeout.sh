#!/usr/bin/env bash
# Test: hook_decision names a hook timeout instead of returning a verdict (#4085)
#
# WHY THIS EXISTS
# Under pre-push at 1-minute load 37, tests/security/test-permission-mode-matrix.sh
# went 13/17 with every miss logged as "expected deny, got abstain". The hook
# had not decided anything: it had timed out (the runner's 100 ms stdin
# watchdog ran it on `{}`), and the helper handed that empty answer back as a
# verdict. hook_decision now runs the hook under ORK_HOOK_TIMEOUT (default 5 s)
# and answers ERROR with "hook timed out after Ns" on either timeout shape.
#
# The budget path is driven here with a budget no node process can meet
# (0.01 s), so the kill is deterministic. It needs a timeout binary; a macOS
# box without coreutils has none (measured 2026-09-13), and the case is
# reported as SKIP there rather than as a pass it did not earn. The 100 ms
# watchdog path cannot be forced from outside the pipeline hook_decision owns,
# so it is not asserted here; its detection is a stderr grep and is covered by
# reading the helper.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export PROJECT_ROOT

PASS=0
FAIL=0
SKIP=0
log_pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
log_fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
log_skip() { echo "  SKIP: $1"; SKIP=$((SKIP + 1)); }

HOOK='pretool/bash/network-egress-guard'
PAYLOAD='{"tool_name":"Bash","tool_input":{"command":"ls -la"}}'

echo "=== hook_decision timeout reporting (#4085) ==="

# 1. The budget is read from the env at source time.
# shellcheck source=/dev/null
ORK_HOOK_TIMEOUT=0.01 source "$PROJECT_ROOT/tests/fixtures/test-helpers.sh"
if [[ "${ORK_HOOK_BUDGET:-}" == "0.01" ]]; then
    log_pass "ORK_HOOK_BUDGET reads ORK_HOOK_TIMEOUT (0.01)"
else
    log_fail "ORK_HOOK_BUDGET is [${ORK_HOOK_BUDGET:-unset}], want 0.01"
fi

# 2. Under an unmeetable budget the answer is ERROR and stderr names the cause.
if command -v timeout >/dev/null 2>&1 || command -v gtimeout >/dev/null 2>&1; then
    err_file=$(mktemp "${TMPDIR:-/tmp}/ork-hd-err.XXXXXX")
    got=$(hook_decision "$HOOK" "$PAYLOAD" 2>"$err_file")
    if [[ "$got" == "ERROR" ]]; then
        log_pass "budget-killed hook answers ERROR, not a verdict (got [$got])"
    else
        log_fail "budget-killed hook answered [$got], want ERROR"
    fi
    if grep -q 'timed out after 0.01s' "$err_file"; then
        log_pass "stderr names the cause: $(grep -o 'timed out after [0-9.]*s[^;]*' "$err_file" | head -1)"
    else
        log_fail "stderr does not say 'timed out after 0.01s': $(tr '\n' ' ' <"$err_file")"
    fi
    rm -f "$err_file"
else
    log_skip "no timeout/gtimeout binary on this box; budget path not exercised"
fi

# 3. With a real budget the same call still reaches the hook and gets a verdict.
# `ls -la` carries no egress, so the guard abstains; that is the measured value
# and the point is only that the wrapper did not break the normal path.
ORK_HOOK_BUDGET=30
got=$(hook_decision "$HOOK" "$PAYLOAD" 2>/dev/null)
if [[ "$got" == "abstain" ]]; then
    log_pass "under a 30 s budget the hook runs and answers abstain for a benign command"
else
    log_fail "under a 30 s budget expected abstain, got [$got]"
fi

echo ""
echo "  Passed: $PASS  Failed: $FAIL  Skipped: $SKIP"
[[ $FAIL -eq 0 ]]
