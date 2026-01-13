#!/bin/bash
# Unit tests for hook JSON output compliance
# Verifies all hooks output valid JSON in all code paths
#
# CC 2.1.6 Requirement: Hooks must always output valid JSON to stdout
# The T.replaceAll error occurs when hooks output undefined/null/empty

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Test result tracking
declare -a FAILED_TESTS=()

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
    FAILED_TESTS+=("$1")
}

log_skip() {
    echo -e "${YELLOW}⊘${NC} $1 (skipped)"
    ((TESTS_SKIPPED++))
}

log_section() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════════════"
}

# Test that a hook script outputs valid JSON
test_hook_json_output() {
    local hook_path="$1"
    local hook_name=$(basename "$hook_path")
    local hook_dir=$(dirname "$hook_path")

    # Skip non-executable or non-bash files
    if [[ ! -x "$hook_path" ]]; then
        log_skip "$hook_name: Not executable"
        return 0
    fi

    # Set up minimal environment for hook execution
    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT='{"file_path": "/tmp/test.txt", "content": "test"}'
    export TOOL_ERROR=""
    export SESSION_ID="test-session-$(date +%s)"

    # Create temporary instance env
    mkdir -p "${PROJECT_ROOT}/.claude"
    echo "CLAUDE_INSTANCE_ID=test-instance-$$" > "${PROJECT_ROOT}/.claude/.instance_env.test"

    # Run hook and capture output
    local output
    local exit_code=0

    # Run with timeout to prevent hanging
    output=$(timeout 5s bash "$hook_path" 2>/dev/null) || exit_code=$?

    # Clean up
    rm -f "${PROJECT_ROOT}/.claude/.instance_env.test"

    # Check if output is valid JSON
    if [[ -z "$output" ]]; then
        log_fail "$hook_name: Empty output (would cause T.replaceAll error)"
        return 1
    fi

    if echo "$output" | jq . >/dev/null 2>&1; then
        # Check for required fields
        local has_continue=$(echo "$output" | jq 'has("continue")' 2>/dev/null)
        if [[ "$has_continue" == "true" ]]; then
            log_pass "$hook_name: Valid JSON with 'continue' field"
            return 0
        else
            log_fail "$hook_name: Valid JSON but missing 'continue' field"
            return 1
        fi
    else
        log_fail "$hook_name: Invalid JSON output: $output"
        return 1
    fi
}

# Test hook with coordination.sh unavailable
test_hook_without_coordination() {
    local hook_path="$1"
    local hook_name=$(basename "$hook_path")

    if [[ ! -x "$hook_path" ]]; then
        return 0
    fi

    # Temporarily rename coordination.sh to simulate unavailability
    local coord_lib="${PROJECT_ROOT}/.claude/coordination/lib/coordination.sh"
    local coord_backup="${coord_lib}.backup"

    if [[ -f "$coord_lib" ]]; then
        mv "$coord_lib" "$coord_backup"
    fi

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT='{"file_path": "/tmp/test.txt"}'

    local output
    output=$(timeout 5s bash "$hook_path" 2>/dev/null) || true

    # Restore coordination.sh
    if [[ -f "$coord_backup" ]]; then
        mv "$coord_backup" "$coord_lib"
    fi

    if [[ -z "$output" ]]; then
        log_fail "$hook_name (no coord): Empty output when coordination unavailable"
        return 1
    fi

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "$hook_name (no coord): Graceful fallback with valid JSON"
        return 0
    else
        log_fail "$hook_name (no coord): Invalid JSON: $output"
        return 1
    fi
}

# Test hook with empty/invalid TOOL_INPUT
test_hook_empty_input() {
    local hook_path="$1"
    local hook_name=$(basename "$hook_path")

    if [[ ! -x "$hook_path" ]]; then
        return 0
    fi

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export TOOL_NAME="Write"
    export TOOL_INPUT=""

    local output
    output=$(timeout 5s bash "$hook_path" 2>/dev/null) || true

    if [[ -z "$output" ]]; then
        log_fail "$hook_name (empty input): Empty output"
        return 1
    fi

    if echo "$output" | jq . >/dev/null 2>&1; then
        log_pass "$hook_name (empty input): Valid JSON"
        return 0
    else
        log_fail "$hook_name (empty input): Invalid JSON: $output"
        return 1
    fi
}

# Test that trap ensures JSON output on early exit
test_hook_trap_on_exit() {
    local hook_path="$1"
    local hook_name=$(basename "$hook_path")

    # Check if hook has trap statement
    if grep -q "trap.*EXIT" "$hook_path" 2>/dev/null; then
        log_pass "$hook_name: Has EXIT trap for safety"
        return 0
    else
        log_fail "$hook_name: Missing EXIT trap (unsafe)"
        return 1
    fi
}

# Main test execution
main() {
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          Hook JSON Output Compliance Tests                    ║"
    echo "║          CC 2.1.6 T.replaceAll Prevention                     ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"

    # Hooks that were fixed (P0 + P1)
    local FIXED_HOOKS=(
        "hooks/posttool/coordination-heartbeat.sh"
        "hooks/posttool/write-edit/file-lock-release.sh"
        "hooks/lifecycle/instance-heartbeat.sh"
        "hooks/stop/cleanup-instance.sh"
        "hooks/lifecycle/coordination-init.sh"
        "hooks/lifecycle/coordination-cleanup.sh"
        "hooks/pretool/write-edit/file-lock-check.sh"
    )

    log_section "Test 1: EXIT Trap Presence"
    for hook in "${FIXED_HOOKS[@]}"; do
        local full_path="${PROJECT_ROOT}/${hook}"
        if [[ -f "$full_path" ]]; then
            test_hook_trap_on_exit "$full_path"
        else
            log_skip "$hook: File not found"
        fi
    done

    log_section "Test 2: Valid JSON Output (Normal Execution)"
    for hook in "${FIXED_HOOKS[@]}"; do
        local full_path="${PROJECT_ROOT}/${hook}"
        if [[ -f "$full_path" ]]; then
            test_hook_json_output "$full_path"
        fi
    done

    log_section "Test 3: Graceful Fallback (Coordination Unavailable)"
    for hook in "${FIXED_HOOKS[@]}"; do
        local full_path="${PROJECT_ROOT}/${hook}"
        if [[ -f "$full_path" ]]; then
            test_hook_without_coordination "$full_path"
        fi
    done

    log_section "Test 4: Empty Input Handling"
    for hook in "${FIXED_HOOKS[@]}"; do
        local full_path="${PROJECT_ROOT}/${hook}"
        if [[ -f "$full_path" ]]; then
            test_hook_empty_input "$full_path"
        fi
    done

    # Summary
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "                        TEST SUMMARY"
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "  Passed:  ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "  Failed:  ${RED}${TESTS_FAILED}${NC}"
    echo -e "  Skipped: ${YELLOW}${TESTS_SKIPPED}${NC}"
    echo ""

    if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
        echo "Failed tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "  ${RED}✗${NC} $test"
        done
        echo ""
    fi

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}FAIL${NC}: Some tests failed"
        exit 1
    else
        echo -e "${GREEN}PASS${NC}: All tests passed"
        exit 0
    fi
}

main "$@"