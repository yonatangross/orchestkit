#!/usr/bin/env bash
# test-issue-progress-tracking.sh - Unit tests for issue progress tracking hooks
# Tests hooks: issue-progress-commenter.sh, issue-subtask-updater.sh, issue-work-summary.sh
# Part of Issue Progress Tracking feature

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
    export CLAUDE_SESSION_ID="test-session-$(date +%s)"
    TEST_SESSION_DIR="/tmp/claude-session-${CLAUDE_SESSION_ID}"
    mkdir -p "$TEST_SESSION_DIR"
}

# Cleanup
cleanup() {
    rm -rf "$TEST_SESSION_DIR" 2>/dev/null || true
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

assert_file_exists() {
    local file_path="$1"
    local test_name="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -f "$file_path" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  File not found: $file_path"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# =============================================================================
# ISSUE PROGRESS COMMENTER TESTS
# =============================================================================

echo ""
echo "=========================================="
echo "Issue Progress Commenter Tests"
echo "=========================================="

test_progress_commenter_syntax() {
    local result
    result=$(bash -n "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh" 2>&1 && echo "OK")
    assert_contains "$result" "OK" "issue-progress-commenter.sh has valid bash syntax"
}

test_progress_commenter_executable() {
    TESTS_RUN=$((TESTS_RUN + 1))
    if [[ -x "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh" ]]; then
        echo -e "${GREEN}✓${NC} issue-progress-commenter.sh is executable"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} issue-progress-commenter.sh is not executable"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_progress_commenter_empty_input() {
    local output
    output=$(echo "" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" CLAUDE_SESSION_ID="test-123" "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Progress commenter handles empty input gracefully"
}

test_progress_commenter_non_commit() {
    local input='{"tool_input": {"command": "ls -la"}, "tool_result": {"exit_code": "0"}}'
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" CLAUDE_SESSION_ID="test-123" "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Progress commenter ignores non-commit commands"
}

test_progress_commenter_failed_commit() {
    local input='{"tool_input": {"command": "git commit -m \"test\""}, "tool_result": {"exit_code": "1"}}'
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" CLAUDE_SESSION_ID="test-123" "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Progress commenter ignores failed commits"
}

test_progress_commenter_json_output() {
    local input='{"tool_input": {"command": "git commit -m \"feat(#123): Add feature\""}, "tool_result": {"exit_code": "0"}}'
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" CLAUDE_SESSION_ID="test-123" "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh" 2>/dev/null)
    # Should always return valid JSON with continue: true
    assert_contains "$output" '"continue": true' "Progress commenter returns valid JSON"
    assert_contains "$output" '"suppressOutput": true' "Progress commenter suppresses output"
}

# =============================================================================
# ISSUE SUBTASK UPDATER TESTS
# =============================================================================

echo ""
echo "=========================================="
echo "Issue Subtask Updater Tests"
echo "=========================================="

test_subtask_updater_syntax() {
    local result
    result=$(bash -n "$PROJECT_ROOT/hooks/posttool/bash/issue-subtask-updater.sh" 2>&1 && echo "OK")
    assert_contains "$result" "OK" "issue-subtask-updater.sh has valid bash syntax"
}

test_subtask_updater_executable() {
    TESTS_RUN=$((TESTS_RUN + 1))
    if [[ -x "$PROJECT_ROOT/hooks/posttool/bash/issue-subtask-updater.sh" ]]; then
        echo -e "${GREEN}✓${NC} issue-subtask-updater.sh is executable"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} issue-subtask-updater.sh is not executable"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_subtask_updater_empty_input() {
    local output
    output=$(echo "" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" CLAUDE_SESSION_ID="test-123" "$PROJECT_ROOT/hooks/posttool/bash/issue-subtask-updater.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Subtask updater handles empty input gracefully"
}

test_subtask_updater_non_commit() {
    local input='{"tool_input": {"command": "npm test"}, "tool_result": {"exit_code": "0"}}'
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" CLAUDE_SESSION_ID="test-123" "$PROJECT_ROOT/hooks/posttool/bash/issue-subtask-updater.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Subtask updater ignores non-commit commands"
}

test_subtask_updater_json_output() {
    local input='{"tool_input": {"command": "git commit -m \"feat(#123): Add tests\""}, "tool_result": {"exit_code": "0"}}'
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="$PROJECT_ROOT" CLAUDE_SESSION_ID="test-123" "$PROJECT_ROOT/hooks/posttool/bash/issue-subtask-updater.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Subtask updater returns valid JSON"
    assert_contains "$output" '"suppressOutput": true' "Subtask updater suppresses output"
}

# =============================================================================
# ISSUE WORK SUMMARY TESTS
# =============================================================================

echo ""
echo "=========================================="
echo "Issue Work Summary Tests"
echo "=========================================="

test_work_summary_syntax() {
    local result
    result=$(bash -n "$PROJECT_ROOT/hooks/stop/issue-work-summary.sh" 2>&1 && echo "OK")
    assert_contains "$result" "OK" "issue-work-summary.sh has valid bash syntax"
}

test_work_summary_executable() {
    TESTS_RUN=$((TESTS_RUN + 1))
    if [[ -x "$PROJECT_ROOT/hooks/stop/issue-work-summary.sh" ]]; then
        echo -e "${GREEN}✓${NC} issue-work-summary.sh is executable"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} issue-work-summary.sh is not executable"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

test_work_summary_no_progress_file() {
    local output
    output=$(CLAUDE_PROJECT_DIR="$PROJECT_ROOT" CLAUDE_SESSION_ID="nonexistent-session" "$PROJECT_ROOT/hooks/stop/issue-work-summary.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Work summary handles missing progress file"
}

test_work_summary_json_output() {
    local output
    output=$(CLAUDE_PROJECT_DIR="$PROJECT_ROOT" CLAUDE_SESSION_ID="test-session" "$PROJECT_ROOT/hooks/stop/issue-work-summary.sh" 2>/dev/null)
    assert_contains "$output" '"continue": true' "Work summary returns valid JSON"
    assert_contains "$output" '"suppressOutput": true' "Work summary suppresses output"
}

# =============================================================================
# SKILL FILE TESTS
# =============================================================================

echo ""
echo "=========================================="
echo "Skill File Tests"
echo "=========================================="

test_skill_file_exists() {
    assert_file_exists "$PROJECT_ROOT/skills/issue-progress-tracking/SKILL.md" "issue-progress-tracking SKILL.md exists"
}

test_skill_has_frontmatter() {
    local content
    content=$(head -20 "$PROJECT_ROOT/skills/issue-progress-tracking/SKILL.md")
    assert_contains "$content" "name: issue-progress-tracking" "Skill has name in frontmatter"
    assert_contains "$content" "description:" "Skill has description in frontmatter"
    assert_contains "$content" "tags:" "Skill has tags in frontmatter"
}

# =============================================================================
# SECURITY TESTS
# =============================================================================

echo ""
echo "=========================================="
echo "Security Tests"
echo "=========================================="

test_session_id_sanitization() {
    # Verify hooks sanitize session ID to prevent path traversal
    local content
    content=$(cat "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh")
    assert_contains "$content" "SAFE_SESSION_ID" "issue-progress-commenter.sh sanitizes session ID"

    content=$(cat "$PROJECT_ROOT/hooks/posttool/bash/issue-subtask-updater.sh")
    assert_contains "$content" "SAFE_SESSION_ID" "issue-subtask-updater.sh sanitizes session ID"

    content=$(cat "$PROJECT_ROOT/hooks/stop/issue-work-summary.sh")
    assert_contains "$content" "SAFE_SESSION_ID" "issue-work-summary.sh sanitizes session ID"
}

test_path_traversal_blocked() {
    # Verify path traversal characters are stripped
    local content
    content=$(cat "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh")
    assert_contains "$content" '[^a-zA-Z0-9_-]' "Session ID sanitization strips special characters"
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
    set +e
    count=$(grep -l "declare -A" \
        "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh" \
        "$PROJECT_ROOT/hooks/posttool/bash/issue-subtask-updater.sh" \
        "$PROJECT_ROOT/hooks/stop/issue-work-summary.sh" \
        2>/dev/null | wc -l | tr -d ' ')
    set -e
    [[ -z "$count" ]] && count="0"
    assert_equals "0" "$count" "No declare -A (associative arrays) in hooks"
}

test_no_declare_g() {
    local count
    set +e
    count=$(grep -l "declare -g" \
        "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh" \
        "$PROJECT_ROOT/hooks/posttool/bash/issue-subtask-updater.sh" \
        "$PROJECT_ROOT/hooks/stop/issue-work-summary.sh" \
        2>/dev/null | wc -l | tr -d ' ')
    set -e
    [[ -z "$count" ]] && count="0"
    assert_equals "0" "$count" "No declare -g (global) in hooks"
}

test_no_readarray() {
    local count
    set +e
    count=$(grep -lE "readarray|mapfile" \
        "$PROJECT_ROOT/hooks/posttool/bash/issue-progress-commenter.sh" \
        "$PROJECT_ROOT/hooks/posttool/bash/issue-subtask-updater.sh" \
        "$PROJECT_ROOT/hooks/stop/issue-work-summary.sh" \
        2>/dev/null | wc -l | tr -d ' ')
    set -e
    [[ -z "$count" ]] && count="0"
    assert_equals "0" "$count" "No readarray/mapfile in hooks"
}

# =============================================================================
# PLUGIN.JSON REGISTRATION TESTS
# =============================================================================

echo ""
echo "=========================================="
echo "Plugin Registration Tests"
echo "=========================================="

test_hooks_registered_in_plugin_json() {
    local plugin_content
    plugin_content=$(cat "$PROJECT_ROOT/.claude-plugin/plugin.json")

    assert_contains "$plugin_content" "issue-progress-commenter.sh" "issue-progress-commenter.sh registered in plugin.json"
    assert_contains "$plugin_content" "issue-subtask-updater.sh" "issue-subtask-updater.sh registered in plugin.json"
    assert_contains "$plugin_content" "issue-work-summary.sh" "issue-work-summary.sh registered in plugin.json"
}

test_plugin_counts_updated() {
    local plugin_content
    plugin_content=$(cat "$PROJECT_ROOT/.claude-plugin/plugin.json")

    assert_contains "$plugin_content" "129 hooks" "Plugin description shows 129 hooks"
    assert_contains "$plugin_content" "135 skills" "Plugin description shows 135 skills"
}

# =============================================================================
# RUN ALL TESTS
# =============================================================================

setup

test_progress_commenter_syntax
test_progress_commenter_executable
test_progress_commenter_empty_input
test_progress_commenter_non_commit
test_progress_commenter_failed_commit
test_progress_commenter_json_output

test_subtask_updater_syntax
test_subtask_updater_executable
test_subtask_updater_empty_input
test_subtask_updater_non_commit
test_subtask_updater_json_output

test_work_summary_syntax
test_work_summary_executable
test_work_summary_no_progress_file
test_work_summary_json_output

test_skill_file_exists
test_skill_has_frontmatter

test_session_id_sanitization
test_path_traversal_blocked

test_no_declare_A
test_no_declare_g
test_no_readarray

test_hooks_registered_in_plugin_json
test_plugin_counts_updated

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
