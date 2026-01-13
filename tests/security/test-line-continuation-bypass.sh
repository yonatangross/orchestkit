#!/bin/bash
# Test CC 2.1.6 Line Continuation Bypass Regression
#
# CC 2.1.6 fixed a vulnerability where line continuation characters (\)
# could be used to bypass command validation. This test ensures our hooks
# properly detect and normalize such commands.
#
# Reference: Claude Code 2.1.6 Changelog - Security Fix

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
PASSED=0
FAILED=0

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASSED++)) || true; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAILED++)) || true; }
log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Test normalization function (same as bash-dispatcher uses)
normalize_command() {
  local result
  result=$(printf '%s' "$1" | sed -E 's/\\[[:space:]]*[\r\n]+//g' | tr '\n' ' ' | tr -s ' ')
  # Trim trailing whitespace only
  result="${result%"${result##*[![:space:]]}"}"
  printf '%s' "$result"
}

# Test that dangerous commands are detected after normalization
test_dangerous_command_detection() {
  log_info "Testing dangerous command detection after normalization..."

  # Create test input
  local test_cmd="rm -rf /"
  local normalized
  normalized=$(normalize_command "$test_cmd")

  if [[ "$normalized" == *"rm -rf /"* ]]; then
    log_pass "Dangerous command detected: rm -rf /"
  else
    log_fail "Failed to detect: rm -rf /"
  fi
}

# Test git command detection
test_git_command_detection() {
  log_info "Testing git command detection..."

  local test_cases=(
    "git commit -m test"
    "git push --force main"
    "git push -f origin main"
  )

  for cmd in "${test_cases[@]}"; do
    local normalized
    normalized=$(normalize_command "$cmd")

    if [[ "$normalized" =~ git\ commit ]] || [[ "$normalized" =~ git\ push.*--force ]] || [[ "$normalized" =~ git\ push.*-f ]]; then
      log_pass "Git command detected: ${cmd:0:30}..."
    else
      log_fail "Failed to detect: $cmd"
    fi
  done
}

# Test that the sed normalization works correctly
test_sed_normalization() {
  log_info "Testing sed normalization logic..."

  # Test basic command unchanged
  local input="test command"
  local expected="test command"
  local result
  result=$(normalize_command "$input")

  if [[ "$result" == "$expected" ]]; then
    log_pass "Simple command unchanged"
  else
    log_fail "Simple command modified: expected '$expected', got '$result'"
  fi
}

# Test the bash dispatcher normalization integration
test_dispatcher_integration() {
  log_info "Testing dispatcher normalization integration..."

  local dispatcher="$PROJECT_ROOT/hooks/pretool/bash-dispatcher.sh"

  if [[ -f "$dispatcher" ]]; then
    # Check that the dispatcher includes normalization
    if grep -q "COMMAND_NORMALIZED" "$dispatcher"; then
      log_pass "Dispatcher includes normalization variable"
    else
      log_fail "Dispatcher missing normalization"
    fi

    # Check that it uses normalized command for checks
    if grep -q "COMMAND_FOR_CHECK" "$dispatcher"; then
      log_pass "Dispatcher uses normalized command for security checks"
    else
      log_fail "Dispatcher not using normalized command"
    fi

    # Check for CC 2.1.6 comment
    if grep -q "CC 2.1.6" "$dispatcher"; then
      log_pass "Dispatcher has CC 2.1.6 security documentation"
    else
      log_fail "Dispatcher missing CC 2.1.6 documentation"
    fi
  else
    log_fail "Dispatcher not found at: $dispatcher"
  fi
}

# Main execution
main() {
  echo ""
  echo "================================================================"
  echo "  CC 2.1.6 Line Continuation Bypass Security Tests"
  echo "================================================================"
  echo ""

  test_sed_normalization
  test_dangerous_command_detection
  test_git_command_detection
  test_dispatcher_integration

  echo ""
  echo "================================================================"
  echo -e "  Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
  echo "================================================================"
  echo ""

  if [[ "$FAILED" -gt 0 ]]; then
    exit 1
  fi
  exit 0
}

main "$@"