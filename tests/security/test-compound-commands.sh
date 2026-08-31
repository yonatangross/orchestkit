#!/bin/bash
# Security Tests: Compound Command Validation (CC 2.1.7)
# Tests for compound command bypass vulnerabilities
#
# Test Count: 7 (6 retired with compound-command-validator, #3835)
# Priority: HIGH
# Reference: CC 2.1.7 Security Fix - Compound Shell Operators
#
# WHAT THIS FILE ASSERTS, AND WHY IT LOOKS THE WAY IT DOES
#
# A PreToolUse hook never executes the command it is shown. It reads a JSON
# payload and emits a DECISION. So the only observable a test can assert is that
# decision, and every assertion here goes through `expect_decision`, which routes
# to the live hook via src/hooks/bin/run-hook.mjs and first proves the hook key
# is registered — an unregistered key answers `{"continue":true}`, which is
# indistinguishable from "allowed" if you only read the payload.
#
# Four verdicts are possible: deny | ask | allow | abstain. `abstain` means the
# hook emitted no permissionDecision: it declined to decide, and the request
# falls through to the normal permission flow. That is NOT `allow`, which
# auto-approves and skips the user prompt entirely.
#
# Every verdict below was measured against the hook at HEAD before it was
# written down. If a hook change makes one of these fail, the hook's behaviour
# changed; investigate that before touching the expectation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source test helpers (provides expect_decision + hook_decision)
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

log_pass() { echo -e "  ${GREEN}✓${NC} $1"; TESTS_PASSED=$((TESTS_PASSED + 1)); }
log_fail() { echo -e "  ${RED}✗${NC} $1"; TESTS_FAILED=$((TESTS_FAILED + 1)); }
log_section() { echo -e "\n${YELLOW}$1${NC}"; }

BLOCKER="pretool/bash/dangerous-command-blocker"

# Marshal a Bash tool call into the PreToolUse payload shape.
# The command is DATA here: it is handed to a hook that only decides. Nothing in
# this file ever executes any of the strings below.
bash_payload() {
  jq -n --arg cmd "$1" '{"tool_name":"Bash","tool_input":{"command":$cmd}}'
}

# The dangerous tail hidden behind each compound operator. Kept in one place so
# the six operator tests differ only in the operator under test.
DANGEROUS_TAIL='rm -rf /'

# ============================================================================
# COMPOUND COMMAND SECURITY TESTS
# ============================================================================

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║    CC 2.1.7 Compound Command Security Tests                      ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

# The bypass class tests 1-6 exist for: the dangerous command is not the first
# word, it is hidden after a compound operator behind a benign head. A
# first-word-only check reads `git`, `false`, `echo` and waves it through.
# Measured at HEAD: the blocker denies all six.

log_section "Test 1: && chain detection"
expect_decision deny "$BLOCKER" \
  "$(bash_payload "git status && $DANGEROUS_TAIL")" \
  "&& chain: dangerous tail behind a benign head is denied"

log_section "Test 2: || chain detection"
expect_decision deny "$BLOCKER" \
  "$(bash_payload "false || $DANGEROUS_TAIL")" \
  "|| chain: dangerous tail behind a benign head is denied"

log_section "Test 3: ; chain detection"
expect_decision deny "$BLOCKER" \
  "$(bash_payload "echo test; $DANGEROUS_TAIL")" \
  "; chain: dangerous tail behind a benign head is denied"

log_section "Test 4: | pipe chain detection"
expect_decision deny "$BLOCKER" \
  "$(bash_payload "echo data | $DANGEROUS_TAIL")" \
  "| pipe: dangerous tail behind a benign head is denied"

log_section "Test 5: Mixed operator chains"
expect_decision deny "$BLOCKER" \
  "$(bash_payload "echo a && echo b || $DANGEROUS_TAIL")" \
  "mixed && / || chain: dangerous tail is denied"

log_section "Test 6: Line continuation + compound (CC 2.1.6 + 2.1.7)"
# A backslash-newline inside the head must not hide the compound operator that
# follows it. The two fixes have to hold together, not just individually.
expect_decision deny "$BLOCKER" \
  "$(bash_payload "$(printf 'git \\\nstatus && %s' "$DANGEROUS_TAIL")")" \
  "line continuation + && chain: dangerous tail is denied"

log_section "Test 7: Safe compound commands (false positive check)"
# The inverse of tests 1-6: an ordinary compound command must not be caught by
# the operator handling. Measured at HEAD: the blocker ABSTAINS on all four. It
# emits no decision, so they fall through to the normal permission flow.
# Asserting `abstain` rather than `allow` is deliberate — the blocker does not
# auto-approve anything, and a change that made it start doing so would be a
# real behaviour change this test should catch.
expect_decision abstain "$BLOCKER" \
  "$(bash_payload 'git status && git log --oneline -5')" \
  "safe && chain not blocked: git status && git log"
expect_decision abstain "$BLOCKER" \
  "$(bash_payload 'npm install && npm test')" \
  "safe && chain not blocked: npm install && npm test"
expect_decision abstain "$BLOCKER" \
  "$(bash_payload 'ls -la | grep .js')" \
  "safe pipe not blocked: ls -la | grep .js"
expect_decision abstain "$BLOCKER" \
  "$(bash_payload 'echo test; pwd; date')" \
  "safe ; chain not blocked: echo test; pwd; date"

log_section "Tests 8-13: retired with compound-command-validator (#3835 wave 1)"
# The validator was deleted 2026-08-31: CC decomposes compound commands per
# segment itself (nine-release fix trail through 2.1.251), so a second parser
# beside it was Shadow drift (shared/rules/cc-native-first.md, purge rows).
# The native layer is gated by the canary probe in CI
# (tests/ci/restricted-smoke/probe-permission-deny.sh: REGRESSED on failure).
# What was deliberately given up, recorded so nobody rediscovers it as a gap:
# process-substitution-to-interpreter, command-form brace expansion, IFS and
# nested-substitution obfuscation, and the here-string ASK. The blocker's own
# compound coverage (Tests 1-7 above) still stands.
echo "  (6 validator cases retired; native layer gated by the CI canary probe)"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=========================================="
echo "  Results: $TESTS_PASSED passed, $TESTS_FAILED failed"
echo "=========================================="

if [[ $TESTS_FAILED -gt 0 ]]; then
  echo -e "${RED}FAIL: Some tests failed${NC}"
  exit 1
else
  echo -e "${GREEN}SUCCESS: All tests passed${NC}"
  exit 0
fi
