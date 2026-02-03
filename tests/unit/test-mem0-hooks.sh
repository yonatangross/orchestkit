#!/bin/bash
# test-mem0-hooks.sh - Unit tests for mem0 hooks
# Part of OrchestKit Claude Plugin test suite
#
# Tests:
# 1. All mem0 TypeScript hooks exist (source files)
# 2. Compiled bundles exist in dist/
# 3. Hooks output CC 2.1.7 compliant JSON via run-hook.mjs
# 4. Hooks handle missing MEM0_API_KEY gracefully

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Export for hooks
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
export CLAUDE_PLUGIN_ROOT="$PROJECT_ROOT"
export CLAUDE_SESSION_ID="test-session-$$"

# Hooks directory - TypeScript sources are in src/hooks/src/
HOOKS_SRC_DIR="$PROJECT_ROOT/src/hooks/src"
HOOKS_BIN_DIR="$PROJECT_ROOT/src/hooks/bin"
HOOKS_DIST_DIR="$PROJECT_ROOT/src/hooks/dist"

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
# Test Group 1: Hook Source Files Exist (TypeScript)
# =============================================================================

echo -e "${CYAN}Test Group 1: TypeScript Hook Sources${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

test_setup_hooks_exist() {
    test_start "setup mem0 hooks exist (TypeScript)"
    local hooks=(
        "setup/mem0-backup-setup.ts"
        "setup/mem0-cleanup.ts"
        "setup/mem0-analytics-dashboard.ts"
    )
    local missing=()
    for hook in "${hooks[@]}"; do
        if [[ ! -f "$HOOKS_SRC_DIR/$hook" ]]; then
            missing+=("$hook")
        fi
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Missing hooks: ${missing[*]}"
    fi
}

test_subagent_hooks_exist() {
    test_start "subagent-start mem0 hooks exist (TypeScript)"
    if [[ -f "$HOOKS_SRC_DIR/subagent-start/mem0-memory-inject.ts" ]]; then
        test_pass
    else
        test_fail "mem0-memory-inject.ts not found"
    fi
}

test_stop_hooks_exist() {
    test_start "stop mem0 hooks exist (TypeScript)"
    local hooks=(
        "stop/mem0-pre-compaction-sync.ts"
        "stop/mem0-queue-sync.ts"
    )
    local missing=()
    for hook in "${hooks[@]}"; do
        if [[ ! -f "$HOOKS_SRC_DIR/$hook" ]]; then
            missing+=("$hook")
        fi
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Missing hooks: ${missing[*]}"
    fi
}

test_setup_hooks_exist
test_subagent_hooks_exist
test_stop_hooks_exist

echo ""

# =============================================================================
# Test Group 2: Compiled Bundles Exist
# =============================================================================

echo -e "${CYAN}Test Group 2: Compiled Bundles${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

test_compiled_bundles_exist() {
    test_start "required bundles exist in dist/"
    local bundles=(
        "setup.mjs"
        "subagent.mjs"
        "stop.mjs"
    )
    local missing=()
    for bundle in "${bundles[@]}"; do
        if [[ ! -f "$HOOKS_DIST_DIR/$bundle" ]]; then
            missing+=("$bundle")
        fi
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Missing bundles: ${missing[*]}"
    fi
}

test_run_hook_script_exists() {
    test_start "run-hook.mjs runner exists"
    if [[ -f "$HOOKS_BIN_DIR/run-hook.mjs" ]]; then
        test_pass
    else
        test_fail "run-hook.mjs not found"
    fi
}

test_compiled_bundles_exist
test_run_hook_script_exists

echo ""

# =============================================================================
# Test Group 3: CC 2.1.7 Compliance via run-hook.mjs
# =============================================================================

echo -e "${CYAN}Test Group 3: CC 2.1.7 Compliance${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

test_hooks_output_json() {
    test_start "hooks output CC 2.1.7 compliant JSON"

    # Check if run-hook.mjs exists
    if [[ ! -f "$HOOKS_BIN_DIR/run-hook.mjs" ]]; then
        test_fail "run-hook.mjs not found"
        return
    fi

    # Test registered hooks via run-hook.mjs with empty input
    local failed=()
    local hooks=(
        "setup/mem0-cleanup"
        "setup/mem0-analytics-dashboard"
        "setup/mem0-backup-setup"
    )

    # Unset MEM0_API_KEY to simulate missing mem0
    unset MEM0_API_KEY 2>/dev/null || true

    for hook in "${hooks[@]}"; do
        # Run hook with empty JSON input via run-hook.mjs
        output=$(echo '{}' | node "$HOOKS_BIN_DIR/run-hook.mjs" "$hook" 2>&1) || true
        # Check if output contains valid JSON with "continue" field
        if ! echo "$output" | jq -e '.continue' >/dev/null 2>&1; then
            failed+=("$hook")
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
# Test Group 4: Graceful Degradation
# =============================================================================

echo -e "${CYAN}Test Group 4: Graceful Degradation${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

test_hooks_handle_missing_mem0() {
    test_start "hooks handle missing MEM0_API_KEY gracefully"

    # Check if run-hook.mjs exists
    if [[ ! -f "$HOOKS_BIN_DIR/run-hook.mjs" ]]; then
        test_fail "run-hook.mjs not found"
        return
    fi

    # Unset MEM0_API_KEY to simulate missing mem0
    unset MEM0_API_KEY 2>/dev/null || true

    local failed=()
    local hooks=(
        "setup/mem0-cleanup"
        "setup/mem0-analytics-dashboard"
    )

    for hook in "${hooks[@]}"; do
        # Run hook - should exit with 0 even without mem0
        if ! echo '{}' | node "$HOOKS_BIN_DIR/run-hook.mjs" "$hook" >/dev/null 2>&1; then
            failed+=("$hook")
        fi
    done

    if [[ ${#failed[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Hooks don't handle missing MEM0_API_KEY gracefully: ${failed[*]}"
    fi
}

test_hooks_continue_true_without_mem0() {
    test_start "hooks return continue:true without MEM0_API_KEY"

    # Check if run-hook.mjs exists
    if [[ ! -f "$HOOKS_BIN_DIR/run-hook.mjs" ]]; then
        test_fail "run-hook.mjs not found"
        return
    fi

    # Unset MEM0_API_KEY to simulate missing mem0
    unset MEM0_API_KEY 2>/dev/null || true

    local failed=()
    local hooks=(
        "setup/mem0-cleanup"
        "setup/mem0-analytics-dashboard"
    )

    for hook in "${hooks[@]}"; do
        # Run hook and check continue is true
        output=$(echo '{}' | node "$HOOKS_BIN_DIR/run-hook.mjs" "$hook" 2>&1) || true
        continue_val=$(echo "$output" | jq -r '.continue' 2>/dev/null)
        if [[ "$continue_val" != "true" ]]; then
            failed+=("$hook (continue=$continue_val)")
        fi
    done

    if [[ ${#failed[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Hooks don't return continue:true: ${failed[*]}"
    fi
}

test_hooks_handle_missing_mem0
test_hooks_continue_true_without_mem0

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
