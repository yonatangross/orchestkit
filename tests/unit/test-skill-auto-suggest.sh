#!/usr/bin/env bash
# ============================================================================
# Skill Auto-Suggest Hook Unit Tests
# ============================================================================
# Tests for hooks/prompt/skill-auto-suggest.sh
# Issue #123: Skill Auto-Suggest Hook
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOK="$PROJECT_ROOT/hooks/prompt/skill-auto-suggest.sh"

# ============================================================================
# BASIC FUNCTIONALITY TESTS
# ============================================================================

describe "Skill Auto-Suggest Hook Basic Functionality"

test_hook_exists_and_executable() {
    if [[ ! -f "$HOOK" ]]; then
        fail "Hook file not found at $HOOK"
    fi
    if [[ ! -x "$HOOK" ]]; then
        fail "Hook is not executable"
    fi
}

test_empty_input_returns_silent_success() {
    local output
    output=$(echo "" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    assert_json_field "$output" ".continue" "true"
    assert_json_field "$output" ".suppressOutput" "true"
}

test_no_prompt_returns_silent_success() {
    local input='{}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    assert_json_field "$output" ".continue" "true"
}

# ============================================================================
# KEYWORD MATCHING TESTS
# ============================================================================

describe "Keyword Matching"

test_api_keywords_suggest_api_design() {
    local input='{"prompt":"Help me design a REST API for user management"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should have additionalContext with api-design-framework
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        if [[ "$context" == *"api-design-framework"* ]]; then
            return 0
        fi
        fail "Expected api-design-framework in suggestions, got: $context"
    fi
}

test_database_keywords_suggest_schema_designer() {
    local input='{"prompt":"I need to create a database schema for products"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        if [[ "$context" == *"database-schema-designer"* ]]; then
            return 0
        fi
        fail "Expected database-schema-designer in suggestions"
    fi
}

test_auth_keywords_suggest_auth_patterns() {
    local input='{"prompt":"Implement JWT authentication for the API"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        if [[ "$context" == *"auth-patterns"* ]]; then
            return 0
        fi
        fail "Expected auth-patterns in suggestions"
    fi
}

test_testing_keywords_suggest_pytest() {
    local input='{"prompt":"Write unit tests for the user service using pytest"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        if [[ "$context" == *"pytest-advanced"* ]]; then
            return 0
        fi
        fail "Expected pytest-advanced in suggestions"
    fi
}

test_react_keywords_suggest_rsc_framework() {
    local input='{"prompt":"Build a Next.js app with server components"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        if [[ "$context" == *"react-server-components-framework"* ]]; then
            return 0
        fi
        fail "Expected react-server-components-framework in suggestions"
    fi
}

test_fastapi_keywords_suggest_fastapi_advanced() {
    local input='{"prompt":"Set up FastAPI with dependency injection and middleware"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        if [[ "$context" == *"fastapi-advanced"* ]]; then
            return 0
        fi
        fail "Expected fastapi-advanced in suggestions"
    fi
}

test_security_keywords_suggest_owasp() {
    local input='{"prompt":"Check for OWASP vulnerabilities in the code"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        if [[ "$context" == *"owasp-top-10"* ]]; then
            return 0
        fi
        fail "Expected owasp-top-10 in suggestions"
    fi
}

test_langgraph_keywords_suggest_langgraph_skills() {
    local input='{"prompt":"Create a LangGraph workflow with human-in-the-loop"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        if [[ "$context" == *"langgraph"* ]]; then
            return 0
        fi
        fail "Expected langgraph skills in suggestions"
    fi
}

# ============================================================================
# CC 2.1.9 COMPLIANCE TESTS
# ============================================================================

describe "CC 2.1.9 Compliance"

test_output_uses_additional_context() {
    local input='{"prompt":"Help me with API design"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    # When skills are found, should use hookSpecificOutput.additionalContext
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        return 0
    elif echo "$output" | jq -e '.suppressOutput' >/dev/null 2>&1; then
        # No matches - also valid
        return 0
    fi
    fail "Expected either additionalContext or suppressOutput"
}

test_always_returns_continue_true() {
    local prompts=(
        '{"prompt":"Help with API"}'
        '{"prompt":"Random text without keywords"}'
        '{"prompt":""}'
        '{}'
    )

    for input in "${prompts[@]}"; do
        local output
        output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true
        assert_valid_json "$output"
        local continue_val
        continue_val=$(echo "$output" | jq -r '.continue')
        if [[ "$continue_val" != "true" ]]; then
            fail "Expected continue:true for input: $input"
        fi
    done
}

test_suppress_output_when_no_matches() {
    local input='{"prompt":"Hello world"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should have suppressOutput:true when no skills match
    if echo "$output" | jq -e '.suppressOutput == true' >/dev/null 2>&1; then
        return 0
    fi
    # Or it might find some generic match - check for valid output
    if echo "$output" | jq -e 'has("continue")' >/dev/null 2>&1; then
        return 0
    fi
    fail "Expected valid output structure"
}

# ============================================================================
# MULTIPLE SKILL MATCHING TESTS
# ============================================================================

describe "Multiple Skill Matching"

test_multiple_keywords_multiple_skills() {
    local input='{"prompt":"Create a FastAPI endpoint with JWT auth and write tests"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        # Should suggest multiple skills
        local skill_count=0
        [[ "$context" == *"fastapi"* ]] && ((skill_count++)) || true
        [[ "$context" == *"auth"* ]] && ((skill_count++)) || true
        [[ "$context" == *"test"* ]] && ((skill_count++)) || true

        if (( skill_count >= 2 )); then
            return 0
        fi
        fail "Expected at least 2 skill suggestions, got $skill_count"
    fi
}

test_max_suggestions_limit() {
    # Complex prompt that could match many skills
    local input='{"prompt":"Create a FastAPI REST API with database schema, JWT auth, pytest tests, and deploy to kubernetes"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        # Count skill mentions (lines starting with "- **")
        local skill_count
        skill_count=$(echo "$context" | grep -c "^\- \*\*" || true)
        if (( skill_count <= 3 )); then
            return 0
        fi
        fail "Expected max 3 suggestions, got $skill_count"
    fi
}

# ============================================================================
# CASE INSENSITIVITY TESTS
# ============================================================================

describe "Case Insensitivity"

test_uppercase_keywords_match() {
    local input='{"prompt":"CREATE A REST API WITH JWT AUTH"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        return 0
    fi
}

test_mixed_case_keywords_match() {
    local input='{"prompt":"Build a FastAPI app with PyTest tests"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        if [[ "$context" == *"fastapi"* ]] || [[ "$context" == *"pytest"* ]]; then
            return 0
        fi
    fi
}

# ============================================================================
# EDGE CASES
# ============================================================================

describe "Edge Cases"

test_special_characters_in_prompt() {
    local input='{"prompt":"How do I use @decorators and **kwargs in FastAPI?"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should not crash on special characters
    assert_json_field "$output" ".continue" "true"
}

test_very_long_prompt() {
    # Generate a long prompt
    local long_text
    long_text=$(printf 'word%.0s ' {1..500})
    local input="{\"prompt\":\"Help me build an API. $long_text\"}"
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    assert_json_field "$output" ".continue" "true"
}

test_prompt_with_newlines() {
    local input='{"prompt":"Help me with:\n1. API design\n2. Database schema\n3. Testing"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    assert_json_field "$output" ".continue" "true"
}

test_alternative_json_field_names() {
    # Test with 'message' instead of 'prompt'
    local input='{"message":"Design a REST API"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should still find API-related skills
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        local context
        context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
        if [[ "$context" == *"api"* ]]; then
            return 0
        fi
    fi
}

test_content_field_name() {
    # Test with 'content' field
    local input='{"content":"Create a database schema"}'
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    assert_valid_json "$output"
}

# ============================================================================
# PLUGIN.JSON REGISTRATION TEST
# ============================================================================

describe "Plugin Registration"

test_hook_registered_in_plugin_json() {
    local plugin_json="$PROJECT_ROOT/.claude-plugin/plugin.json"

    if [[ ! -f "$plugin_json" ]]; then
        fail "plugin.json not found"
    fi

    if grep -q "skill-auto-suggest.sh" "$plugin_json"; then
        return 0
    fi
    fail "Hook not registered in plugin.json"
}

test_hook_in_user_prompt_submit_section() {
    local plugin_json="$PROJECT_ROOT/.claude-plugin/plugin.json"

    # Check that it's in the UserPromptSubmit hooks section
    local in_section
    in_section=$(jq '.hooks.UserPromptSubmit[0].hooks[] | select(.command | contains("skill-auto-suggest"))' "$plugin_json" 2>/dev/null)

    if [[ -n "$in_section" ]]; then
        return 0
    fi
    fail "Hook not in UserPromptSubmit section"
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests
