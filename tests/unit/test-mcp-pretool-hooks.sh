#!/usr/bin/env bash
# ============================================================================
# MCP PreToolUse Hooks Unit Tests
# ============================================================================
# Tests TypeScript hooks via run-hook.mjs: context7-tracker, memory-validator
# Also validates hook registration in hooks.json
# CC 2.1.34 Compliant — TypeScript hooks only (shell hooks removed in v6.0)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_SRC_DIR="$PROJECT_ROOT/src/hooks/src"
HOOKS_BIN="$PROJECT_ROOT/src/hooks/bin/run-hook.mjs"
HOOKS_JSON="$PROJECT_ROOT/src/hooks/hooks.json"

# ============================================================================
# HOOK REGISTRATION TESTS
# ============================================================================

describe "MCP Hooks: Registration in hooks.json"

test_context7_tracker_registered() {
    assert_file_exists "$HOOKS_JSON"
    assert_file_contains "$HOOKS_JSON" "pretool/mcp/context7-tracker"
}

test_memory_validator_registered() {
    assert_file_exists "$HOOKS_JSON"
    assert_file_contains "$HOOKS_JSON" "pretool/mcp/memory-validator"
}

test_agent_browser_safety_source_exists() {
    assert_file_exists "$HOOKS_SRC_DIR/pretool/bash/agent-browser-safety.ts"
}

# ============================================================================
# TYPESCRIPT SOURCE VALIDATION TESTS
# ============================================================================

describe "MCP Hooks: TypeScript Source Files"

test_context7_tracker_ts_exists() {
    assert_file_exists "$HOOKS_SRC_DIR/pretool/mcp/context7-tracker.ts"
}

test_memory_validator_ts_exists() {
    assert_file_exists "$HOOKS_SRC_DIR/pretool/mcp/memory-validator.ts"
}

test_context7_tracker_exports_function() {
    assert_file_contains "$HOOKS_SRC_DIR/pretool/mcp/context7-tracker.ts" "export function"
}

test_memory_validator_exports_function() {
    assert_file_contains "$HOOKS_SRC_DIR/pretool/mcp/memory-validator.ts" "export function"
}

# ============================================================================
# HOOK EXECUTION TESTS (via run-hook.mjs)
# ============================================================================

describe "MCP Hooks: Execution via run-hook.mjs"

test_context7_tracker_executes() {
    [[ ! -f "$HOOKS_BIN" ]] && skip "run-hook.mjs not found"

    local input='{"tool_name":"mcp__context7__query-docs","tool_input":{"libraryId":"/vercel/next.js","query":"routing"}}'
    local result
    result=$(echo "$input" | node "$HOOKS_BIN" pretool/mcp/context7-tracker 2>/dev/null) || true

    # Should produce valid JSON output
    assert_valid_json "$result"
}

test_memory_validator_executes() {
    [[ ! -f "$HOOKS_BIN" ]] && skip "run-hook.mjs not found"

    local input='{"tool_name":"mcp__memory__create_entities","tool_input":{"entities":[{"name":"Test","entityType":"concept","observations":[]}]}}'
    local result
    result=$(echo "$input" | node "$HOOKS_BIN" pretool/mcp/memory-validator 2>/dev/null) || true

    assert_valid_json "$result"
}

test_memory_validator_allows_small_entity_delete() {
    [[ ! -f "$HOOKS_BIN" ]] && skip "run-hook.mjs not found"

    local input='{"tool_name":"mcp__memory__delete_entities","tool_input":{"entityNames":["a","b"]}}'
    local result
    result=$(echo "$input" | node "$HOOKS_BIN" pretool/mcp/memory-validator 2>/dev/null) || true

    assert_valid_json "$result"
    assert_json_field "$result" ".continue" "true"
}

# ============================================================================
# DANGEROUS COMMAND BLOCKER TESTS (TypeScript)
# ============================================================================

describe "Bash Hooks: Dangerous Command Blocker"

test_dangerous_command_blocker_registered() {
    # dangerous-command-blocker is consolidated into sync-bash-dispatcher (#868)
    assert_file_contains "$HOOKS_JSON" "pretool/bash/sync-bash-dispatcher"
}

test_dangerous_command_blocker_ts_exists() {
    assert_file_exists "$HOOKS_SRC_DIR/pretool/bash/dangerous-command-blocker.ts"
}

test_dangerous_command_blocker_executes() {
    [[ ! -f "$HOOKS_BIN" ]] && skip "run-hook.mjs not found"

    local input='{"tool_name":"Bash","tool_input":{"command":"echo hello"}}'
    local result
    result=$(echo "$input" | node "$HOOKS_BIN" pretool/bash/dangerous-command-blocker 2>/dev/null) || true

    assert_valid_json "$result"
    assert_json_field "$result" ".continue" "true"
}

# ============================================================================
# RUN TESTS
# ============================================================================

setup_test_env
run_tests
print_summary
exit $((TESTS_FAILED > 0 ? 1 : 0))
