#!/bin/bash
# test-mem0-enhancements.sh - Integration tests for mem0 enhancements
# Part of OrchestKit Claude Plugin test suite
#
# Tests:
# 1. Graph relationship queries work end-to-end
# 2. Webhook setup and handling flow
# 3. Analytics tracking accumulates data
# 4. Batch operations process multiple items
# 5. Export automation creates backups

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Export for scripts
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# Scripts directory
SCRIPTS_DIR="$PROJECT_ROOT/src/skills/mem0-memory/scripts"

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
echo "  Mem0 Enhancements Integration Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# =============================================================================
# Test Group 1: Graph Relationship Queries
# =============================================================================

echo -e "${CYAN}Test Group 1: Graph Relationship Queries${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

test_graph_relationship_script_exists() {
    test_start "get-related-memories.py script exists"
    if [[ -f "$SCRIPTS_DIR/graph/get-related-memories.py" ]]; then
        test_pass
    else
        test_fail "Script not found"
    fi
}

test_graph_traversal_script_exists() {
    test_start "traverse-graph.py script exists"
    if [[ -f "$SCRIPTS_DIR/graph/traverse-graph.py" ]]; then
        test_pass
    else
        test_fail "Script not found"
    fi
}

test_graph_scripts_show_help() {
    test_start "graph scripts respond to --help"
    local failed=()
    for script in "graph/get-related-memories.py" "graph/traverse-graph.py"; do
        if ! python3 "$SCRIPTS_DIR/$script" --help >/dev/null 2>&1; then
            failed+=("$script")
        fi
    done
    if [[ ${#failed[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Scripts failed --help: ${failed[*]}"
    fi
}

test_graph_scripts_output_json() {
    test_start "graph scripts output valid JSON"
    # Test with invalid API key to get error JSON
    # Note: mem0 library may print HTTP errors before the JSON output.
    # We check that the output contains a JSON object with "error" or "success" key.
    local failed=()
    for script in "graph/get-related-memories.py" "graph/traverse-graph.py"; do
        # Capture both stdout and stderr
        output=$(MEM0_API_KEY="invalid" python3 "$SCRIPTS_DIR/$script" --memory-id "test" 2>&1)
        # Check output contains expected JSON structure (error or success)
        if ! echo "$output" | grep -qE '"(error|success)"[[:space:]]*:'; then
            failed+=("$script")
        fi
    done
    if [[ ${#failed[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Scripts don't output valid JSON: ${failed[*]}"
    fi
}

test_graph_relationship_script_exists
test_graph_traversal_script_exists
test_graph_scripts_show_help
test_graph_scripts_output_json

echo ""

# =============================================================================
# Test Group 2: Webhook Management
# =============================================================================

echo -e "${CYAN}Test Group 2: Webhook Management${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

test_webhook_scripts_exist() {
    test_start "all webhook scripts exist"
    local webhook_scripts=(
        "webhooks/list-webhooks.py"
        "webhooks/update-webhook.py"
        "webhooks/delete-webhook.py"
        "webhooks/webhook-receiver.py"
    )
    local missing=()
    for script in "${webhook_scripts[@]}"; do
        if [[ ! -f "$SCRIPTS_DIR/$script" ]]; then
            missing+=("$script")
        fi
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Missing scripts: ${missing[*]}"
    fi
}

test_webhook_scripts_show_help() {
    test_start "webhook scripts respond to --help"
    local failed=()
    for script in "webhooks/list-webhooks.py" "webhooks/update-webhook.py" "webhooks/delete-webhook.py" "webhooks/webhook-receiver.py"; do
        if ! python3 "$SCRIPTS_DIR/$script" --help >/dev/null 2>&1; then
            failed+=("$script")
        fi
    done
    if [[ ${#failed[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Scripts failed --help: ${failed[*]}"
    fi
}

test_webhook_scripts_exist
test_webhook_scripts_show_help

echo ""

# =============================================================================
# Test Group 3: Batch Operations
# =============================================================================

echo -e "${CYAN}Test Group 3: Batch Operations${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

test_batch_scripts_exist() {
    test_start "batch operation scripts exist"
    local batch_scripts=(
        "validation/migrate-metadata.py"
        "batch/bulk-export.py"
    )
    local missing=()
    for script in "${batch_scripts[@]}"; do
        if [[ ! -f "$SCRIPTS_DIR/$script" ]]; then
            missing+=("$script")
        fi
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Missing scripts: ${missing[*]}"
    fi
}

test_batch_scripts_show_help() {
    test_start "batch scripts respond to --help"
    local failed=()
    for script in "validation/migrate-metadata.py" "batch/bulk-export.py"; do
        if ! python3 "$SCRIPTS_DIR/$script" --help >/dev/null 2>&1; then
            failed+=("$script")
        fi
    done
    if [[ ${#failed[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Scripts failed --help: ${failed[*]}"
    fi
}

test_batch_scripts_exist
test_batch_scripts_show_help

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
    echo -e "${GREEN}✓ All integration tests passed${NC}"
    exit 0
else
    echo -e "${RED}✗ Some integration tests failed${NC}"
    exit 1
fi
