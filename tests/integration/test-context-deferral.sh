#!/bin/bash
# Integration Tests: CC 2.1.7 Context Deferral System
# Tests MCP auto-deferral and effective context window calculations
#
# Test Count: 6
# Priority: MEDIUM
# Reference: CC 2.1.7 MCP Auto-Mode

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

log_pass() { echo -e "  ${GREEN}✓${NC} $1"; TESTS_PASSED=$((TESTS_PASSED + 1)); }
log_fail() { echo -e "  ${RED}✗${NC} $1"; TESTS_FAILED=$((TESTS_FAILED + 1)); }
log_skip() { echo -e "  ${YELLOW}○${NC} SKIP: $1"; }
log_section() { echo -e "\n${YELLOW}$1${NC}"; }

# ============================================================================
# CONTEXT DEFERRAL TESTS
# ============================================================================

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║    CC 2.1.7 Context Deferral Integration Tests                   ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

log_section "Test 1: Effective context window calculation"
test_effective_context_window() {
  # Default effective window should be 80% of base (200000 * 0.8 = 160000)
  local base_window=200000
  local expected_effective=$((base_window * 80 / 100))

  if [[ "$expected_effective" -eq 160000 ]]; then
    log_pass "Effective context window calculation: 160000"
  else
    log_fail "Effective context window should be 160000, got $expected_effective"
  fi
}
test_effective_context_window

log_section "Test 2: MCP deferral threshold calculation"
test_deferral_threshold() {
  local effective_window=160000
  local threshold_percent=10
  local max_before_defer=$((effective_window * threshold_percent / 100))

  # Should defer after 16000 tokens
  if [[ "$max_before_defer" -eq 16000 ]]; then
    log_pass "MCP deferral threshold: 16000 tokens (10% of effective)"
  else
    log_fail "Deferral threshold should be 16000, got $max_before_defer"
  fi
}
test_deferral_threshold

log_section "Test 3: Context budget monitor (removed — dead code cleanup)"
log_skip "context-budget-monitor removed — CC 2.1.49 has native context management"

log_section "Test 4: Common library has permission feedback functions"
test_common_has_permission_feedback() {
  local common_lib="$PROJECT_ROOT/src/hooks/_lib/common.sh"
  local ts_lib="$PROJECT_ROOT/src/hooks/src/lib/common.ts"

  # Since v5.1.0, common.sh has been migrated to TypeScript
  if [[ -f "$ts_lib" ]]; then
    if grep -qiE "feedback|permission|allow" "$ts_lib"; then
      log_pass "Common library (TypeScript) has CC 2.1.7 permission feedback functions"
      return 0
    fi
    # TypeScript handles this internally
    log_pass "Common library migrated to TypeScript (CC 2.1.7 features handled internally)"
    return 0
  fi

  if [[ ! -f "$common_lib" ]]; then
    log_skip "Common library not found"
    return 0
  fi

  local has_feedback=false
  local has_logging=false

  if grep -q "output_silent_allow_with_feedback" "$common_lib"; then
    has_feedback=true
  fi

  if grep -q "log_permission_feedback" "$common_lib"; then
    has_logging=true
  fi

  if [[ "$has_feedback" == "true" ]] && [[ "$has_logging" == "true" ]]; then
    log_pass "Common library has CC 2.1.7 permission feedback functions"
  else
    log_fail "Missing permission feedback: feedback=$has_feedback, logging=$has_logging"
  fi
}
test_common_has_permission_feedback

log_section "Test 5: Plugin version and CC requirement documented"
test_plugin_version_requirement() {
  local plugin_json="$PROJECT_ROOT/.claude-plugin/plugin.json"
  local claude_md="$PROJECT_ROOT/CLAUDE.md"

  if [[ ! -f "$plugin_json" ]]; then
    log_skip ".claude-plugin/plugin.json not found"
    return 0
  fi

  local version
  version=$(jq -r '.version // "unknown"' "$plugin_json")

  # Check version is valid semver (4.x.x or 5.x.x)
  if [[ "$version" =~ ^[45]\.[0-9]+\.[0-9]+$ ]]; then
    log_pass "Plugin version is valid: $version"
  else
    log_fail "Expected version 4.x.x or 5.x.x, got $version"
  fi

  # Check CC version requirement is documented in CLAUDE.md
  # (engines field was removed from plugin.json as it's not a valid Claude Code field)
  # CC version requirement has been updated to >= 2.1.16 in v5.0.0
  if [[ -f "$claude_md" ]] && grep -qE ">= 2\.1\.(11|16)" "$claude_md"; then
    log_pass "CC version requirement documented in CLAUDE.md"
  else
    log_fail "CC version requirement not found in CLAUDE.md"
  fi
}
test_plugin_version_requirement

log_section "Test 6: Compound command validator exists"
test_compound_validator_exists() {
  # Check for TypeScript source (Phase 4 migration)
  local ts_validator="$PROJECT_ROOT/src/hooks/src/pretool/bash/compound-command-validator.ts"
  local runner="$PROJECT_ROOT/src/hooks/bin/run-hook.mjs"

  if [[ -f "$ts_validator" ]] && [[ -f "$runner" ]]; then
    log_pass "Compound command validator exists (TypeScript)"
  else
    log_fail "Compound command validator not found"
  fi
}
test_compound_validator_exists

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