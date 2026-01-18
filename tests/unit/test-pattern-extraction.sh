#!/usr/bin/env bash
# test-pattern-extraction.sh - Unit tests for automatic pattern extraction system
# Tests hooks: pattern-extractor.sh, antipattern-warning.sh, session-patterns.sh
# Part of #48 (Cross-Project Patterns) and #49 (Best Practice Library)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Setup test environment
setup() {
    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export CLAUDE_PLUGIN_ROOT="$PROJECT_ROOT"
    TEST_PATTERNS_QUEUE=$(mktemp)
    TEST_PATTERNS_FILE=$(mktemp)
    echo '{"patterns": []}' > "$TEST_PATTERNS_QUEUE"
}

# Cleanup
cleanup() {
    rm -f "$TEST_PATTERNS_QUEUE" "$TEST_PATTERNS_FILE" 2>/dev/null || true
}

trap cleanup EXIT

# Test helper
assert_equals() {
    local expected="$1"
    local actual="$2"
    local test_name="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$expected" == "$actual" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: $expected"
        echo "  Actual:   $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local test_name="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$haystack" == *"$needle"* ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected to contain: $needle"
        echo "  Actual: $haystack"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

assert_not_empty() {
    local value="$1"
    local test_name="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -n "$value" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Value was empty"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# =============================================================================
# PATTERN EXTRACTOR TESTS
# =============================================================================

echo ""
echo "=========================================="
echo "Pattern Extractor Tests"
echo "=========================================="

test_pattern_extractor_syntax() {
    local result
    result=$(bash -n "$PROJECT_ROOT/hooks/posttool/bash/pattern-extractor.sh" 2>&1 && echo "OK")
    assert_contains "$result" "OK" "pattern-extractor.sh has valid bash syntax"
}

test_pattern_extractor_commit_extraction() {
    local input='{"tool_input": {"command": "git commit -m \"feat: Add JWT authentication\""}, "tool_result": {"exit_code": "0"}}'
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/posttool/bash/pattern-extractor.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Pattern extractor returns valid JSON for commit"
}

test_pattern_extractor_test_extraction() {
    local input='{"tool_input": {"command": "pytest tests/"}, "tool_result": {"exit_code": "0"}}'
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/posttool/bash/pattern-extractor.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Pattern extractor handles test commands"
}

test_pattern_extractor_failed_test() {
    local input='{"tool_input": {"command": "pytest tests/"}, "tool_result": {"exit_code": "1"}}'
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/posttool/bash/pattern-extractor.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Pattern extractor handles failed tests"
}

test_pattern_extractor_build_extraction() {
    local input='{"tool_input": {"command": "npm run build"}, "tool_result": {"exit_code": "0"}}'
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/posttool/bash/pattern-extractor.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Pattern extractor handles build commands"
}

test_pattern_extractor_pr_merge() {
    local input='{"tool_input": {"command": "gh pr merge 123"}, "tool_result": {"exit_code": "0"}}'
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/posttool/bash/pattern-extractor.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Pattern extractor handles PR merge"
}

test_pattern_extractor_empty_input() {
    local output
    output=$(echo "" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/posttool/bash/pattern-extractor.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Pattern extractor handles empty input gracefully"
}

# =============================================================================
# ANTIPATTERN WARNING TESTS
# =============================================================================

echo ""
echo "=========================================="
echo "Antipattern Warning Tests"
echo "=========================================="

test_antipattern_syntax() {
    local result
    result=$(bash -n "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" 2>&1 && echo "OK")
    assert_contains "$result" "OK" "antipattern-warning.sh has valid bash syntax"
}

test_antipattern_offset_pagination() {
    local output
    output=$(echo "implement offset pagination for users" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" 2>/dev/null)
    assert_contains "$output" "additionalContext" "Detects offset pagination anti-pattern"
    assert_contains "$output" "cursor-based" "Suggests cursor-based alternative"
}

test_antipattern_n1_query() {
    local output
    output=$(echo "build a loop with n+1 query" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" 2>/dev/null)
    assert_contains "$output" "additionalContext" "Detects N+1 query anti-pattern"
}

test_antipattern_polling() {
    local output
    output=$(echo "implement polling for real-time updates" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" 2>/dev/null)
    assert_contains "$output" "additionalContext" "Detects polling anti-pattern"
}

test_antipattern_global_state() {
    local output
    output=$(echo "add global state for user session" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" 2>/dev/null)
    assert_contains "$output" "additionalContext" "Detects global state anti-pattern"
}

test_antipattern_safe_prompt() {
    local output
    output=$(echo "what time is it" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" 2>/dev/null)
    assert_contains "$output" '"suppressOutput": true' "Safe prompts pass through silently"
}

test_antipattern_non_implementation() {
    local output
    output=$(echo "explain how pagination works" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" 2>/dev/null)
    assert_contains "$output" '"suppressOutput": true' "Non-implementation prompts pass silently"
}

# =============================================================================
# SESSION PATTERNS TESTS
# =============================================================================

echo ""
echo "=========================================="
echo "Session Patterns Tests"
echo "=========================================="

test_session_patterns_syntax() {
    local result
    result=$(bash -n "$PROJECT_ROOT/hooks/stop/session-patterns.sh" 2>&1 && echo "OK")
    assert_contains "$result" "OK" "session-patterns.sh has valid bash syntax"
}

test_session_patterns_empty_queue() {
    local output
    output=$(CLAUDE_PROJECT_DIR="$PROJECT_ROOT" "$PROJECT_ROOT/hooks/stop/session-patterns.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Session patterns handles empty queue"
}

# =============================================================================
# BASH 3.2 COMPATIBILITY TESTS
# =============================================================================

echo ""
echo "=========================================="
echo "Bash 3.2 Compatibility Tests"
echo "=========================================="

test_no_declare_A() {
    local count
    # Disable errexit for this check (grep returns 1 if no matches)
    set +e
    count=$(grep -l "declare -A" "$PROJECT_ROOT/hooks/posttool/bash/pattern-extractor.sh" "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" "$PROJECT_ROOT/hooks/stop/session-patterns.sh" 2>/dev/null | wc -l | tr -d ' ')
    set -e
    [[ -z "$count" ]] && count="0"
    assert_equals "0" "$count" "No declare -A (associative arrays) in hooks"
}

test_no_declare_g() {
    local count
    set +e
    count=$(grep -l "declare -g" "$PROJECT_ROOT/hooks/posttool/bash/pattern-extractor.sh" "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" "$PROJECT_ROOT/hooks/stop/session-patterns.sh" 2>/dev/null | wc -l | tr -d ' ')
    set -e
    [[ -z "$count" ]] && count="0"
    assert_equals "0" "$count" "No declare -g (global) in hooks"
}

test_no_readarray() {
    local count
    set +e
    count=$(grep -lE "readarray|mapfile" "$PROJECT_ROOT/hooks/posttool/bash/pattern-extractor.sh" "$PROJECT_ROOT/hooks/prompt/antipattern-warning.sh" "$PROJECT_ROOT/hooks/stop/session-patterns.sh" 2>/dev/null | wc -l | tr -d ' ')
    set -e
    [[ -z "$count" ]] && count="0"
    assert_equals "0" "$count" "No readarray/mapfile in hooks"
}

# =============================================================================
# RUN ALL TESTS
# =============================================================================

setup

test_pattern_extractor_syntax
test_pattern_extractor_commit_extraction
test_pattern_extractor_test_extraction
test_pattern_extractor_failed_test
test_pattern_extractor_build_extraction
test_pattern_extractor_pr_merge
test_pattern_extractor_empty_input

test_antipattern_syntax
test_antipattern_offset_pagination
test_antipattern_n1_query
test_antipattern_polling
test_antipattern_global_state
test_antipattern_safe_prompt
test_antipattern_non_implementation

test_session_patterns_syntax
test_session_patterns_empty_queue

test_no_declare_A
test_no_declare_g
test_no_readarray

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total:  $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
    exit 1
fi

exit 0
