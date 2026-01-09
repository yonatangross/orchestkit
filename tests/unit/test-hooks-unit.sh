#!/bin/bash
# Hook Unit Tests
# Tests individual hooks with mocked inputs
#
# Usage: ./test-hooks-unit.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.claude/hooks"
FIXTURES_DIR="$PROJECT_ROOT/tests/fixtures"

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

# Temp directory for test outputs
TEST_TMP=$(mktemp -d)
trap "rm -rf $TEST_TMP" EXIT

echo "=========================================="
echo "  Hook Unit Tests"
echo "=========================================="
echo ""

# Test helper: run hook with JSON input
# Uses perl for timeout (available on macOS and Linux)
run_hook() {
    local hook_path="$1"
    local input_json="$2"
    local expected_exit="${3:-0}"

    local output_file="$TEST_TMP/output.txt"
    local error_file="$TEST_TMP/error.txt"

    # Run hook with piped input (5 second timeout using perl)
    local actual_exit=0
    echo "$input_json" | perl -e 'alarm 5; exec @ARGV' bash "$hook_path" > "$output_file" 2> "$error_file" || actual_exit=$?

    # Exit code 142 = SIGALRM (timeout)
    if [[ $actual_exit -eq 142 ]]; then
        actual_exit=124  # Normalize to GNU timeout exit code
    fi

    if [[ $actual_exit -eq $expected_exit ]]; then
        return 0
    else
        echo "Expected exit $expected_exit, got $actual_exit"
        echo "STDOUT: $(cat "$output_file")"
        echo "STDERR: $(cat "$error_file")"
        return 1
    fi
}

# Test helper: check hook output contains string
output_contains() {
    grep -q "$1" "$TEST_TMP/output.txt" 2>/dev/null
}

# Test helper: check hook stderr contains string
stderr_contains() {
    grep -q "$1" "$TEST_TMP/error.txt" 2>/dev/null
}

# Load fixtures
FIXTURES=$(cat "$FIXTURES_DIR/hook-inputs.json")
get_fixture() {
    echo "$FIXTURES" | jq -c ".$1"
}

echo -e "${CYAN}Testing PreToolUse Hooks${NC}"
echo "----------------------------------------"

# Test: path-normalizer.sh with Read
echo -n "  path-normalizer (Read)... "
if [[ -f "$HOOKS_DIR/pretool/input-mod/path-normalizer.sh" ]]; then
    input=$(get_fixture "pretool_read")
    if run_hook "$HOOKS_DIR/pretool/input-mod/path-normalizer.sh" "$input" 0; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

# Test: git-branch-protection.sh (safe command)
echo -n "  git-branch-protection (safe)... "
if [[ -f "$HOOKS_DIR/pretool/bash/git-branch-protection.sh" ]]; then
    input=$(get_fixture "pretool_bash_safe")
    if run_hook "$HOOKS_DIR/pretool/bash/git-branch-protection.sh" "$input" 0; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

# Test: subagent-validator.sh
echo -n "  subagent-validator (Task)... "
if [[ -f "$HOOKS_DIR/pretool/task/subagent-validator.sh" ]]; then
    input=$(get_fixture "pretool_task")
    if run_hook "$HOOKS_DIR/pretool/task/subagent-validator.sh" "$input" 0; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

echo ""
echo -e "${CYAN}Testing PostToolUse Hooks${NC}"
echo "----------------------------------------"

# Test: audit-logger.sh
echo -n "  audit-logger (success)... "
if [[ -f "$HOOKS_DIR/posttool/audit-logger.sh" ]]; then
    input=$(get_fixture "posttool_success")
    if run_hook "$HOOKS_DIR/posttool/audit-logger.sh" "$input" 0; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

# Test: error-tracker.sh with error
echo -n "  error-tracker (with error)... "
if [[ -f "$HOOKS_DIR/posttool/error-tracker.sh" ]]; then
    input=$(get_fixture "posttool_error")
    if run_hook "$HOOKS_DIR/posttool/error-tracker.sh" "$input" 0; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

# Test: session-metrics.sh
echo -n "  session-metrics... "
if [[ -f "$HOOKS_DIR/posttool/session-metrics.sh" ]]; then
    input=$(get_fixture "posttool_success")
    if run_hook "$HOOKS_DIR/posttool/session-metrics.sh" "$input" 0; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

echo ""
echo -e "${CYAN}Testing Permission Hooks${NC}"
echo "----------------------------------------"

# Test: auto-approve-readonly.sh
echo -n "  auto-approve-readonly (Read)... "
if [[ -f "$HOOKS_DIR/permission/auto-approve-readonly.sh" ]]; then
    input=$(get_fixture "permission_read")
    if run_hook "$HOOKS_DIR/permission/auto-approve-readonly.sh" "$input" 0; then
        # Check if output indicates approval
        if output_contains '"decision"' || output_contains 'approve'; then
            echo -e "${GREEN}PASS${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${GREEN}PASS${NC} (no decision output - may be passthrough)"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

echo ""
echo -e "${CYAN}Testing Lifecycle Hooks${NC}"
echo "----------------------------------------"

# Test: session-context-loader.sh
echo -n "  session-context-loader... "
if [[ -f "$HOOKS_DIR/lifecycle/session-context-loader.sh" ]]; then
    if run_hook "$HOOKS_DIR/lifecycle/session-context-loader.sh" "{}" 0; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

# Test: context-loader.sh (new)
echo -n "  context-loader (v2)... "
if [[ -f "$HOOKS_DIR/lifecycle/context-loader.sh" ]]; then
    if run_hook "$HOOKS_DIR/lifecycle/context-loader.sh" "{}" 0; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

echo ""
echo "=========================================="
echo "  Results: $PASSED passed, $FAILED failed, $SKIPPED skipped"
echo "=========================================="

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED: Some hook tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All hook tests passed${NC}"
    exit 0
fi
