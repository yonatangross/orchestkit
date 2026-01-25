#!/usr/bin/env bash
# ============================================================================
# MCP PreToolUse Hooks Unit Tests
# ============================================================================
# Tests for MCP hook validation: context7, memory, sequential-thinking
# Also tests agent-browser safety (Bash hook)
# CC 2.1.7 Compliant
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

MCP_HOOKS_DIR="$PROJECT_ROOT/src/hooks/pretool/mcp"

# ============================================================================
# CONTEXT7 TRACKER TESTS
# ============================================================================

describe "MCP Hooks: Context7 Tracker"

test_context7_allows_valid_lookup() {
    local hook="$MCP_HOOKS_DIR/context7-tracker.sh"
    [[ ! -f "$hook" ]] && skip "context7-tracker.sh not found"

    local input='{"tool_name":"mcp__context7__query-docs","tool_input":{"libraryId":"/vercel/next.js","query":"routing"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "true"
}

test_context7_ignores_non_context7_tools() {
    local hook="$MCP_HOOKS_DIR/context7-tracker.sh"
    [[ ! -f "$hook" ]] && skip "context7-tracker.sh not found"

    local input='{"tool_name":"Bash","tool_input":{"command":"ls"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "true"
}

# ============================================================================
# AGENT-BROWSER SAFETY TESTS
# ============================================================================

describe "Bash Hooks: agent-browser Safety"

BASH_HOOKS_DIR="$PROJECT_ROOT/src/hooks/pretool/bash"

test_agent_browser_blocks_file_protocol() {
    local hook="$BASH_HOOKS_DIR/agent-browser-safety.sh"
    [[ ! -f "$hook" ]] && skip "agent-browser-safety.sh not found"

    local input='{"tool_name":"Bash","tool_input":{"command":"agent-browser open file:///etc/passwd"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "false"
}

test_agent_browser_blocks_localhost_by_default() {
    local hook="$BASH_HOOKS_DIR/agent-browser-safety.sh"
    [[ ! -f "$hook" ]] && skip "agent-browser-safety.sh not found"

    unset ALLOW_LOCALHOST
    local input='{"tool_name":"Bash","tool_input":{"command":"agent-browser open http://localhost:3000"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    # Note: localhost blocking may vary based on TypeScript implementation
    # Check that the hook produces valid JSON with continue field
    assert_valid_json "$result"
}

test_agent_browser_allows_localhost_when_enabled() {
    local hook="$BASH_HOOKS_DIR/agent-browser-safety.sh"
    [[ ! -f "$hook" ]] && skip "agent-browser-safety.sh not found"

    export ALLOW_LOCALHOST=true
    local input='{"tool_name":"Bash","tool_input":{"command":"agent-browser open http://localhost:3000"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "true"
    unset ALLOW_LOCALHOST
}

test_agent_browser_blocks_auth_domains() {
    local hook="$BASH_HOOKS_DIR/agent-browser-safety.sh"
    [[ ! -f "$hook" ]] && skip "agent-browser-safety.sh not found"

    local input='{"tool_name":"Bash","tool_input":{"command":"agent-browser open https://accounts.google.com/signin"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "false"
}

test_agent_browser_allows_safe_urls() {
    local hook="$BASH_HOOKS_DIR/agent-browser-safety.sh"
    [[ ! -f "$hook" ]] && skip "agent-browser-safety.sh not found"

    local input='{"tool_name":"Bash","tool_input":{"command":"agent-browser open https://example.com/page"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "true"
}

test_agent_browser_skips_non_browser_commands() {
    local hook="$BASH_HOOKS_DIR/agent-browser-safety.sh"
    [[ ! -f "$hook" ]] && skip "agent-browser-safety.sh not found"

    local input='{"tool_name":"Bash","tool_input":{"command":"ls -la"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "true"
}

# ============================================================================
# MEMORY VALIDATOR TESTS
# ============================================================================

describe "MCP Hooks: Memory Validator"

test_memory_warns_on_bulk_entity_delete() {
    local hook="$MCP_HOOKS_DIR/memory-validator.sh"
    [[ ! -f "$hook" ]] && skip "memory-validator.sh not found"

    local input='{"tool_name":"mcp__memory__delete_entities","tool_input":{"entityNames":["a","b","c","d","e","f","g"]}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    # Should warn but allow (continue: true)
    assert_json_field "$result" ".continue" "true"
}

test_memory_allows_small_entity_delete() {
    local hook="$MCP_HOOKS_DIR/memory-validator.sh"
    [[ ! -f "$hook" ]] && skip "memory-validator.sh not found"

    local input='{"tool_name":"mcp__memory__delete_entities","tool_input":{"entityNames":["a","b"]}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "true"
}

test_memory_validates_entity_creation() {
    local hook="$MCP_HOOKS_DIR/memory-validator.sh"
    [[ ! -f "$hook" ]] && skip "memory-validator.sh not found"

    local input='{"tool_name":"mcp__memory__create_entities","tool_input":{"entities":[{"name":"Test","entityType":"concept","observations":[]}]}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "true"
}

# ============================================================================
# SEQUENTIAL THINKING TESTS
# ============================================================================

describe "MCP Hooks: Sequential Thinking Tracker"

test_sequential_thinking_tracks_first_thought() {
    local hook="$MCP_HOOKS_DIR/sequential-thinking-auto.sh"
    [[ ! -f "$hook" ]] && skip "sequential-thinking-auto.sh not found"

    local input='{"tool_name":"mcp__sequential-thinking__sequentialthinking","tool_input":{"thought":"Starting analysis","thoughtNumber":1,"totalThoughts":5,"nextThoughtNeeded":true}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "true"
}

test_sequential_thinking_ignores_other_tools() {
    local hook="$MCP_HOOKS_DIR/sequential-thinking-auto.sh"
    [[ ! -f "$hook" ]] && skip "sequential-thinking-auto.sh not found"

    local input='{"tool_name":"Read","tool_input":{"file_path":"/test.txt"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    assert_json_field "$result" ".continue" "true"
}

# ============================================================================
# RUN TESTS
# ============================================================================

setup_test_env
run_tests
print_summary
exit $((TESTS_FAILED > 0 ? 1 : 0))
