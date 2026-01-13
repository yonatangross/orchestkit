#!/usr/bin/env bash
# ============================================================================
# Pretool MCP Hooks Unit Tests
# ============================================================================
# Tests all MCP-related pretool hooks for CC 2.1.6 compliance
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/hooks/pretool/mcp"

# ============================================================================
# CONTEXT7 TRACKER
# ============================================================================

describe "Context7 Tracker Hook"

test_context7_tracker_handles_resolve_library() {
    local hook="$HOOKS_DIR/context7-tracker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context7-tracker.sh not found"
    fi

    local input='{"tool_name":"mcp__context7__resolve-library-id","tool_input":{"libraryName":"react","query":"hooks"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    # Check for continue field (CC 2.1.6)
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Missing continue:true field (CC 2.1.6 compliance)"
    fi
}

test_context7_tracker_handles_get_docs() {
    local hook="$HOOKS_DIR/context7-tracker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context7-tracker.sh not found"
    fi

    local input='{"tool_name":"mcp__context7__get-library-docs","tool_input":{"context7CompatibleLibraryID":"/facebook/react","topic":"useState"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Missing continue:true field"
    fi
}

test_context7_tracker_has_valid_output() {
    local hook="$HOOKS_DIR/context7-tracker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context7-tracker.sh not found"
    fi

    local input='{"tool_name":"mcp__context7__resolve-library-id","tool_input":{"libraryName":"fastapi"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e 'has("systemMessage") or has("suppressOutput")' >/dev/null 2>&1; then
        fail "Missing systemMessage or suppressOutput field"
    fi
}

# ============================================================================
# MEMORY VALIDATOR
# ============================================================================

describe "Memory Validator Hook"

test_memory_validator_handles_search() {
    local hook="$HOOKS_DIR/memory-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "memory-validator.sh not found"
    fi

    local input='{"tool_name":"mcp__memory__search_nodes","tool_input":{"query":"user preferences"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Missing continue:true field"
    fi
}

test_memory_validator_handles_create() {
    local hook="$HOOKS_DIR/memory-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "memory-validator.sh not found"
    fi

    local input='{"tool_name":"mcp__memory__create_entities","tool_input":{"entities":[{"name":"TestEntity","type":"concept"}]}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Missing continue:true field"
    fi
}

test_memory_validator_warns_on_delete() {
    local hook="$HOOKS_DIR/memory-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "memory-validator.sh not found"
    fi

    # Delete operations should still pass but with warning
    local input='{"tool_name":"mcp__memory__delete_entities","tool_input":{"entityNames":["OldEntity"]}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should still continue (with warning)
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Delete should still continue (with warning)"
    fi
}

# ============================================================================
# PLAYWRIGHT SAFETY
# ============================================================================

describe "Playwright Safety Hook"

test_playwright_safety_handles_navigate() {
    local hook="$HOOKS_DIR/playwright-safety.sh"
    if [[ ! -f "$hook" ]]; then
        skip "playwright-safety.sh not found"
    fi

    local input='{"tool_name":"mcp__playwright__browser_navigate","tool_input":{"url":"https://example.com"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Missing continue:true field"
    fi
}

test_playwright_safety_handles_click() {
    local hook="$HOOKS_DIR/playwright-safety.sh"
    if [[ ! -f "$hook" ]]; then
        skip "playwright-safety.sh not found"
    fi

    local input='{"tool_name":"mcp__playwright__browser_click","tool_input":{"selector":"#submit-btn"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Missing continue:true field"
    fi
}

test_playwright_safety_handles_file_upload() {
    local hook="$HOOKS_DIR/playwright-safety.sh"
    if [[ ! -f "$hook" ]]; then
        skip "playwright-safety.sh not found"
    fi

    # File upload should be allowed but logged
    local input='{"tool_name":"mcp__playwright__browser_file_upload","tool_input":{"paths":["/tmp/test.txt"]}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "File upload should continue (with logging)"
    fi
}

test_playwright_safety_has_valid_output() {
    local hook="$HOOKS_DIR/playwright-safety.sh"
    if [[ ! -f "$hook" ]]; then
        skip "playwright-safety.sh not found"
    fi

    local input='{"tool_name":"mcp__playwright__browser_screenshot","tool_input":{}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e 'has("systemMessage") or has("suppressOutput")' >/dev/null 2>&1; then
        fail "Missing systemMessage or suppressOutput field"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests