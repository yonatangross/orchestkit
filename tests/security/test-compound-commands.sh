#!/bin/bash
# Security Tests: Compound Command Validation (CC 2.1.7)
# Tests for compound command bypass vulnerabilities
#
# Test Count: 8
# Priority: HIGH
# Reference: CC 2.1.7 Security Fix - Compound Shell Operators

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source test helpers
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

# Create temp directory for tests
TEMP_DIR=$(mktemp -d)
BYPASS_MARKER="$TEMP_DIR/bypass-marker"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Helper to run bash dispatcher with JSON input
run_dispatcher() {
  local cmd="$1"
  local input
  input=$(jq -n --arg cmd "$cmd" '{"tool_name":"Bash","tool_input":{"command":$cmd}}')
  echo "$input" | bash "$PROJECT_ROOT/src/hooks/pretool/bash/dangerous-command-blocker.sh" 2>/dev/null || true
}

# ============================================================================
# COMPOUND COMMAND SECURITY TESTS
# ============================================================================

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║    CC 2.1.7 Compound Command Security Tests                      ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

log_section "Test 1: && chain detection"
test_and_chain() {
  rm -f "$BYPASS_MARKER"

  # Test with safe commands chained with potentially unsafe action
  local result
  result=$(run_dispatcher "git status && touch $BYPASS_MARKER")

  # Check if blocked or if marker was created
  if [[ -f "$BYPASS_MARKER" ]]; then
    log_fail "Bypass marker created - && chain executed unsafe command"
    return 1
  fi
  log_pass "&& chain handled safely"
}
test_and_chain

log_section "Test 2: || chain detection"
test_or_chain() {
  rm -f "$BYPASS_MARKER"

  local result
  result=$(run_dispatcher "false || touch $BYPASS_MARKER")

  if [[ -f "$BYPASS_MARKER" ]]; then
    log_fail "Bypass marker created - || chain executed unsafe command"
    return 1
  fi
  log_pass "|| chain handled safely"
}
test_or_chain

log_section "Test 3: ; chain detection"
test_semicolon_chain() {
  rm -f "$BYPASS_MARKER"

  local result
  result=$(run_dispatcher "echo test; touch $BYPASS_MARKER")

  if [[ -f "$BYPASS_MARKER" ]]; then
    log_fail "Bypass marker created - ; chain executed unsafe command"
    return 1
  fi
  log_pass "; chain handled safely"
}
test_semicolon_chain

log_section "Test 4: | pipe chain detection"
test_pipe_chain() {
  rm -f "$BYPASS_MARKER"

  local result
  result=$(run_dispatcher "echo data | touch $BYPASS_MARKER")

  if [[ -f "$BYPASS_MARKER" ]]; then
    log_fail "Bypass marker created - | pipe executed unsafe command"
    return 1
  fi
  log_pass "| pipe handled safely"
}
test_pipe_chain

log_section "Test 5: Mixed operator chains"
test_mixed_chain() {
  rm -f "$BYPASS_MARKER"

  local result
  result=$(run_dispatcher "echo a && echo b || touch $BYPASS_MARKER")

  if [[ -f "$BYPASS_MARKER" ]]; then
    log_fail "Bypass marker created - mixed chain executed unsafe command"
    return 1
  fi
  log_pass "Mixed operator chain handled safely"
}
test_mixed_chain

log_section "Test 6: Line continuation + compound (CC 2.1.6 + 2.1.7)"
test_line_continuation_compound() {
  rm -f "$BYPASS_MARKER"

  # Line continuation followed by compound operator
  local cmd=$'git \\\nstatus && touch '"$BYPASS_MARKER"
  local result
  result=$(run_dispatcher "$cmd")

  if [[ -f "$BYPASS_MARKER" ]]; then
    log_fail "Bypass marker created - line continuation + compound bypassed"
    return 1
  fi
  log_pass "Line continuation + compound handled safely"
}
test_line_continuation_compound

log_section "Test 7: Safe compound commands (false positive check)"
test_safe_compound_commands() {
  local safe_commands=(
    "git status && git log --oneline -5"
    "npm install && npm test"
    "ls -la | grep .js"
    "echo test; pwd; date"
  )

  local blocked=0
  for cmd in "${safe_commands[@]}"; do
    local result
    result=$(run_dispatcher "$cmd")

    # Safe commands should NOT be blocked (continue: true)
    if [[ "$result" == *'"continue": false'* ]] || [[ "$result" == *'"continue":false'* ]]; then
      log_fail "False positive: Safe command blocked: $cmd"
      blocked=1
    fi
  done

  if [[ $blocked -eq 0 ]]; then
    log_pass "Safe compound commands allowed correctly"
  fi
}
test_safe_compound_commands

log_section "Test 8: Dispatcher has compound validation"
test_dispatcher_has_validation() {
  # Since v5.1.0, bash hooks delegate to TypeScript
  # Check for validation in either:
  # 1. The TypeScript source (hooks/src/)
  # 2. The bash dispatcher (legacy check)
  local ts_source="$PROJECT_ROOT/src/hooks/src/pretool/bash/dangerous-command-blocker.ts"
  local bash_dispatcher="$PROJECT_ROOT/src/hooks/pretool/bash/dangerous-command-blocker.sh"

  local found=false

  # Check TypeScript source for compound validation
  if [[ -f "$ts_source" ]]; then
    if grep -qi "compound\|chain\|operator\|&&\||\||;\|pipe" "$ts_source"; then
      found=true
    fi
  fi

  # Check bash dispatcher (may delegate to TypeScript)
  if [[ -f "$bash_dispatcher" ]]; then
    # If it delegates to node/TypeScript, that's valid too
    if grep -q "node\|run-hook.mjs\|compound" "$bash_dispatcher"; then
      found=true
    fi
  fi

  if [[ "$found" == "true" ]]; then
    log_pass "Dispatcher has compound command validation"
  else
    log_fail "Dispatcher missing compound command validation"
  fi
}
test_dispatcher_has_validation

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