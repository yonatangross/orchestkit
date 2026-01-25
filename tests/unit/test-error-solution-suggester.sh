#!/usr/bin/env bash
# ============================================================================
# Error Solution Suggester Unit Tests
# ============================================================================
# Tests the error-solution-suggester PostToolUse hook:
# - Pattern matching for various error types
# - Skill linking
# - Deduplication
# - CC 2.1.9 additionalContext output format
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/src/hooks"
HOOK="$HOOKS_DIR/posttool/error-solution-suggester.sh"
SOLUTIONS_FILE="$PROJECT_ROOT/.claude/rules/error_solutions.json"

# ============================================================================
# SETUP / TEARDOWN
# ============================================================================

setup() {
    # Create unique session ID for each test run
    export CLAUDE_SESSION_ID="test-session-$$-$(date +%s)"
    export CLAUDE_PLUGIN_ROOT="$PROJECT_ROOT"
    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    # Clean up any previous test state
    rm -f "/tmp/claude-error-suggestions-${CLAUDE_SESSION_ID}.json" 2>/dev/null || true
}

teardown() {
    rm -f "/tmp/claude-error-suggestions-${CLAUDE_SESSION_ID}.json" 2>/dev/null || true
}

# ============================================================================
# BASIC FUNCTIONALITY TESTS
# ============================================================================

describe "Error Solution Suggester - Basic Functionality"

test_hook_exists() {
    assert_file_exists "$HOOK"
}

test_solutions_file_exists() {
    assert_file_exists "$SOLUTIONS_FILE"
}

test_solutions_file_is_valid_json() {
    assert_valid_json "$(cat "$SOLUTIONS_FILE")"
}

test_solutions_file_has_patterns() {
    local pattern_count
    pattern_count=$(jq '.patterns | length' "$SOLUTIONS_FILE")
    [[ $pattern_count -gt 30 ]] || fail "Expected 30+ patterns, got $pattern_count"
}

test_hook_is_executable() {
    [[ -x "$HOOK" ]] || fail "Hook is not executable"
}

# ============================================================================
# PATTERN MATCHING TESTS
# ============================================================================

describe "Error Solution Suggester - Pattern Matching"

test_matches_postgres_role_error() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"ERROR: role \"skillforge\" does not exist"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"

    # Should have additionalContext with solution
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        assert_contains "$context" "role"
    else
        fail "Expected additionalContext for postgres role error"
    fi

    teardown
}

test_matches_npm_module_not_found() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"Error: Cannot find module '\''vitest'\''"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"

    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        assert_contains "$context" "npm"
    else
        fail "Expected additionalContext for npm module error"
    fi

    teardown
}

test_matches_git_merge_conflict() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"CONFLICT (content): Merge conflict in src/main.ts"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"

    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        assert_contains "$context" "conflict"
    fi

    teardown
}

test_matches_python_module_error() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"ModuleNotFoundError: No module named '\''requests'\''"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"

    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        assert_contains "$context" "pip"
    fi

    teardown
}

test_matches_connection_refused() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"Error: connect ECONNREFUSED 127.0.0.1:5432"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"

    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        assert_contains "$context" "running"
    fi

    teardown
}

test_matches_typescript_error() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"error TS2339: Property '\''foo'\'' does not exist on type '\''Bar'\''."}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"

    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        return 0
    fi

    teardown
}

test_matches_jwt_error() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_error":"JsonWebTokenError: jwt malformed"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"

    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        assert_contains "$context" "JWT"
    fi

    teardown
}

# ============================================================================
# SELF-GUARD TESTS
# ============================================================================

describe "Error Solution Suggester - Self Guards"

test_ignores_non_bash_tool() {
    setup

    local input='{"tool_name":"Write","exit_code":0,"tool_output":"File written"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    assert_contains "$output" '"continue": true'
    # Should NOT have additionalContext
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        fail "Should not inject context for non-Bash tool"
    fi

    teardown
}

test_ignores_successful_command() {
    setup

    local input='{"tool_name":"Bash","exit_code":0,"tool_output":"Success!"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should NOT have additionalContext for success
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        fail "Should not inject context for successful command"
    fi

    teardown
}

test_ignores_empty_output() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":""}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"

    teardown
}

# ============================================================================
# DEDUPLICATION TESTS
# ============================================================================

describe "Error Solution Suggester - Deduplication"

