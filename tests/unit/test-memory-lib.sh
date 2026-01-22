#!/usr/bin/env bash
# ============================================================================
# Memory Library Unit Tests
# ============================================================================
# Tests for .claude/scripts/memory-lib.sh
# - Project name extraction
# - User ID generation
# - Category detection
# - Formatting helpers
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

MEMORY_LIB="$PROJECT_ROOT/.claude/scripts/memory-lib.sh"

# ============================================================================
# INITIALIZATION TESTS
# ============================================================================

describe "Memory Library: Initialization"

test_memory_lib_exists() {
    assert_file_exists "$MEMORY_LIB"
}

test_memory_lib_syntax() {
    bash -n "$MEMORY_LIB"
}

test_memory_lib_exports_functions() {
    source "$MEMORY_LIB"

    # Check that key functions are exported
    if ! declare -F get_project_name >/dev/null; then
        fail "get_project_name should be defined"
    fi

    if ! declare -F get_decisions_user_id >/dev/null; then
        fail "get_decisions_user_id should be defined"
    fi

    if ! declare -F detect_category >/dev/null; then
        fail "detect_category should be defined"
    fi
}

# ============================================================================
# PROJECT NAME TESTS
# ============================================================================

describe "Memory Library: Project Name"

test_get_project_name_from_directory() {
    source "$MEMORY_LIB"

    CLAUDE_PROJECT_DIR="/Users/test/my-project"
    export CLAUDE_PROJECT_DIR

    local result
    result=$(get_project_name)

    assert_equals "my-project" "$result"
}

test_get_project_name_sanitizes_spaces() {
    source "$MEMORY_LIB"

    CLAUDE_PROJECT_DIR="/Users/test/My Project Name"
    export CLAUDE_PROJECT_DIR

    local result
    result=$(get_project_name)

    assert_equals "my-project-name" "$result"
}

test_get_project_name_sanitizes_special_chars() {
    source "$MEMORY_LIB"

    CLAUDE_PROJECT_DIR="/Users/test/Project@Name#123"
    export CLAUDE_PROJECT_DIR

    local result
    result=$(get_project_name)

    # Should be lowercase, special chars replaced
    assert_matches "$result" "^[a-z0-9-]+$"
}

test_get_project_name_fallback_for_empty() {
    source "$MEMORY_LIB"

    CLAUDE_PROJECT_DIR="/"
    export CLAUDE_PROJECT_DIR

    local result
    result=$(get_project_name)

    # Should have some default or derived name
    if [[ -z "$result" ]]; then
        fail "Should return a non-empty project name"
    fi
}

# ============================================================================
# USER ID GENERATION TESTS
# ============================================================================

describe "Memory Library: User ID Generation"

test_get_decisions_user_id() {
    source "$MEMORY_LIB"

    CLAUDE_PROJECT_DIR="/Users/test/my-app"
    export CLAUDE_PROJECT_DIR

    local result
    result=$(get_decisions_user_id)

    assert_equals "my-app-decisions" "$result"
}

test_get_continuity_user_id() {
    source "$MEMORY_LIB"

    CLAUDE_PROJECT_DIR="/Users/test/my-app"
    export CLAUDE_PROJECT_DIR

    local result
    result=$(get_continuity_user_id)

    assert_equals "my-app-continuity" "$result"
}

test_get_agent_id() {
    source "$MEMORY_LIB"

    local result
    result=$(get_agent_id "backend-architect")

    assert_equals "ork:backend-architect" "$result"
}

# ============================================================================
# CATEGORY DETECTION TESTS
# ============================================================================

describe "Memory Library: Category Detection"

test_detect_category_decision() {
    source "$MEMORY_LIB"

    local result
    result=$(detect_category "We chose PostgreSQL for this project")
    assert_equals "decision" "$result"

    result=$(detect_category "Decided to use TypeScript")
    assert_equals "decision" "$result"

    result=$(detect_category "Selected React over Vue")
    assert_equals "decision" "$result"
}

test_detect_category_architecture() {
    source "$MEMORY_LIB"

    local result
    result=$(detect_category "The system architecture uses microservices")
    assert_equals "architecture" "$result"

    result=$(detect_category "Our design follows hexagonal pattern")
    assert_equals "architecture" "$result"
}

test_detect_category_blocker() {
    source "$MEMORY_LIB"

    local result
    result=$(detect_category "Blocked by authentication issue")
    assert_equals "blocker" "$result"

    result=$(detect_category "Bug in the API causes failures")
    assert_equals "blocker" "$result"

    result=$(detect_category "Workaround for the memory leak")
    assert_equals "blocker" "$result"
}

test_detect_category_constraint() {
    source "$MEMORY_LIB"

    local result
    result=$(detect_category "Must use Python 3.11 or higher")
    assert_equals "constraint" "$result"

    result=$(detect_category "Cannot exceed 100MB memory limit")
    assert_equals "constraint" "$result"

    result=$(detect_category "Required to support IE11")
    assert_equals "constraint" "$result"
}

test_detect_category_pattern() {
    source "$MEMORY_LIB"

    local result
    result=$(detect_category "The naming convention uses camelCase")
    assert_equals "pattern" "$result"

    result=$(detect_category "Code style follows PEP8 standard")
    assert_equals "pattern" "$result"
}

test_detect_category_default() {
    source "$MEMORY_LIB"

    local result
    result=$(detect_category "Some generic text without keywords")

    # Should default to decision
    assert_equals "decision" "$result"
}

# ============================================================================
# FORMATTING HELPERS TESTS
# ============================================================================

describe "Memory Library: Formatting Helpers"

test_format_timestamp_today() {
    source "$MEMORY_LIB"

    local now
    now=$(date +%s)

    local result
    result=$(format_timestamp "$now")

    assert_equals "today" "$result"
}

test_format_timestamp_yesterday() {
    source "$MEMORY_LIB"

    local yesterday
    yesterday=$(($(date +%s) - 86400))

    local result
    result=$(format_timestamp "$yesterday")

    assert_equals "yesterday" "$result"
}

test_format_timestamp_days_ago() {
    source "$MEMORY_LIB"

    local three_days_ago
    three_days_ago=$(($(date +%s) - 259200))

    local result
    result=$(format_timestamp "$three_days_ago")

    assert_contains "$result" "days ago"
}

test_format_memory_output() {
    source "$MEMORY_LIB"

    local result
    result=$(format_memory "PostgreSQL chosen for ACID" "decision" "")

    assert_contains "$result" "(decision)"
    assert_contains "$result" "PostgreSQL"
}

# ============================================================================
# VALIDATION TESTS
# ============================================================================

describe "Memory Library: Validation"

test_validate_category_valid() {
    source "$MEMORY_LIB"

    if validate_category "decision"; then
        return 0
    else
        fail "Should accept 'decision' as valid category"
    fi
}

test_validate_category_invalid() {
    source "$MEMORY_LIB"

    if validate_category "invalid_category"; then
        fail "Should reject invalid category"
    fi
}

test_truncate_text_short() {
    source "$MEMORY_LIB"

    local result
    result=$(truncate_text "Short text" 100)

    assert_equals "Short text" "$result"
}

test_truncate_text_long() {
    source "$MEMORY_LIB"

    local long_text
    long_text=$(printf 'x%.0s' {1..100})

    local result
    result=$(truncate_text "$long_text" 20)

    # Should end with ...
    assert_contains "$result" "..."

    # Should be truncated
    if [[ ${#result} -gt 20 ]]; then
        fail "Should truncate to max length"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests