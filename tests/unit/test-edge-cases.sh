#!/bin/bash
# Edge case and error scenario tests
# Validates hooks handle unusual conditions gracefully

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

log_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "  ${RED}✗${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_section() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════"
}

# Test: Empty environment variables
test_empty_env_vars() {
    log_section "Test: Empty Environment Variables"

    # Clear all relevant env vars
    unset CLAUDE_PROJECT_DIR
    unset TOOL_NAME
    unset TOOL_INPUT
    unset SESSION_ID

    export CLAUDE_PROJECT_DIR=""

    local output=""
    output=$(bash "${PROJECT_ROOT}/.claude/hooks/posttool/coordination-heartbeat.sh" 2>/dev/null) || output=""

    if [[ -z "$output" ]]; then
        log_fail "Empty output with empty CLAUDE_PROJECT_DIR"
    elif echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Handles empty CLAUDE_PROJECT_DIR gracefully"
    else
        log_fail "Invalid JSON with empty env: $output"
    fi

    # Restore
    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
}

# Test: Missing .claude directory
test_missing_claude_dir() {
    log_section "Test: Missing .claude Directory"

    export CLAUDE_PROJECT_DIR="/tmp/nonexistent-project-$$"

    local output=""
    output=$(bash "${PROJECT_ROOT}/.claude/hooks/lifecycle/coordination-init.sh" 2>/dev/null) || output=""

    if [[ -z "$output" ]]; then
        log_fail "Empty output with missing .claude dir"
    elif echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Handles missing .claude directory gracefully"
    else
        log_fail "Invalid JSON with missing dir: $output"
    fi

    # Restore
    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
}

# Test: Special characters in file paths
test_special_chars_in_paths() {
    log_section "Test: Special Characters in Paths"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT='{"file_path": "/tmp/test file with spaces & special!chars.txt"}'

    local output=""
    output=$(bash "${PROJECT_ROOT}/.claude/hooks/pretool/write-edit/file-lock-check.sh" 2>/dev/null) || output=""

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Handles special characters in file paths"
    else
        log_fail "Invalid JSON with special chars: $output"
    fi
}

# Test: Unicode in tool input
test_unicode_input() {
    log_section "Test: Unicode in Tool Input"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT='{"file_path": "/tmp/测试文件.txt", "content": "日本語テスト"}'

    local output=""
    output=$(bash "${PROJECT_ROOT}/.claude/hooks/pretool/write-edit/file-lock-check.sh" 2>/dev/null) || output=""

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Handles Unicode in tool input"
    else
        log_fail "Invalid JSON with Unicode: $output"
    fi
}

# Test: Very long file path
test_long_path() {
    log_section "Test: Very Long File Path"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"

    # Create a very long path (>300 chars)
    local long_path="/tmp"
    for i in {1..50}; do
        long_path="${long_path}/subdir"
    done
    long_path="${long_path}/file.txt"

    export TOOL_INPUT="{\"file_path\": \"$long_path\"}"

    local output=""
    output=$(bash "${PROJECT_ROOT}/.claude/hooks/pretool/write-edit/file-lock-check.sh" 2>/dev/null) || output=""

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Handles very long file paths"
    else
        log_fail "Invalid JSON with long path: $output"
    fi
}

# Test: Null bytes in input
test_null_bytes() {
    log_section "Test: Null Bytes in Input"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT=$'{"file_path": "/tmp/test\x00file.txt"}'

    local output=""
    output=$(bash "${PROJECT_ROOT}/.claude/hooks/pretool/write-edit/file-lock-check.sh" 2>/dev/null) || output=""

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Handles null bytes in input"
    else
        # It's acceptable to fail on null bytes as long as we get valid JSON
        if [[ -n "$output" ]] && echo "$output" | jq . >/dev/null 2>&1; then
            log_pass "Handles null bytes in input (alternate)"
        else
            log_fail "Invalid JSON with null bytes: $output"
        fi
    fi
}

# Test: Concurrent hook execution
test_concurrent_execution() {
    log_section "Test: Concurrent Hook Execution"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Read"

    # Run 5 instances in parallel
    local pids=()
    for i in {1..5}; do
        bash "${PROJECT_ROOT}/.claude/hooks/posttool/coordination-heartbeat.sh" > "/tmp/hook-output-$i.txt" 2>&1 &
        pids+=($!)
    done

    # Wait for all
    local all_passed=true
    for pid in "${pids[@]}"; do
        wait $pid
    done

    # Check all outputs
    for i in {1..5}; do
        local output=""
        output=$(cat "/tmp/hook-output-$i.txt" 2>/dev/null)
        if ! echo "$output" | jq . >/dev/null 2>&1; then
            all_passed=false
        fi
        rm -f "/tmp/hook-output-$i.txt"
    done

    if $all_passed; then
        log_pass "Handles concurrent execution"
    else
        log_fail "Failed on concurrent execution"
    fi
}

# Test: Empty JSON object input
test_empty_json_input() {
    log_section "Test: Empty JSON Object Input"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT='{}'

    local output=""
    output=$(bash "${PROJECT_ROOT}/.claude/hooks/pretool/write-edit/file-lock-check.sh" 2>/dev/null) || output=""

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Handles empty JSON object input"
    else
        log_fail "Invalid JSON with empty object: $output"
    fi
}

# Test: JSON array input (unexpected type)
test_json_array_input() {
    log_section "Test: JSON Array Input"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT='["/tmp/file1.txt", "/tmp/file2.txt"]'

    local output=""
    output=$(bash "${PROJECT_ROOT}/.claude/hooks/pretool/write-edit/file-lock-check.sh" 2>/dev/null) || output=""

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "Handles JSON array input"
    else
        log_fail "Invalid JSON with array input: $output"
    fi
}

# Test: Count scripts with empty directories
test_count_empty_dirs() {
    log_section "Test: Count Scripts Edge Cases"

    # Test with --json flag
    local json_output=""
    json_output=$("${PROJECT_ROOT}/bin/count-components.sh" --json 2>/dev/null) || json_output=""

    if echo "$json_output" | jq '.skills' >/dev/null 2>&1; then
        log_pass "count-components.sh --json returns valid JSON"
    else
        log_fail "count-components.sh --json invalid: $json_output"
    fi

    # Test validate with current state
    local validate_exit=0
    "${PROJECT_ROOT}/bin/validate-counts.sh" >/dev/null 2>&1 || validate_exit=$?

    if [[ $validate_exit -eq 0 ]]; then
        log_pass "validate-counts.sh passes"
    else
        log_fail "validate-counts.sh failed with exit code $validate_exit"
    fi
}

# Main
main() {
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          Edge Cases and Error Scenarios Tests                 ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"

    test_empty_env_vars
    test_missing_claude_dir
    test_special_chars_in_paths
    test_unicode_input
    test_long_path
    test_null_bytes
    test_concurrent_execution
    test_empty_json_input
    test_json_array_input
    test_count_empty_dirs

    # Summary
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "                        TEST SUMMARY"
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "  Passed:  ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "  Failed:  ${RED}${TESTS_FAILED}${NC}"
    echo ""

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}FAIL${NC}: Some tests failed"
        exit 1
    else
        echo -e "${GREEN}PASS${NC}: All tests passed"
        exit 0
    fi
}

main "$@"