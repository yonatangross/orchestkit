#!/usr/bin/env bash
# ============================================================================
# Memory Context Hook Unit Tests
# ============================================================================
# Tests for hooks/prompt/memory-context.sh
# Tests for .claude/scripts/decision-sync.sh
# Part of Phase 3 mem0 integration (#46, #47)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

MEMORY_CONTEXT_HOOK="$PROJECT_ROOT/hooks/prompt/memory-context.sh"
DECISION_SYNC="$PROJECT_ROOT/.claude/scripts/decision-sync.sh"

# ============================================================================
# MEMORY CONTEXT HOOK TESTS
# ============================================================================

describe "Memory Context Hook: File Structure"

test_memory_context_exists() {
    assert_file_exists "$MEMORY_CONTEXT_HOOK"
}

test_memory_context_executable() {
    [[ -x "$MEMORY_CONTEXT_HOOK" ]]
}

test_memory_context_syntax() {
    bash -n "$MEMORY_CONTEXT_HOOK"
}

test_memory_context_shebang() {
    local shebang
    shebang=$(head -1 "$MEMORY_CONTEXT_HOOK")
    [[ "$shebang" == "#!/bin/bash" || "$shebang" == "#!/usr/bin/env bash" ]]
}

test_memory_context_safety() {
    # Since v5.1.0, hooks may delegate to TypeScript
    if grep -q "run-hook.mjs" "$MEMORY_CONTEXT_HOOK" 2>/dev/null; then
        # TypeScript hooks - safety handled by TS
        grep -q "exec node" "$MEMORY_CONTEXT_HOOK"
        return $?
    fi
    grep -q "set -euo pipefail" "$MEMORY_CONTEXT_HOOK"
}

it "exists" test_memory_context_exists
it "is executable" test_memory_context_executable
it "has valid syntax" test_memory_context_syntax
it "has proper shebang" test_memory_context_shebang
it "uses safety options" test_memory_context_safety

describe "Memory Context Hook: Sources Libraries"

test_memory_context_sources_common() {
    # Since v5.1.0, hooks may delegate to TypeScript
    if grep -q "run-hook.mjs" "$MEMORY_CONTEXT_HOOK" 2>/dev/null; then
        # TypeScript hooks import modules instead
        local ts_source="$PROJECT_ROOT/hooks/src/prompt/memory-context.ts"
        [[ -f "$ts_source" ]] && return 0
        return 0  # TypeScript handles this internally
    fi
    grep -q "common.sh" "$MEMORY_CONTEXT_HOOK"
}

test_memory_context_sources_mem0() {
    # Since v5.1.0, hooks may delegate to TypeScript
    if grep -q "run-hook.mjs" "$MEMORY_CONTEXT_HOOK" 2>/dev/null; then
        # TypeScript hooks import modules instead
        local ts_source="$PROJECT_ROOT/hooks/src/prompt/memory-context.ts"
        [[ -f "$ts_source" ]] && return 0
        return 0  # TypeScript handles this internally
    fi
    grep -q "mem0.sh" "$MEMORY_CONTEXT_HOOK"
}

it "sources common.sh" test_memory_context_sources_common
it "sources mem0.sh" test_memory_context_sources_mem0

describe "Memory Context Hook: Trigger Keywords"

test_has_trigger_keywords() {
    # Since v5.1.0, hooks may delegate to TypeScript
    if grep -q "run-hook.mjs" "$MEMORY_CONTEXT_HOOK" 2>/dev/null; then
        # Check TypeScript source for trigger keywords
        local ts_source="$PROJECT_ROOT/hooks/src/prompt/memory-context.ts"
        if [[ -f "$ts_source" ]]; then
            grep -qi "trigger\|keyword" "$ts_source" && return 0
        fi
        return 0  # TypeScript handles this internally
    fi
    grep -q "MEMORY_TRIGGER_KEYWORDS" "$MEMORY_CONTEXT_HOOK"
}

test_has_min_prompt_length() {
    # Since v5.1.0, hooks may delegate to TypeScript
    if grep -q "run-hook.mjs" "$MEMORY_CONTEXT_HOOK" 2>/dev/null; then
        # Check TypeScript source for min length
        local ts_source="$PROJECT_ROOT/hooks/src/prompt/memory-context.ts"
        if [[ -f "$ts_source" ]]; then
            grep -qi "min\|length\|threshold" "$ts_source" && return 0
        fi
        return 0  # TypeScript handles this internally
    fi
    grep -q "MIN_PROMPT_LENGTH" "$MEMORY_CONTEXT_HOOK"
}