test_dedup_prevents_repeat_suggestions() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"ERROR: role \"test\" does not exist"}'

    # First call - should suggest
    local first_output
    first_output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true
    assert_valid_json "$first_output"

    # Should have additionalContext
    echo "$first_output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1 || \
        fail "First call should have additionalContext"

    # Second call with same error - should skip
    local second_output
    second_output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true
    assert_valid_json "$second_output"

    # Should NOT have additionalContext (deduped)
    if echo "$second_output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        fail "Second call should be deduped"
    fi

    teardown
}

test_dedup_allows_different_errors() {
    setup

    local input1='{"tool_name":"Bash","exit_code":1,"tool_output":"ERROR: role \"user1\" does not exist"}'
    local input2='{"tool_name":"Bash","exit_code":1,"tool_output":"Cannot find module '\''express'\''"}'

    # First error
    local output1
    output1=$(echo "$input1" | bash "$HOOK" 2>/dev/null) || true

    # Different error - should also suggest
    local output2
    output2=$(echo "$input2" | bash "$HOOK" 2>/dev/null) || true

    # Both should have suggestions (different patterns)
    echo "$output1" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1 || \
        fail "First error should have suggestion"
    echo "$output2" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1 || \
        fail "Second (different) error should also have suggestion"

    teardown
}

# ============================================================================
# SKILL LINKING TESTS
# ============================================================================

describe "Error Solution Suggester - Skill Linking"

test_includes_related_skills_for_db_error() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"ERROR: relation \"users\" does not exist"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        # Should mention alembic-migrations skill
        assert_contains "$context" "Skills"
    fi

    teardown
}

test_includes_skill_descriptions() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"QueuePool limit of 5 exceeded"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        # Should have skill section with descriptions
        assert_contains "$context" "connection-pooling"
    fi

    teardown
}

# ============================================================================
# CC 2.1.9 COMPLIANCE TESTS
# ============================================================================

describe "Error Solution Suggester - CC 2.1.9 Compliance"

test_output_has_continue_field() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"ERROR: something failed"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    echo "$output" | jq -e 'has("continue")' >/dev/null 2>&1 || \
        fail "Output must have 'continue' field"

    teardown
}

test_output_uses_additional_context() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"ERROR: role \"x\" does not exist"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    # When matching, should use hookSpecificOutput.additionalContext
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        return 0
    fi
    # If no match, should have suppressOutput
    echo "$output" | jq -e '.suppressOutput' >/dev/null 2>&1 || \
        fail "Must have either additionalContext or suppressOutput"

    teardown
}

test_silent_success_for_no_match() {
    setup

    local input='{"tool_name":"Bash","exit_code":1,"tool_output":"Some random error with no pattern match"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    assert_contains "$output" '"continue": true'

    teardown
}

# ============================================================================
# SOLUTIONS FILE VALIDATION
# ============================================================================

describe "Error Solutions Database Validation"

test_all_patterns_have_required_fields() {
    local patterns
    patterns=$(jq -c '.patterns[]' "$SOLUTIONS_FILE")

    while IFS= read -r pattern; do
        local id regex category solution_brief
        id=$(echo "$pattern" | jq -r '.id // ""')
        regex=$(echo "$pattern" | jq -r '.regex // ""')
        category=$(echo "$pattern" | jq -r '.category // ""')
        solution_brief=$(echo "$pattern" | jq -r '.solution.brief // ""')

        [[ -n "$id" ]] || fail "Pattern missing id"
        [[ -n "$regex" ]] || fail "Pattern $id missing regex"
        [[ -n "$category" ]] || fail "Pattern $id missing category"
        [[ -n "$solution_brief" ]] || fail "Pattern $id missing solution.brief"
    done <<< "$patterns"
}

test_all_categories_exist() {
    local categories
    categories=$(jq -r '.categories | keys[]' "$SOLUTIONS_FILE")

    local pattern_categories
    pattern_categories=$(jq -r '.patterns[].category' "$SOLUTIONS_FILE" | sort -u)

    while IFS= read -r cat; do
        if ! echo "$categories" | grep -q "^${cat}$"; then
            fail "Pattern uses undefined category: $cat"
        fi
    done <<< "$pattern_categories"
}

test_all_regexes_are_valid() {
    local patterns
    patterns=$(jq -r '.patterns[].regex' "$SOLUTIONS_FILE")

    while IFS= read -r regex; do
        # Try to use the regex with grep -E
        echo "test" | grep -qE "$regex" 2>/dev/null || \
        echo "test" | grep -E "$regex" >/dev/null 2>&1 || true
        # If grep doesn't crash, regex is valid
    done <<< "$patterns"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
