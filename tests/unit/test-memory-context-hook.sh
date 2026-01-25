#!/usr/bin/env bash
# ============================================================================
# Memory Context Hook Unit Tests (TypeScript Architecture)
# ============================================================================
# Tests for hooks/src/prompt/memory-context.ts
# Tests for .claude/scripts/decision-sync.sh
# Part of Phase 3 mem0 integration (#46, #47)
#
# Updated for TypeScript hook architecture (v5.1.0+)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TS_MEMORY_CONTEXT="$PROJECT_ROOT/src/hooks/src/prompt/memory-context.ts"
DECISION_SYNC="$PROJECT_ROOT/.claude/scripts/decision-sync.sh"
DIST_DIR="$PROJECT_ROOT/src/hooks/dist"

# ============================================================================
# MEMORY CONTEXT HOOK TESTS (TypeScript)
# ============================================================================

describe "Memory Context Hook: TypeScript Source"

test_memory_context_exists() {
    assert_file_exists "$TS_MEMORY_CONTEXT"
}

test_memory_context_exports_handler() {
    assert_file_contains "$TS_MEMORY_CONTEXT" "export"
}

test_memory_context_has_function() {
    if grep -qE "function|async|=>|const.*=" "$TS_MEMORY_CONTEXT" 2>/dev/null; then
        return 0
    fi
    fail "memory-context.ts should have function definition"
}

it "exists" test_memory_context_exists
it "exports handler" test_memory_context_exports_handler
it "has function definition" test_memory_context_has_function

describe "Memory Context Hook: Core Logic"

test_has_trigger_keywords() {
    if grep -qiE "trigger|keyword|MEMORY_TRIGGER|search" "$TS_MEMORY_CONTEXT" 2>/dev/null; then
        return 0
    fi
    fail "memory-context.ts should have trigger keywords"
}

test_has_min_prompt_length() {
    if grep -qiE "min|length|threshold|MIN_PROMPT" "$TS_MEMORY_CONTEXT" 2>/dev/null; then
        return 0
    fi
    fail "memory-context.ts should have minimum prompt length"
}

test_has_should_search_function() {
    if grep -qiE "should.*search|shouldSearch|search.*memory" "$TS_MEMORY_CONTEXT" 2>/dev/null; then
        return 0
    fi
    fail "memory-context.ts should have search decision logic"
}

it "has trigger keywords" test_has_trigger_keywords
it "has minimum prompt length" test_has_min_prompt_length
it "has search decision logic" test_has_should_search_function

describe "Memory Context Hook: CC 2.1.7 Compliance"

test_memory_context_has_hook_result() {
    if grep -qE "HookResult|continue.*:|suppressOutput" "$TS_MEMORY_CONTEXT" 2>/dev/null; then
        return 0
    fi
    # Check types file
    if grep -qE "HookResult|continue|suppressOutput" "$PROJECT_ROOT/src/hooks/src/types.ts" 2>/dev/null; then
        return 0
    fi
    fail "memory-context.ts should use HookResult type"
}

test_memory_context_has_suppress_output() {
    if grep -q "suppressOutput" "$TS_MEMORY_CONTEXT" 2>/dev/null; then
        return 0
    fi
    # May be in types
    if grep -q "suppressOutput" "$PROJECT_ROOT/src/hooks/src/types.ts" 2>/dev/null; then
        return 0
    fi
    fail "memory-context.ts should have suppressOutput for CC 2.1.7 compliance"
}

it "uses HookResult type" test_memory_context_has_hook_result
it "has suppressOutput for CC 2.1.7 compliance" test_memory_context_has_suppress_output

# ============================================================================
# DECISION SYNC SCRIPT TESTS
# ============================================================================

describe "Decision Sync Script: File Structure"

test_decision_sync_exists() {
    assert_file_exists "$DECISION_SYNC"
}

test_decision_sync_executable() {
    [[ -x "$DECISION_SYNC" ]]
}

test_decision_sync_syntax() {
    bash -n "$DECISION_SYNC"
}

it "exists" test_decision_sync_exists
it "is executable" test_decision_sync_executable
it "has valid syntax" test_decision_sync_syntax

describe "Decision Sync Script: Commands"

test_decision_sync_help() {
    local output
    output=$(bash "$DECISION_SYNC" help 2>&1)
    [[ "$output" == *"Usage"* ]] && [[ "$output" == *"status"* ]]
}

test_decision_sync_status() {
    export CLAUDE_PROJECT_DIR="$TEMP_DIR"
    mkdir -p "$TEMP_DIR/.claude/coordination" 2>/dev/null || true
    local output
    output=$(bash "$DECISION_SYNC" status 2>&1) || true
    [[ "$output" == *"Decision Sync Status"* ]]
}

test_decision_sync_pending() {
    export CLAUDE_PROJECT_DIR="$TEMP_DIR"
    mkdir -p "$TEMP_DIR/.claude/coordination" 2>/dev/null || true
    local output
    output=$(bash "$DECISION_SYNC" pending 2>&1) || true
    [[ "$output" == *"pending"* ]] || [[ "$output" == *"Pending"* ]] || [[ "$output" == *"No pending"* ]]
}

it "help command works" test_decision_sync_help
it "status command works" test_decision_sync_status
it "pending command works" test_decision_sync_pending

describe "Decision Sync Script: Functions"

test_has_init_sync_state() {
    grep -q "init_sync_state()" "$DECISION_SYNC"
}

test_has_get_local_decisions() {
    grep -q "get_local_decisions()" "$DECISION_SYNC"
}

test_has_get_pending_decisions() {
    grep -q "get_pending_decisions()" "$DECISION_SYNC"
}

test_has_format_for_mem0() {
    grep -q "format_for_mem0()" "$DECISION_SYNC"
}

it "has init_sync_state function" test_has_init_sync_state
it "has get_local_decisions function" test_has_get_local_decisions
it "has get_pending_decisions function" test_has_get_pending_decisions
it "has format_for_mem0 function" test_has_format_for_mem0

# ============================================================================
# BUNDLE TESTS
# ============================================================================

describe "Bundle Integration"

test_prompt_bundle_exists() {
    assert_file_exists "$DIST_DIR/prompt.mjs"
}

test_prompt_bundle_has_content() {
    local size
    size=$(wc -c < "$DIST_DIR/prompt.mjs" | tr -d ' ')
    if [[ "$size" -lt 1000 ]]; then
        fail "prompt.mjs seems too small ($size bytes)"
    fi
}

test_memory_hook_in_plugin_json() {
    local hooks_json="$PROJECT_ROOT/src/hooks/hooks.json"
    # TypeScript hooks are registered in hooks/hooks.json (CC 2.1.7+)
    if [[ -f "$hooks_json" ]] && grep -qE "memory-context|UserPromptSubmit" "$hooks_json" 2>/dev/null; then
        return 0
    fi
    fail "memory hook should be registered in hooks/hooks.json"
}

it "prompt bundle exists" test_prompt_bundle_exists
it "prompt bundle has content" test_prompt_bundle_has_content
it "memory hook registered in plugin.json" test_memory_hook_in_plugin_json

# ============================================================================
# RUN TESTS
# ============================================================================

print_summary
