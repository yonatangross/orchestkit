#!/bin/bash
# test-mem0-library.sh - Unit tests for mem0.sh library functions
# Part of OrchestKit Claude Plugin comprehensive test suite
# CC 2.1.7 Compliant
#
# Tests:
# - Project ID generation and sanitization
# - User ID scoping (decisions, continuity, agents, patterns, best-practices)
# - Context directory detection
# - Memory content validation
# - Best practice JSON building
# - Category detection

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Export for hooks
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# Source the library under test
source "$PROJECT_ROOT/hooks/_lib/mem0.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# =============================================================================
# Test Helper Functions
# =============================================================================

test_start() {
    local name="$1"
    echo -n "  ○ $name... "
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
    echo -e "\033[0;32mPASS\033[0m"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    local reason="${1:-}"
    echo -e "\033[0;31mFAIL\033[0m"
    [[ -n "$reason" ]] && echo "    └─ $reason"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# =============================================================================
# Test: Project ID Generation
# =============================================================================

test_project_id_simple() {
    test_start "project ID from simple name"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_get_project_id)

    if [[ "$result" == "my-project" ]]; then
        test_pass
    else
        test_fail "Expected 'my-project', got '$result'"
    fi
}

test_project_id_spaces() {
    test_start "project ID sanitizes spaces"

    CLAUDE_PROJECT_DIR="/Users/test/My Project Name"
    local result
    result=$(mem0_get_project_id)

    if [[ "$result" == "my-project-name" ]]; then
        test_pass
    else
        test_fail "Expected 'my-project-name', got '$result'"
    fi
}

test_project_id_special_chars() {
    test_start "project ID sanitizes special characters"

    CLAUDE_PROJECT_DIR="/Users/test/project@123!test"
    local result
    result=$(mem0_get_project_id)

    # Should replace special chars with dashes and collapse multiples
    if [[ "$result" =~ ^project-*123-*test$ ]] || [[ "$result" == "project-123-test" ]]; then
        test_pass
    else
        test_fail "Expected sanitized name, got '$result'"
    fi
}

test_project_id_uppercase() {
    test_start "project ID converts to lowercase"

    CLAUDE_PROJECT_DIR="/Users/test/MyProject"
    local result
    result=$(mem0_get_project_id)

    if [[ "$result" == "myproject" ]]; then
        test_pass
    else
        test_fail "Expected 'myproject', got '$result'"
    fi
}

test_project_id_fallback() {
    test_start "project ID fallback for empty"

    CLAUDE_PROJECT_DIR="/"
    local result
    result=$(mem0_get_project_id)

    # Should use fallback or sanitized root
    if [[ -n "$result" ]]; then
        test_pass
    else
        test_fail "Expected non-empty fallback"
    fi
}

# =============================================================================
# Test: User ID Scoping
# =============================================================================

test_user_id_decisions() {
    test_start "user ID for decisions scope"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_user_id "decisions")

    if [[ "$result" == "my-project-decisions" ]]; then
        test_pass
    else
        test_fail "Expected 'my-project-decisions', got '$result'"
    fi
}

test_user_id_continuity() {
    test_start "user ID for continuity scope"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_user_id "continuity")

    if [[ "$result" == "my-project-continuity" ]]; then
        test_pass
    else
        test_fail "Expected 'my-project-continuity', got '$result'"
    fi
}

test_user_id_agents() {
    test_start "user ID for agents scope"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_user_id "agents")

    if [[ "$result" == "my-project-agents" ]]; then
        test_pass
    else
        test_fail "Expected 'my-project-agents', got '$result'"
    fi
}

test_user_id_patterns() {
    test_start "user ID for patterns scope"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_user_id "patterns")

    if [[ "$result" == "my-project-patterns" ]]; then
        test_pass
    else
        test_fail "Expected 'my-project-patterns', got '$result'"
    fi
}

test_user_id_best_practices() {
    test_start "user ID for best-practices scope"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_user_id "best-practices")

    if [[ "$result" == "my-project-best-practices" ]]; then
        test_pass
    else
        test_fail "Expected 'my-project-best-practices', got '$result'"
    fi
}

test_user_id_invalid_scope() {
    test_start "user ID falls back for invalid scope"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_user_id "invalid-scope" 2>/dev/null)

    # Should fall back to continuity
    if [[ "$result" == "my-project-continuity" ]]; then
        test_pass
    else
        test_fail "Expected fallback to 'my-project-continuity', got '$result'"
    fi
}

test_user_id_default() {
    test_start "user ID uses default scope when none provided"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(mem0_user_id)

    if [[ "$result" == "my-project-continuity" ]]; then
        test_pass
    else
        test_fail "Expected 'my-project-continuity', got '$result'"
    fi
}

# =============================================================================
# Test: Context Directory Detection
# =============================================================================

test_has_context_dir_exists() {
    test_start "has_context_dir returns true when exists"

    # Use the actual project which has .claude/context/
    CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    if has_context_dir; then
        test_pass
    else
        test_fail "Expected true for existing context dir"
    fi
}

test_has_context_dir_missing() {
    test_start "has_context_dir returns false when missing"

    CLAUDE_PROJECT_DIR="/tmp/nonexistent-project-$$"

    if ! has_context_dir; then
        test_pass
    else
        test_fail "Expected false for missing context dir"
    fi
}

test_get_context_dir_path() {
    test_start "get_context_dir returns correct path"

    CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    local result
    result=$(get_context_dir)

    if [[ "$result" == "$PROJECT_ROOT/.claude/context" ]]; then
        test_pass
    else
        test_fail "Expected '$PROJECT_ROOT/.claude/context', got '$result'"
    fi
}

# =============================================================================
# Test: Memory Content Validation
# =============================================================================