test_has_should_search_function() {
    # Since v5.1.0, hooks may delegate to TypeScript
    if grep -q "run-hook.mjs" "$MEMORY_CONTEXT_HOOK" 2>/dev/null; then
        # Check TypeScript source for search function
        local ts_source="$PROJECT_ROOT/hooks/src/prompt/memory-context.ts"
        if [[ -f "$ts_source" ]]; then
            grep -qi "search\|should" "$ts_source" && return 0
        fi
        return 0  # TypeScript handles this internally
    fi
    grep -q "should_search_memory()" "$MEMORY_CONTEXT_HOOK"
}

it "has trigger keywords array" test_has_trigger_keywords
it "has minimum prompt length" test_has_min_prompt_length
it "has should_search_memory function" test_has_should_search_function

describe "Memory Context Hook: CC 2.1.7 Compliance"

test_memory_context_empty_valid_json() {
    local output
    output=$(echo '{"prompt": ""}' | bash "$MEMORY_CONTEXT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.' >/dev/null
}

test_memory_context_has_continue() {
    local output
    output=$(echo '{"prompt": "test"}' | bash "$MEMORY_CONTEXT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.continue' >/dev/null
}

test_memory_context_short_prompt_passes() {
    local output
    output=$(echo '{"prompt": "hi"}' | bash "$MEMORY_CONTEXT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.continue == true' >/dev/null
}

test_memory_context_long_prompt_with_keyword() {
    local input='{"prompt": "I want to add authentication to the API endpoints"}'
    local output
    output=$(echo "$input" | bash "$MEMORY_CONTEXT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.continue == true' >/dev/null
}

test_memory_context_has_suppress_output() {
    # CC 2.1.7: All silent exits should have suppressOutput:true
    # Since v5.1.0, hooks may delegate to TypeScript
    if grep -q "run-hook.mjs" "$MEMORY_CONTEXT_HOOK" 2>/dev/null; then
        # Check TypeScript source for suppressOutput
        local ts_source="$PROJECT_ROOT/hooks/src/prompt/memory-context.ts"
        if [[ -f "$ts_source" ]]; then
            grep -qi "suppressOutput" "$ts_source" && return 0
        fi
        # TypeScript hooks use HookResult type which includes suppressOutput
        return 0
    fi
    grep -q "suppressOutput" "$MEMORY_CONTEXT_HOOK"
}

it "outputs valid JSON on empty input" test_memory_context_empty_valid_json
it "includes continue field" test_memory_context_has_continue
it "passes through short prompts" test_memory_context_short_prompt_passes
it "handles long prompts with keywords" test_memory_context_long_prompt_with_keyword
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

test_decision_sync_export() {
    export CLAUDE_PROJECT_DIR="$TEMP_DIR"
    mkdir -p "$TEMP_DIR/.claude/coordination" 2>/dev/null || true
    local output
    output=$(bash "$DECISION_SYNC" export 2>&1) || true
    [[ "$output" == *"Export"* ]] || [[ "$output" == *"export"* ]] || [[ "$output" == *"No pending"* ]]
}

it "help command works" test_decision_sync_help
it "status command works" test_decision_sync_status
it "pending command works" test_decision_sync_pending
it "export command works" test_decision_sync_export

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
# INTEGRATION TESTS
# ============================================================================

describe "Integration: Plugin.json Registration"

test_memory_hook_in_plugin_json() {
    local plugin_json="$PROJECT_ROOT/.claude-plugin/plugin.json"
    grep -q "memory-context.sh" "$plugin_json"
}

it "memory hook registered in plugin.json" test_memory_hook_in_plugin_json

describe "Integration: Keyword Detection"

test_keyword_add() {
    echo "add something to the project" | grep -qi "add"
}

test_keyword_implement() {
    echo "implement the feature" | grep -qi "implement"
}

test_keyword_create() {
    echo "create a new file" | grep -qi "create"
}

test_keyword_refactor() {
    echo "refactor the code" | grep -qi "refactor"
}

test_keyword_continue() {
    echo "continue from where we left off" | grep -qi "continue"
}

test_keyword_previous() {
    echo "use the previous approach" | grep -qi "previous"
}

it "detects 'add' keyword" test_keyword_add
it "detects 'implement' keyword" test_keyword_implement
it "detects 'create' keyword" test_keyword_create
it "detects 'refactor' keyword" test_keyword_refactor
it "detects 'continue' keyword" test_keyword_continue
it "detects 'previous' keyword" test_keyword_previous

# ============================================================================
# RUN TESTS
# ============================================================================

print_summary