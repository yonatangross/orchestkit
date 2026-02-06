#!/bin/bash
# Integration tests for coordination hooks
# Tests that hooks work correctly with the coordination system
#
# CC 2.1.6 Requirement: All hooks must output valid JSON
# Phase 4: Updated for TypeScript hooks with run-hook.mjs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HOOK_RUNNER="${PROJECT_ROOT}/src/hooks/bin/run-hook.mjs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

log_section() {
    echo ""
    echo -e "${CYAN}$1${NC}"
    echo "----------------------------------------"
}

log_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "  ${RED}✗${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# Run TypeScript hook via run-hook.mjs
run_hook() {
    local handler="$1"
    local input="$2"
    echo "$input" | node "$HOOK_RUNNER" "$handler" 2>/dev/null || echo ""
}

# Cleanup function
cleanup() {
    rm -f "${PROJECT_ROOT}/.claude/.instance_env.test" 2>/dev/null || true
    rm -f /tmp/test-hook-output-*.txt 2>/dev/null || true
}
trap cleanup EXIT

# Test coordination-init hook (TypeScript)
test_coordination_init() {
    log_section "Test: coordination-init (TypeScript)"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export SESSION_ID="test-session-$$"

    local input='{"session_id":"test-session-123"}'
    local output
    output=$(run_hook "lifecycle/coordination-init" "$input")

    if [[ -z "$output" ]]; then
        log_fail "Empty output"
        return
    fi

    # Extract JSON from output (may have multiple lines)
    local json_line
    json_line=$(echo "$output" | grep -E '^\{.*\}$' | tail -1)

    if [[ -z "$json_line" ]]; then
        log_fail "No JSON found in output: $output"
        return
    fi

    if echo "$json_line" | jq . >/dev/null 2>&1; then
        log_pass "Valid JSON output"
    else
        log_fail "Invalid JSON: $json_line"
        return
    fi

    local has_continue=""
    has_continue=$(echo "$json_line" | jq 'has("continue")' 2>/dev/null) || has_continue="false"
    if [[ "$has_continue" == "true" ]]; then
        log_pass "Has 'continue' field"
    else
        log_fail "Missing 'continue' field"
    fi

    local has_message=""
    has_message=$(echo "$json_line" | jq 'has("systemMessage") or has("suppressOutput")' 2>/dev/null) || has_message="false"
    if [[ "$has_message" == "true" ]]; then
        log_pass "Has 'systemMessage' or 'suppressOutput' field"
    else
        log_fail "Missing 'systemMessage' field"
    fi
}

# Test coordination-cleanup hook (TypeScript)
test_coordination_cleanup() {
    log_section "Test: coordination-cleanup (TypeScript)"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export SESSION_ID="test-session-$$"

    # Create fake instance env
    mkdir -p "${PROJECT_ROOT}/.claude" 2>/dev/null || true
    echo "CLAUDE_INSTANCE_ID=test-$$" > "${PROJECT_ROOT}/.claude/.instance_env"

    local input='{"session_id":"test-session-123"}'
    local output
    output=$(run_hook "lifecycle/coordination-cleanup" "$input")

    # Cleanup
    rm -f "${PROJECT_ROOT}/.claude/.instance_env" 2>/dev/null || true

    if [[ -z "$output" ]]; then
        log_fail "Empty output"
        return
    fi

    # Extract JSON from output
    local json_line
    json_line=$(echo "$output" | grep -E '^\{.*\}$' | tail -1)

    if [[ -z "$json_line" ]]; then
        log_fail "No JSON found in output: $output"
        return
    fi

    if echo "$json_line" | jq . >/dev/null 2>&1; then
        log_pass "Valid JSON output"
    else
        log_fail "Invalid JSON: $json_line"
        return
    fi

    local continue_val=""
    continue_val=$(echo "$json_line" | jq '.continue' 2>/dev/null) || continue_val=""
    if [[ "$continue_val" == "true" ]]; then
        log_pass "'continue' is true"
    else
        log_fail "'continue' is not true: $continue_val"
    fi
}