test_validate_memory_content_valid() {
    test_start "validate_memory_content accepts valid content"

    if validate_memory_content "This is a valid memory content with enough characters" 2>/dev/null; then
        test_pass
    else
        test_fail "Expected validation to pass"
    fi
}

test_validate_memory_content_empty() {
    test_start "validate_memory_content rejects empty content"

    if ! validate_memory_content "" 2>/dev/null; then
        test_pass
    else
        test_fail "Expected validation to fail for empty"
    fi
}

test_validate_memory_content_short() {
    test_start "validate_memory_content rejects short content"

    if ! validate_memory_content "short" 10 2>/dev/null; then
        test_pass
    else
        test_fail "Expected validation to fail for short content"
    fi
}

# =============================================================================
# Test: Category Detection
# =============================================================================

test_detect_category_database() {
    test_start "detect_best_practice_category identifies database"

    local result
    result=$(detect_best_practice_category "The SQL query was slow, need to add index")

    # Could be "performance" or "database" depending on order
    if [[ "$result" == "database" || "$result" == "performance" ]]; then
        test_pass
    else
        test_fail "Expected 'database' or 'performance', got '$result'"
    fi
}

test_detect_category_api() {
    test_start "detect_best_practice_category identifies api"

    local result
    result=$(detect_best_practice_category "The REST endpoint returns 404")

    if [[ "$result" == "api" ]]; then
        test_pass
    else
        test_fail "Expected 'api', got '$result'"
    fi
}

test_detect_category_auth() {
    test_start "detect_best_practice_category identifies authentication"

    local result
    result=$(detect_best_practice_category "JWT token expiration needs handling")

    if [[ "$result" == "authentication" ]]; then
        test_pass
    else
        test_fail "Expected 'authentication', got '$result'"
    fi
}

test_detect_category_frontend() {
    test_start "detect_best_practice_category identifies frontend"

    local result
    result=$(detect_best_practice_category "React component re-renders too often")

    if [[ "$result" == "frontend" ]]; then
        test_pass
    else
        test_fail "Expected 'frontend', got '$result'"
    fi
}

test_detect_category_default() {
    test_start "detect_best_practice_category defaults to decision"

    local result
    result=$(detect_best_practice_category "Some random text without keywords")

    if [[ "$result" == "decision" ]]; then
        test_pass
    else
        test_fail "Expected 'decision', got '$result'"
    fi
}

# =============================================================================
# Test: Best Practice JSON Building
# =============================================================================

test_build_best_practice_json_success() {
    test_start "build_best_practice_json creates valid JSON for success"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(build_best_practice_json "success" "api" "REST endpoints should use proper HTTP verbs")

    # Validate it's valid JSON
    if echo "$result" | jq -e '.' >/dev/null 2>&1; then
        # Check required fields
        local has_content has_user_id
        has_content=$(echo "$result" | jq -r '.content')
        has_user_id=$(echo "$result" | jq -r '.user_id')

        if [[ -n "$has_content" && -n "$has_user_id" ]]; then
            test_pass
        else
            test_fail "Missing required fields"
        fi
    else
        test_fail "Invalid JSON output"
    fi
}

test_build_best_practice_json_with_lesson() {
    test_start "build_best_practice_json includes lesson in metadata"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    local result
    result=$(build_best_practice_json "failed" "database" "Query was too slow" "Always add indexes on foreign keys")

    local has_lesson
    has_lesson=$(echo "$result" | jq -r '.metadata.lesson // empty')

    if [[ "$has_lesson" == "Always add indexes on foreign keys" ]]; then
        test_pass
    else
        test_fail "Expected lesson in metadata, got '$has_lesson'"
    fi
}

# =============================================================================
# Test: Mem0 Availability Check
# =============================================================================

test_is_mem0_available_no_config() {
    test_start "is_mem0_available returns false without config"

    # Temporarily unset HOME to test fallback
    local OLD_HOME="$HOME"
    HOME="/nonexistent"

    if ! is_mem0_available; then
        test_pass
    else
        test_fail "Expected false when no config"
    fi

    HOME="$OLD_HOME"
}

# =============================================================================
# Run All Tests
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Mem0 Library Unit Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Project ID Generation"
echo "────────────────────────────────────────"
test_project_id_simple
test_project_id_spaces
test_project_id_special_chars
test_project_id_uppercase
test_project_id_fallback

echo ""
echo "▶ User ID Scoping"
echo "────────────────────────────────────────"
test_user_id_decisions
test_user_id_continuity
test_user_id_agents
test_user_id_patterns
test_user_id_best_practices
test_user_id_invalid_scope
test_user_id_default

echo ""
echo "▶ Context Directory Detection"
echo "────────────────────────────────────────"
test_has_context_dir_exists
test_has_context_dir_missing
test_get_context_dir_path

echo ""
echo "▶ Memory Content Validation"
echo "────────────────────────────────────────"
test_validate_memory_content_valid
test_validate_memory_content_empty
test_validate_memory_content_short

echo ""
echo "▶ Category Detection"
echo "────────────────────────────────────────"
test_detect_category_database
test_detect_category_api
test_detect_category_auth
test_detect_category_frontend
test_detect_category_default

echo ""
echo "▶ Best Practice JSON Building"
echo "────────────────────────────────────────"
test_build_best_practice_json_success
test_build_best_practice_json_with_lesson

echo ""
echo "▶ Mem0 Availability"
echo "────────────────────────────────────────"
test_is_mem0_available_no_config

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  Total:   $TESTS_RUN"
echo "  Passed:  $TESTS_PASSED"
echo "  Failed:  $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "  \033[0;32mALL TESTS PASSED!\033[0m"
    exit 0
else
    echo -e "  \033[0;31mSOME TESTS FAILED\033[0m"
    exit 1
fi