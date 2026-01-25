#!/bin/bash
# test-mem0-hooks.sh - Unit tests for mem0 hooks
# Part of OrchestKit Claude Plugin test suite
#
# Tests:
# 1. All new hooks are executable
# 2. Hooks output CC 2.1.7 compliant JSON
# 3. Hooks handle missing mem0 gracefully
# 4. Hooks create expected config files

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Export for hooks
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
export CLAUDE_PLUGIN_ROOT="$PROJECT_ROOT"

# Hooks directory
HOOKS_DIR="$PROJECT_ROOT/src/hooks"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' NC=''
fi

# Test helpers
test_start() {
    local name="$1"
    echo -n "  ○ $name... "
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
    echo -e "${GREEN}PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    local reason="${1:-}"
    echo -e "${RED}FAIL${NC}"
    [[ -n "$reason" ]] && echo "    └─ $reason"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

test_skip() {
    local reason="${1:-}"
    echo -e "${YELLOW}SKIP${NC}"
    [[ -n "$reason" ]] && echo "    └─ $reason"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Mem0 Hooks Unit Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# =============================================================================
# Test Group 1: Hook Structure
# =============================================================================

echo -e "${CYAN}Test Group 1: Hook Structure${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

test_lifecycle_hooks_exist() {
    test_start "lifecycle hooks exist"
    local hooks=(
        "lifecycle/mem0-webhook-setup.sh"
        "lifecycle/mem0-analytics-tracker.sh"
    )
    local missing=()
    for hook in "${hooks[@]}"; do
        if [[ ! -f "$HOOKS_DIR/$hook" ]]; then
            missing+=("$hook")
        fi
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Missing hooks: ${missing[*]}"
    fi
}

test_posttool_hooks_exist() {
    test_start "posttool hooks exist"
    if [[ -f "$HOOKS_DIR/posttool/mem0-webhook-handler.sh" ]]; then
        test_pass
    else
        test_fail "mem0-webhook-handler.sh not found"
    fi
}

test_setup_hooks_exist() {
    test_start "setup hooks exist"
    local hooks=(
        "setup/mem0-backup-setup.sh"
        "setup/mem0-cleanup.sh"
        "setup/mem0-analytics-dashboard.sh"
    )
    local missing=()
    for hook in "${hooks[@]}"; do
        if [[ ! -f "$HOOKS_DIR/$hook" ]]; then
            missing+=("$hook")
        fi
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Missing hooks: ${missing[*]}"
    fi
}

test_hooks_are_executable() {
    test_start "all hooks are executable"
    local non_executable=()
    local hooks=(
        "lifecycle/mem0-webhook-setup.sh"
        "lifecycle/mem0-analytics-tracker.sh"
        "posttool/mem0-webhook-handler.sh"
        "setup/mem0-backup-setup.sh"
        "setup/mem0-cleanup.sh"
        "setup/mem0-analytics-dashboard.sh"
    )
    for hook in "${hooks[@]}"; do
        if [[ -f "$HOOKS_DIR/$hook" ]] && [[ ! -x "$HOOKS_DIR/$hook" ]]; then
            non_executable+=("$hook")
        fi
    done
    if [[ ${#non_executable[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Non-executable hooks: ${non_executable[*]}"
    fi
}

test_lifecycle_hooks_exist
test_posttool_hooks_exist
test_setup_hooks_exist
test_hooks_are_executable

echo ""

# =============================================================================
# Test Group 2: CC 2.1.7 Compliance
# =============================================================================

echo -e "${CYAN}Test Group 2: CC 2.1.7 Compliance${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

test_hooks_output_json() {
    test_start "hooks output CC 2.1.7 compliant JSON"
    # Test hooks with empty input (simulating no mem0)
    local failed=()
    local hooks=(
        "lifecycle/mem0-webhook-setup.sh"
        "lifecycle/mem0-analytics-tracker.sh"
    )
    
    # Unset MEM0_API_KEY to simulate missing mem0
    unset MEM0_API_KEY
    
    for hook in "${hooks[@]}"; do
        if [[ -f "$HOOKS_DIR/$hook" ]]; then
            # Run hook with empty stdin
            output=$(echo "" | bash "$HOOKS_DIR/$hook" 2>&1)
            # Check if output contains valid JSON with "continue" field
            if ! echo "$output" | jq -e '.continue' >/dev/null 2>&1; then
                failed+=("$hook")
            fi
        fi
    done
    
    if [[ ${#failed[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Hooks don't output valid JSON: ${failed[*]}"
    fi
}

test_hooks_output_json

echo ""

# =============================================================================
# Test Group 3: Graceful Degradation
# =============================================================================

echo -e "${CYAN}Test Group 3: Graceful Degradation${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

test_hooks_handle_missing_mem0() {
    test_start "hooks handle missing mem0 gracefully"
    # Unset MEM0_API_KEY to simulate missing mem0
    unset MEM0_API_KEY
    
    local failed=()
    local hooks=(
        "lifecycle/mem0-webhook-setup.sh"
        "lifecycle/mem0-analytics-tracker.sh"
    )
    
    for hook in "${hooks[@]}"; do
        if [[ -f "$HOOKS_DIR/$hook" ]]; then
            # Run hook - should exit with 0 even without mem0
            if ! echo "" | bash "$HOOKS_DIR/$hook" >/dev/null 2>&1; then
                failed+=("$hook")
            fi
        fi
    done
    
    if [[ ${#failed[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Hooks don't handle missing mem0 gracefully: ${failed[*]}"
    fi
}

test_hooks_handle_missing_mem0

echo ""

# =============================================================================
# Summary
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Tests run:    $TESTS_RUN"
echo "  Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo "  Tests failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}✓ All hook tests passed${NC}"
    exit 0
else
    echo -e "${RED}✗ Some hook tests failed${NC}"
    exit 1
fi