# Test file-lock-release hook (TypeScript)
test_file_lock_release() {
    log_section "Test: file-lock-release (TypeScript)"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"tool_input":{"file_path":"/tmp/test-lock-file.txt"},"session_id":"test-123"}'
    local output
    output=$(run_hook "posttool/write-edit/file-lock-release" "$input")

    if [[ -z "$output" ]]; then
        log_fail "Empty output"
        return
    fi

    # Extract JSON from output
    local json_line
    json_line=$(echo "$output" | grep -E '^\{.*\}$' | tail -1)

    if [[ -z "$json_line" ]]; then
        log_fail "No JSON found in output: $output"
        return
    fi

    if echo "$json_line" | jq . >/dev/null 2>&1; then
        log_pass "Valid JSON output"
    else
        log_fail "Invalid JSON: $json_line"
        return
    fi

    local continue_val=""
    continue_val=$(echo "$json_line" | jq '.continue' 2>/dev/null) || continue_val=""
    if [[ "$continue_val" == "true" ]]; then
        log_pass "'continue' is true"
    else
        log_fail "'continue' is not true: $continue_val"
    fi
}

# Test coordination-heartbeat hook (TypeScript)
test_coordination_heartbeat() {
    log_section "Test: coordination-heartbeat (TypeScript)"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"tool_input":{"command":"ls"},"session_id":"test-123"}'
    local output
    output=$(run_hook "posttool/coordination-heartbeat" "$input")

    if [[ -z "$output" ]]; then
        log_fail "Empty output"
        return
    fi

    # Extract JSON from output
    local json_line
    json_line=$(echo "$output" | grep -E '^\{.*\}$' | tail -1)

    if [[ -z "$json_line" ]]; then
        log_fail "No JSON found in output: $output"
        return
    fi

    if echo "$json_line" | jq . >/dev/null 2>&1; then
        log_pass "Valid JSON output"
    else
        log_fail "Invalid JSON: $json_line"
    fi
}

# Test hooks with coordination.sh unavailable (TypeScript hooks handle gracefully)
test_hooks_without_coordination() {
    log_section "Test: Hooks without coordination.sh"

    local coord_lib="${PROJECT_ROOT}/.claude/coordination/lib/coordination.sh"
    local coord_backup="${coord_lib}.backup.$$"

    # Temporarily rename coordination.sh
    if [[ -f "$coord_lib" ]]; then
        mv "$coord_lib" "$coord_backup"
    fi

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    # Test each hook - TypeScript hooks should handle missing coordination gracefully
    # Using parallel arrays instead of associative array to avoid bash arithmetic issues with slashes
    local handlers=(
        "lifecycle/coordination-init"
        "lifecycle/coordination-cleanup"
        "posttool/coordination-heartbeat"
    )
    local inputs=(
        '{"session_id":"test-123"}'
        '{"session_id":"test-123"}'
        '{"tool_input":{"command":"ls"},"session_id":"test-123"}'
    )

    for i in "${!handlers[@]}"; do
        local handler="${handlers[$i]}"
        local input="${inputs[$i]}"
        local name
        name=$(basename "$handler")
        local output
        output=$(run_hook "$handler" "$input")

        # Extract JSON from output
        local json_line
        json_line=$(echo "$output" | grep -E '^\{.*\}$' | tail -1)

        if [[ -z "$json_line" ]]; then
            log_fail "$name: Empty output without coordination.sh"
        elif echo "$json_line" | jq . >/dev/null 2>&1; then
            log_pass "$name: Graceful fallback"
        else
            log_fail "$name: Invalid fallback JSON: $output"
        fi
    done

    # Restore coordination.sh
    if [[ -f "$coord_backup" ]]; then
        mv "$coord_backup" "$coord_lib"
    fi
}

# Test hooks handle malformed input
test_hooks_malformed_input() {
    log_section "Test: Hooks with malformed input"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    # TypeScript hooks should handle malformed JSON gracefully
    local input='not-valid-json'
    local output
    output=$(run_hook "pretool/write-edit/multi-instance-lock" "$input")

    # Extract JSON from output (TypeScript hook should return error JSON)
    local json_line
    json_line=$(echo "$output" | grep -E '^\{.*\}$' | tail -1)

    if [[ -z "$json_line" ]]; then
        log_fail "Empty output with malformed input"
        return
    fi

    if echo "$json_line" | jq . >/dev/null 2>&1; then
        log_pass "Handles malformed input gracefully"
    else
        log_fail "Invalid JSON with malformed input: $output"
    fi
}

# Main
main() {
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          Coordination Hooks Integration Tests                 ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"

    test_coordination_init
    test_coordination_cleanup
    test_file_lock_release
    test_coordination_heartbeat
    test_hooks_without_coordination
    test_hooks_malformed_input

    # Summary
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
}

main "$@"