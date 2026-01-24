#!/usr/bin/env bash
# ============================================================================
# Full MCP Integration Tests
# ============================================================================
# End-to-end tests for MCP tool integration with hooks
# CC 2.1.7 Compliant
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

MCP_HOOKS_DIR="$PROJECT_ROOT/hooks/pretool/mcp"
TS_LIB_DIR="$PROJECT_ROOT/hooks/src/lib"

# ============================================================================
# HOOK STRUCTURE TESTS
# ============================================================================

describe "MCP Integration: Hook Structure"

test_all_mcp_hooks_exist() {
    local expected_hooks=("context7-tracker.sh" "memory-validator.sh" "sequential-thinking-auto.sh")

    for hook in "${expected_hooks[@]}"; do
        [[ -f "$MCP_HOOKS_DIR/$hook" ]] || return 1
    done
    return 0
}

test_all_mcp_hooks_executable() {
    local hooks=("context7-tracker.sh" "memory-validator.sh" "sequential-thinking-auto.sh")

    for hook in "${hooks[@]}"; do
        [[ -f "$MCP_HOOKS_DIR/$hook" && -x "$MCP_HOOKS_DIR/$hook" ]] || return 1
    done
    return 0
}

test_all_mcp_hooks_source_common() {
    local hooks=("context7-tracker.sh" "memory-validator.sh" "sequential-thinking-auto.sh")

    for hook in "${hooks[@]}"; do
        if [[ -f "$MCP_HOOKS_DIR/$hook" ]]; then
            # Since v5.1.0, hooks may delegate to TypeScript
            if grep -q "run-hook.mjs" "$MCP_HOOKS_DIR/$hook" 2>/dev/null; then
                # TypeScript hooks use lib/common.ts internally
                continue
            fi
            grep -q "source.*common.sh" "$MCP_HOOKS_DIR/$hook" || return 1
        fi
    done
    return 0
}

# ============================================================================
# AUDIT LOGGING TESTS
# ============================================================================

describe "MCP Integration: Audit Logging"

test_all_mcp_hooks_have_audit_logging() {
    local hooks=("context7-tracker.sh" "memory-validator.sh" "sequential-thinking-auto.sh")

    for hook in "${hooks[@]}"; do
        if [[ -f "$MCP_HOOKS_DIR/$hook" ]]; then
            # Since v5.1.0, hooks may delegate to TypeScript
            if grep -q "run-hook.mjs" "$MCP_HOOKS_DIR/$hook" 2>/dev/null; then
                # TypeScript hooks have logging built into lib/common.ts
                continue
            fi
            grep -q "log_permission_feedback" "$MCP_HOOKS_DIR/$hook" || return 1
        fi
    done
    return 0
}

test_log_permission_feedback_function_exists() {
    # Since v5.1.0, common.sh was migrated to TypeScript
    # Check TypeScript source for logging functions
    if [[ -f "$TS_LIB_DIR/common.ts" ]]; then
        grep -qiE "log.*feedback|output.*context" "$TS_LIB_DIR/common.ts"
        return $?
    fi
    return 1
}

# ============================================================================
# JSON OUTPUT COMPLIANCE TESTS
# ============================================================================

describe "MCP Integration: JSON Output Compliance"

test_context7_returns_valid_json() {
    local hook="$MCP_HOOKS_DIR/context7-tracker.sh"
    [[ ! -f "$hook" ]] && skip "context7-tracker.sh not found"

    local input='{"tool_name":"mcp__context7__query-docs","tool_input":{"libraryId":"/test","query":"test"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    echo "$result" | jq -e . >/dev/null 2>&1
}

test_agent_browser_returns_valid_json() {
    local hook="$PROJECT_ROOT/hooks/pretool/bash/agent-browser-safety.sh"
    [[ ! -f "$hook" ]] && skip "agent-browser-safety.sh not found"

    local input='{"tool_name":"Bash","tool_input":{"command":"agent-browser open https://example.com"}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    echo "$result" | jq -e . >/dev/null 2>&1
}

test_memory_returns_valid_json() {
    local hook="$MCP_HOOKS_DIR/memory-validator.sh"
    [[ ! -f "$hook" ]] && skip "memory-validator.sh not found"

    local input='{"tool_name":"mcp__memory__read_graph","tool_input":{}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    echo "$result" | jq -e . >/dev/null 2>&1
}

test_sequential_thinking_returns_valid_json() {
    local hook="$MCP_HOOKS_DIR/sequential-thinking-auto.sh"
    [[ ! -f "$hook" ]] && skip "sequential-thinking-auto.sh not found"

    local input='{"tool_name":"mcp__sequential-thinking__sequentialthinking","tool_input":{"thought":"test","thoughtNumber":1,"totalThoughts":1,"nextThoughtNeeded":false}}'
    local result=$(echo "$input" | bash "$hook" 2>/dev/null)

    echo "$result" | jq -e . >/dev/null 2>&1
}

# ============================================================================
# CROSS-HOOK TESTS
# ============================================================================

describe "MCP Integration: Cross-Hook Compatibility"

test_hooks_dont_interfere_with_each_other() {
    # Test that each hook only processes its own tools
    local context7_input='{"tool_name":"Bash","tool_input":{"command":"ls -la"}}'
    local agent_browser_input='{"tool_name":"mcp__context7__query-docs","tool_input":{}}'

    # Context7 hook should pass through Bash tools
    if [[ -f "$MCP_HOOKS_DIR/context7-tracker.sh" ]]; then
        local c7_result=$(echo "$context7_input" | bash "$MCP_HOOKS_DIR/context7-tracker.sh" 2>/dev/null)
        # Check for continue:true with or without spaces (JSON formatting varies)
        echo "$c7_result" | jq -e '.continue == true' >/dev/null 2>&1 || return 1
    fi

    # agent-browser hook should pass through context7 tool
    if [[ -f "$PROJECT_ROOT/hooks/pretool/bash/agent-browser-safety.sh" ]]; then
        local ab_result=$(echo "$agent_browser_input" | bash "$PROJECT_ROOT/hooks/pretool/bash/agent-browser-safety.sh" 2>/dev/null)
        # Check for continue:true with jq
        echo "$ab_result" | jq -e '.continue == true' >/dev/null 2>&1 || return 1
    fi

    return 0
}

# ============================================================================
# RUN TESTS
# ============================================================================

setup_test_env
run_tests
exit $((TESTS_FAILED > 0 ? 1 : 0))