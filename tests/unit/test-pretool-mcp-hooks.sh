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
    # Pass input via _HOOK_INPUT env var (init_hook_input doesn't read stdin to prevent hanging)
    output=$(_HOOK_INPUT="$input" bash "$hook" 2>/dev/null) || true

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

    # Use correct tool name: query-docs (not get-library-docs)
    local input='{"tool_name":"mcp__context7__query-docs","tool_input":{"libraryId":"/facebook/react","query":"useState"}}'
    local output
    # Pass input via _HOOK_INPUT env var (init_hook_input doesn't read stdin to prevent hanging)
    output=$(_HOOK_INPUT="$input" bash "$hook" 2>/dev/null) || true

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
    # Pass input via _HOOK_INPUT env var (init_hook_input doesn't read stdin to prevent hanging)
    output=$(_HOOK_INPUT="$input" bash "$hook" 2>/dev/null) || true

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
    # Pass input via _HOOK_INPUT env var (init_hook_input doesn't read stdin to prevent hanging)
    output=$(_HOOK_INPUT="$input" bash "$hook" 2>/dev/null) || true

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
    # Pass input via _HOOK_INPUT env var (init_hook_input doesn't read stdin to prevent hanging)
    output=$(_HOOK_INPUT="$input" bash "$hook" 2>/dev/null) || true

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
    # Pass input via _HOOK_INPUT env var (init_hook_input doesn't read stdin to prevent hanging)
    output=$(_HOOK_INPUT="$input" bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should still continue (with warning)
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Delete should still continue (with warning)"
    fi
}

# ============================================================================
# AGENT-BROWSER SAFETY
# ============================================================================

BASH_HOOKS_DIR="$PROJECT_ROOT/hooks/pretool/bash"

describe "agent-browser Safety Hook"

test_agent_browser_safety_allows_safe_urls() {
    local hook="$BASH_HOOKS_DIR/agent-browser-safety.sh"
    if [[ ! -f "$hook" ]]; then
        skip "agent-browser-safety.sh not found"
    fi

    local input='{"tool_name":"Bash","tool_input":{"command":"agent-browser open https://example.com"}}'
    local output
    # Pipe input via stdin (TypeScript hooks read from stdin)
    # Use perl for cross-platform timeout (works on macOS and Linux)
    output=$(echo "$input" | perl -e 'alarm 10; exec @ARGV' bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Missing continue:true field"
    fi
}

test_agent_browser_safety_blocks_file_protocol() {
    local hook="$BASH_HOOKS_DIR/agent-browser-safety.sh"
    if [[ ! -f "$hook" ]]; then
        skip "agent-browser-safety.sh not found"
    fi

    local input='{"tool_name":"Bash","tool_input":{"command":"agent-browser open file:///etc/passwd"}}'
    local output
    # Pipe input via stdin (TypeScript hooks read from stdin)
    # Use perl for cross-platform timeout (works on macOS and Linux)
    output=$(echo "$input" | perl -e 'alarm 10; exec @ARGV' bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == false' >/dev/null 2>&1; then
        fail "Should block file:// protocol"
    fi
}

test_agent_browser_safety_blocks_auth_domains() {
    local hook="$BASH_HOOKS_DIR/agent-browser-safety.sh"
    if [[ ! -f "$hook" ]]; then
        skip "agent-browser-safety.sh not found"
    fi

    local input='{"tool_name":"Bash","tool_input":{"command":"agent-browser open https://accounts.google.com"}}'
    local output
    # Pipe input via stdin (TypeScript hooks read from stdin)
    # Use perl for cross-platform timeout (works on macOS and Linux)
    output=$(echo "$input" | perl -e 'alarm 10; exec @ARGV' bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == false' >/dev/null 2>&1; then
        fail "Should block auth domains"
    fi
}

test_agent_browser_safety_skips_non_browser_commands() {
    local hook="$BASH_HOOKS_DIR/agent-browser-safety.sh"
    if [[ ! -f "$hook" ]]; then
        skip "agent-browser-safety.sh not found"
    fi

    local input='{"tool_name":"Bash","tool_input":{"command":"ls -la"}}'
    local output
    # Pipe input via stdin (TypeScript hooks read from stdin)
    # Use perl for cross-platform timeout (works on macOS and Linux)
    output=$(echo "$input" | perl -e 'alarm 10; exec @ARGV' bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Should pass through non-browser commands"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests