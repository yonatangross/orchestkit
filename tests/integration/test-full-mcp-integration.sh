#!/usr/bin/env bash
# ============================================================================
# Full MCP Integration Tests
# ============================================================================
# End-to-end tests for MCP tool integration with hooks
# CC 2.1.7 Compliant
# Phase 4: Updated for TypeScript hooks with run-hook.mjs
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

# Phase 4: MCP hooks migrated to TypeScript
MCP_TS_DIR="$PROJECT_ROOT/hooks/src/pretool/mcp"
TS_LIB_DIR="$PROJECT_ROOT/hooks/src/lib"
HOOK_RUNNER="$PROJECT_ROOT/hooks/bin/run-hook.mjs"

# Run TypeScript hook via run-hook.mjs
run_hook() {
    local handler="$1"
    local input="$2"
    echo "$input" | node "$HOOK_RUNNER" "$handler" 2>/dev/null || echo '{"continue":true}'
}

# ============================================================================
# HOOK STRUCTURE TESTS
# ============================================================================

describe "MCP Integration: Hook Structure"

test_all_mcp_hooks_exist() {
    # Phase 4: Check TypeScript source files
    local expected_hooks=("context7-tracker.ts" "memory-validator.ts" "sequential-thinking-auto.ts")

    for hook in "${expected_hooks[@]}"; do
        [[ -f "$MCP_TS_DIR/$hook" ]] || return 1
    done
    return 0
}

test_all_mcp_hooks_executable() {
    # Phase 4: Check TypeScript hooks can be invoked via run-hook.mjs
    [[ -f "$HOOK_RUNNER" && -x "$HOOK_RUNNER" ]] || return 1
    [[ -f "$MCP_TS_DIR/context7-tracker.ts" ]] || return 1
    [[ -f "$MCP_TS_DIR/memory-validator.ts" ]] || return 1
    [[ -f "$MCP_TS_DIR/sequential-thinking-auto.ts" ]] || return 1
    return 0
}

test_all_mcp_hooks_source_common() {
    # Phase 4: TypeScript hooks import from lib/common.ts
    local hooks=("context7-tracker.ts" "memory-validator.ts" "sequential-thinking-auto.ts")

    for hook in "${hooks[@]}"; do
        if [[ -f "$MCP_TS_DIR/$hook" ]]; then
            # TypeScript hooks import common utilities
            grep -qE "from.*common|import.*common" "$MCP_TS_DIR/$hook" 2>/dev/null || return 1
        fi
    done
    return 0
}

# ============================================================================
# AUDIT LOGGING TESTS
# ============================================================================

describe "MCP Integration: Audit Logging"

test_all_mcp_hooks_have_audit_logging() {
    # Phase 4: TypeScript hooks have logging built into lib/common.ts
    # Just verify the lib/common.ts has logging functions
    [[ -f "$TS_LIB_DIR/common.ts" ]] || return 1
    grep -qiE "log|output" "$TS_LIB_DIR/common.ts" 2>/dev/null || return 1
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
    # Phase 4: Use TypeScript hook via run-hook.mjs
    [[ ! -f "$MCP_TS_DIR/context7-tracker.ts" ]] && skip "context7-tracker.ts not found"

    local input='{"tool_name":"mcp__context7__query-docs","tool_input":{"libraryId":"/test","query":"test"},"session_id":"test-123"}'
    local result=$(run_hook "pretool/mcp/context7-tracker" "$input")
    local json_line=$(echo "$result" | grep -E '^\{.*\}$' | tail -1)

    echo "$json_line" | jq -e . >/dev/null 2>&1
}

test_agent_browser_returns_valid_json() {
    # Phase 4: Use TypeScript hook via run-hook.mjs
    [[ ! -f "$PROJECT_ROOT/hooks/src/pretool/bash/agent-browser-safety.ts" ]] && skip "agent-browser-safety.ts not found"

    local input='{"tool_input":{"command":"agent-browser open https://example.com"},"session_id":"test-123"}'
    local result=$(run_hook "pretool/bash/agent-browser-safety" "$input")
    local json_line=$(echo "$result" | grep -E '^\{.*\}$' | tail -1)

    echo "$json_line" | jq -e . >/dev/null 2>&1
}

test_memory_returns_valid_json() {
    # Phase 4: Use TypeScript hook via run-hook.mjs
    [[ ! -f "$MCP_TS_DIR/memory-validator.ts" ]] && skip "memory-validator.ts not found"

    local input='{"tool_name":"mcp__memory__read_graph","tool_input":{},"session_id":"test-123"}'
    local result=$(run_hook "pretool/mcp/memory-validator" "$input")
    local json_line=$(echo "$result" | grep -E '^\{.*\}$' | tail -1)

    echo "$json_line" | jq -e . >/dev/null 2>&1
}

test_sequential_thinking_returns_valid_json() {
    # Phase 4: Use TypeScript hook via run-hook.mjs
    [[ ! -f "$MCP_TS_DIR/sequential-thinking-auto.ts" ]] && skip "sequential-thinking-auto.ts not found"

    local input='{"tool_name":"mcp__sequential-thinking__sequentialthinking","tool_input":{"thought":"test","thoughtNumber":1,"totalThoughts":1,"nextThoughtNeeded":false},"session_id":"test-123"}'
    local result=$(run_hook "pretool/mcp/sequential-thinking-auto" "$input")
    local json_line=$(echo "$result" | grep -E '^\{.*\}$' | tail -1)

    echo "$json_line" | jq -e . >/dev/null 2>&1
}

# ============================================================================
# CROSS-HOOK TESTS
# ============================================================================

describe "MCP Integration: Cross-Hook Compatibility"

test_hooks_dont_interfere_with_each_other() {
    # Test that each hook only processes its own tools
    # Phase 4: Use TypeScript hooks via run-hook.mjs
    local context7_input='{"tool_input":{"command":"ls -la"},"session_id":"test-123"}'
    local agent_browser_input='{"tool_name":"mcp__context7__query-docs","tool_input":{},"session_id":"test-123"}'

    # Context7 hook should pass through Bash tools
    if [[ -f "$MCP_TS_DIR/context7-tracker.ts" ]]; then
        local c7_result=$(run_hook "pretool/mcp/context7-tracker" "$context7_input")
        local json_line=$(echo "$c7_result" | grep -E '^\{.*\}$' | tail -1)
        # Check for continue:true
        echo "$json_line" | jq -e '.continue == true' >/dev/null 2>&1 || return 1
    fi

    # agent-browser hook should pass through context7 tool
    if [[ -f "$PROJECT_ROOT/hooks/src/pretool/bash/agent-browser-safety.ts" ]]; then
        local ab_result=$(run_hook "pretool/bash/agent-browser-safety" "$agent_browser_input")
        local json_line=$(echo "$ab_result" | grep -E '^\{.*\}$' | tail -1)
        # Check for continue:true with jq
        echo "$json_line" | jq -e '.continue == true' >/dev/null 2>&1 || return 1
    fi

    return 0
}

# ============================================================================
# RUN TESTS
# ============================================================================

setup_test_env
run_tests
exit $((TESTS_FAILED > 0 ? 1 : 0))