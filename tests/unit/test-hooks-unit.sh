#!/bin/bash
# Hook Unit Tests
# Tests individual hooks with mocked inputs via run-hook.mjs
#
# Usage: ./test-hooks-unit.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
#
# IMPORTANT: Every test entry here MUST correspond to an existing hook.
# If a hook is removed, its test MUST be removed too.
# A suite with 0 passed and 0 failed is a FAILURE — always run real tests.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/src/hooks"
FIXTURES_DIR="$PROJECT_ROOT/tests/fixtures"
RUN_HOOK="$HOOKS_DIR/bin/run-hook.mjs"

VERBOSE="${1:-}"
FAILED=0
PASSED=0
SKIPPED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Setup test environment
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
export CLAUDE_SESSION_ID="test-session-$(date +%s)"
export CLAUDE_PLUGIN_ROOT="$PROJECT_ROOT/plugins/ork"

# Temp directory for test outputs
TEST_TMP=$(mktemp -d)
trap "rm -rf $TEST_TMP" EXIT

echo "=========================================="
echo "  Hook Unit Tests"
echo "=========================================="
echo ""

# Load fixtures
FIXTURES=$(cat "$FIXTURES_DIR/hook-inputs.json")
get_fixture() {
    echo "$FIXTURES" | jq -c ".$1"
}

# Test helper: run hook via run-hook.mjs with JSON input
# Returns 0 on success, 1 on failure
run_ts_hook() {
    local hook_name="$1"
    local input_json="$2"
    local expected_exit="${3:-0}"

    local output_file="$TEST_TMP/output.txt"
    local error_file="$TEST_TMP/error.txt"

    local actual_exit=0
    # macOS has no `timeout` — use perl alarm as fallback
    if command -v timeout &>/dev/null; then
        echo "$input_json" | timeout 15 node "$RUN_HOOK" "$hook_name" > "$output_file" 2> "$error_file" || actual_exit=$?
    elif command -v gtimeout &>/dev/null; then
        echo "$input_json" | gtimeout 15 node "$RUN_HOOK" "$hook_name" > "$output_file" 2> "$error_file" || actual_exit=$?
    else
        echo "$input_json" | node "$RUN_HOOK" "$hook_name" > "$output_file" 2> "$error_file" || actual_exit=$?
    fi

    if [[ $actual_exit -eq $expected_exit ]]; then
        return 0
    else
        if [[ "$VERBOSE" == "--verbose" ]]; then
            echo ""
            echo "    Expected exit $expected_exit, got $actual_exit"
            echo "    STDOUT: $(cat "$output_file" | head -5)"
            echo "    STDERR: $(cat "$error_file" | head -5)"
        fi
        return 1
    fi
}

# =====================================================================
# Test: Hook bundle existence and loadability
# =====================================================================
echo -e "${CYAN}Testing Hook Bundle Existence${NC}"
echo "----------------------------------------"

BUNDLES=(
    "dist/pretool.mjs"
    "dist/posttool.mjs"
    "dist/permission.mjs"
    "dist/prompt.mjs"
    "dist/lifecycle.mjs"
    "dist/agent.mjs"
    "dist/notification.mjs"
    "dist/skill.mjs"
    "dist/stop.mjs"
    "dist/subagent.mjs"
    "dist/setup.mjs"
)

for bundle in "${BUNDLES[@]}"; do
    echo -n "  $bundle... "
    if [[ -f "$HOOKS_DIR/$bundle" && -s "$HOOKS_DIR/$bundle" ]]; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC} (not found or empty)"
        FAILED=$((FAILED + 1))
    fi
done

# =====================================================================
# Test: hooks.json integrity
# =====================================================================
echo ""
echo -e "${CYAN}Testing hooks.json Integrity${NC}"
echo "----------------------------------------"

HOOKS_JSON="$HOOKS_DIR/hooks.json"
echo -n "  hooks.json valid JSON... "
if jq empty "$HOOKS_JSON" 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

echo -n "  hooks.json has hooks... "
HOOK_COUNT=$(jq '[.hooks | to_entries[] | .value[] | if .hooks then .hooks[] else . end] | length' "$HOOKS_JSON" 2>/dev/null || echo 0)
if [[ $HOOK_COUNT -gt 0 ]]; then
    echo -e "${GREEN}PASS${NC} ($HOOK_COUNT hook entries)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (no hooks found)"
    FAILED=$((FAILED + 1))
fi

# =====================================================================
# Test: PreToolUse hooks (dangerous command blocker)
# =====================================================================
echo ""
echo -e "${CYAN}Testing PreToolUse Hooks${NC}"
echo "----------------------------------------"

echo -n "  dangerous-command-blocker (safe cmd)... "
if run_ts_hook "pretool/bash/dangerous-command-blocker" "$(get_fixture pretool_bash_safe)" 0; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

echo -n "  compound-command-validator (safe cmd)... "
if run_ts_hook "pretool/bash/compound-command-validator" "$(get_fixture pretool_bash_safe)" 0; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

# =====================================================================
# Test: Permission hooks (auto-approve safe reads)
# =====================================================================
echo ""
echo -e "${CYAN}Testing Permission Hooks${NC}"
echo "----------------------------------------"

echo -n "  auto-approve-safe-bash (git status)... "
if run_ts_hook "permission/auto-approve-safe-bash" "$(get_fixture pretool_bash_safe)" 0; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

echo -n "  auto-approve-project-writes (Read)... "
if run_ts_hook "permission/auto-approve-project-writes" "$(get_fixture permission_read)" 0; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

# =====================================================================
# Test: PostToolUse hooks (error handler, budget monitor)
# =====================================================================
echo ""
echo -e "${CYAN}Testing PostToolUse Hooks${NC}"
echo "----------------------------------------"

echo -n "  unified-error-handler (success)... "
if run_ts_hook "posttool/unified-error-handler" "$(get_fixture posttool_success)" 0; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

echo -n "  unified-error-handler (success)... "
if run_ts_hook "posttool/unified-error-handler" "$(get_fixture posttool_success)" 0; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

# =====================================================================
# Test: Lifecycle hooks (session context loader)
# =====================================================================
echo ""
echo -e "${CYAN}Testing Lifecycle Hooks${NC}"
echo "----------------------------------------"

echo -n "  session-context-loader... "
if run_ts_hook "lifecycle/session-context-loader" '{"session_id":"test"}' 0; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

echo -n "  session-metrics-summary... "
if run_ts_hook "lifecycle/session-metrics-summary" '{"session_id":"test"}' 0; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "=========================================="
echo "  Results: $PASSED passed, $FAILED failed, $SKIPPED skipped"
echo "=========================================="

# CRITICAL: A test suite that runs zero tests is a failure
if [[ $PASSED -eq 0 && $FAILED -eq 0 ]]; then
    echo -e "${RED}FAILED: No tests ran — test suite is broken${NC}"
    exit 1
fi

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED: Some hook tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All hook tests passed${NC}"
    exit 0
fi
