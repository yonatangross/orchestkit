#!/bin/bash
# Integration tests for coordination hooks
# Tests that hooks work correctly with the coordination system
#
# CC 2.1.6 Requirement: All hooks must output valid JSON

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

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

# Cleanup function
cleanup() {
    rm -f "${PROJECT_ROOT}/.claude/.instance_env.test" 2>/dev/null || true
    rm -f /tmp/test-hook-output-*.txt 2>/dev/null || true
}
trap cleanup EXIT

# Test coordination-init.sh hook
test_coordination_init() {
    log_section "Test: coordination-init.sh"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export SESSION_ID="test-session-$$"

    local output=""
    output=$(bash "${PROJECT_ROOT}/hooks/lifecycle/coordination-init.sh" 2>/dev/null) || output=""

    if [[ -z "$output" ]]; then
        log_fail "Empty output"
        return
    fi

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Valid JSON output"
    else
        log_fail "Invalid JSON: $output"
        return
    fi

    local has_continue=""
    has_continue=$(echo "$output" | jq 'has("continue")' 2>/dev/null) || has_continue="false"
    if [[ "$has_continue" == "true" ]]; then
        log_pass "Has 'continue' field"
    else
        log_fail "Missing 'continue' field"
    fi

    local has_message=""
    has_message=$(echo "$output" | jq 'has("systemMessage") or has("suppressOutput")' 2>/dev/null) || has_message="false"
    if [[ "$has_message" == "true" ]]; then
        log_pass "Has 'systemMessage' or 'suppressOutput' field"
    else
        log_fail "Missing 'systemMessage' field"
    fi
}

# Test coordination-cleanup.sh hook
test_coordination_cleanup() {
    log_section "Test: coordination-cleanup.sh"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export SESSION_ID="test-session-$$"

    # Create fake instance env
    mkdir -p "${PROJECT_ROOT}/.claude" 2>/dev/null || true
    echo "CLAUDE_INSTANCE_ID=test-$$" > "${PROJECT_ROOT}/.claude/.instance_env"

    local output=""
    output=$(bash "${PROJECT_ROOT}/hooks/lifecycle/coordination-cleanup.sh" 2>/dev/null) || output=""

    # Cleanup
    rm -f "${PROJECT_ROOT}/.claude/.instance_env" 2>/dev/null || true

    if [[ -z "$output" ]]; then
        log_fail "Empty output"
        return
    fi

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Valid JSON output"
    else
        log_fail "Invalid JSON: $output"
        return
    fi

    local continue_val=""
    continue_val=$(echo "$output" | jq '.continue' 2>/dev/null) || continue_val=""
    if [[ "$continue_val" == "true" ]]; then
        log_pass "'continue' is true"
    else
        log_fail "'continue' is not true: $continue_val"
    fi
}

# Test file-lock-check.sh hook
test_file_lock_check() {
    log_section "Test: file-lock-check.sh"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT='{"file_path": "/tmp/test-lock-file.txt", "content": "test"}'

    local output=""
    output=$(bash "${PROJECT_ROOT}/hooks/pretool/write-edit/file-lock-check.sh" 2>/dev/null) || output=""

    if [[ -z "$output" ]]; then
        log_fail "Empty output"
        return
    fi

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Valid JSON output"
    else
        log_fail "Invalid JSON: $output"
        return
    fi

    local continue_val=""
    continue_val=$(echo "$output" | jq '.continue' 2>/dev/null) || continue_val=""
    if [[ "$continue_val" == "true" ]] || [[ "$continue_val" == "false" ]]; then
        log_pass "'continue' field is boolean"
    else
        log_fail "'continue' is not boolean: $continue_val"
    fi
}

# Test file-lock-release.sh hook
test_file_lock_release() {
    log_section "Test: file-lock-release.sh"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT='{"file_path": "/tmp/test-lock-file.txt"}'
    export TOOL_ERROR=""

    local output=""
    output=$(bash "${PROJECT_ROOT}/hooks/posttool/write-edit/file-lock-release.sh" 2>/dev/null) || output=""

    if [[ -z "$output" ]]; then
        log_fail "Empty output"
        return
    fi

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Valid JSON output"
    else
        log_fail "Invalid JSON: $output"
        return
    fi

    local continue_val=""
    continue_val=$(echo "$output" | jq '.continue' 2>/dev/null) || continue_val=""
    if [[ "$continue_val" == "true" ]]; then
        log_pass "'continue' is true"
    else
        log_fail "'continue' is not true: $continue_val"
    fi
}

# Test coordination-heartbeat.sh hook
test_coordination_heartbeat() {
    log_section "Test: coordination-heartbeat.sh"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Read"

    local output=""
    output=$(bash "${PROJECT_ROOT}/hooks/posttool/coordination-heartbeat.sh" 2>/dev/null) || output=""

    if [[ -z "$output" ]]; then
        log_fail "Empty output"
        return
    fi

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Valid JSON output"
    else
        log_fail "Invalid JSON: $output"
    fi
}

# Test hooks with coordination.sh unavailable
test_hooks_without_coordination() {
    log_section "Test: Hooks without coordination.sh"

    local coord_lib="${PROJECT_ROOT}/.claude/coordination/lib/coordination.sh"
    local coord_backup="${coord_lib}.backup.$$"

    # Temporarily rename coordination.sh
    if [[ -f "$coord_lib" ]]; then
        mv "$coord_lib" "$coord_backup"
    fi

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT='{"file_path": "/tmp/test.txt"}'

    # Test each hook
    local hooks=(
        "hooks/lifecycle/coordination-init.sh"
        "hooks/lifecycle/coordination-cleanup.sh"
        "hooks/posttool/coordination-heartbeat.sh"
        "hooks/pretool/write-edit/file-lock-check.sh"
    )

    for hook in "${hooks[@]}"; do
        local name=""
        name=$(basename "$hook")
        local output=""
        output=$(bash "${PROJECT_ROOT}/${hook}" 2>/dev/null) || output=""

        if [[ -z "$output" ]]; then
            log_fail "$name: Empty output without coordination.sh"
        elif echo "$output" | jq . >/dev/null 2>&1; then
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
    export TOOL_NAME="Write"
    export TOOL_INPUT='not-valid-json'

    local output=""
    output=$(bash "${PROJECT_ROOT}/hooks/pretool/write-edit/file-lock-check.sh" 2>/dev/null) || output=""

    if [[ -z "$output" ]]; then
        log_fail "Empty output with malformed input"
        return
    fi

    if echo "$output" | jq . >/dev/null 2>&1; then
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
    test_file_lock_check
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