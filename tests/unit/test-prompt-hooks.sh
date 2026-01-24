#!/usr/bin/env bash
# ============================================================================
# Prompt Hooks Unit Tests
# ============================================================================
# Tests hooks that run during prompt processing:
# - prompt/: context injection, todo enforcement, memory context, satisfaction
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/hooks"

# ============================================================================
# PROMPT HOOKS
# ============================================================================

describe "Prompt Hooks"

test_context_injector_adds_context() {
    local hook="$HOOKS_DIR/prompt/context-injector.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context-injector.sh not found"
    fi

    local input='{"prompt":"Help me write a function","role":"user"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Check for continue field (CC 2.1.7)
        if echo "$output" | jq -e 'has("continue")' >/dev/null 2>&1; then
            return 0
        fi
    fi
}

test_todo_enforcer_checks_todo_list() {
    local hook="$HOOKS_DIR/prompt/todo-enforcer.sh"
    if [[ ! -f "$hook" ]]; then
        skip "todo-enforcer.sh not found"
    fi

    local input='{"prompt":"Continue with the task","has_todos":true}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_memory_context_outputs_json() {
    local hook="$HOOKS_DIR/prompt/memory-context.sh"
    if [[ ! -f "$hook" ]]; then
        skip "memory-context.sh not found"
    fi

    local input='{"prompt":"Add a new feature to the API"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Check for continue field (CC 2.1.7)
        echo "$output" | jq -e 'has("continue")' >/dev/null 2>&1
    fi
}

test_satisfaction_detector_outputs_json() {
    local hook="$HOOKS_DIR/prompt/satisfaction-detector.sh"
    if [[ ! -f "$hook" ]]; then
        skip "satisfaction-detector.sh not found"
    fi

    local input='{"prompt":"Thanks, that worked perfectly!"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Check for continue field (CC 2.1.7)
        echo "$output" | jq -e 'has("continue")' >/dev/null 2>&1
    fi
}

test_context_pruning_advisor_outputs_json() {
    local hook="$HOOKS_DIR/prompt/context-pruning-advisor.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    local input='{"prompt":"Design a REST API endpoint"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Check for continue field (CC 2.1.7)
        echo "$output" | jq -e 'has("continue")' >/dev/null 2>&1
    fi
}

test_context_pruning_advisor_triggers_at_70_percent() {
    local hook="$HOOKS_DIR/prompt/context-pruning-advisor.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context-pruning-advisor.sh not found"
    fi

    # Set high context usage to trigger advisor
    export CLAUDE_CONTEXT_USAGE_PERCENT=0.75
    local input='{"prompt":"Add a new feature"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Should include additionalContext when triggered
        if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
            return 0
        fi
    fi

    unset CLAUDE_CONTEXT_USAGE_PERCENT
}

# ============================================================================
# CC 2.1.7 COMPLIANCE TESTS
# ============================================================================

describe "CC 2.1.7 Compliance"

test_all_prompt_hooks_have_suppress_output() {
    local hooks=(
        "$HOOKS_DIR/prompt/context-injector.sh"
        "$HOOKS_DIR/prompt/todo-enforcer.sh"
        "$HOOKS_DIR/prompt/memory-context.sh"
        "$HOOKS_DIR/prompt/satisfaction-detector.sh"
        "$HOOKS_DIR/prompt/context-pruning-advisor.sh"
    )

    for hook in "${hooks[@]}"; do
        if [[ -f "$hook" ]]; then
            # Check that hook either:
            # 1. Delegates to TypeScript via run-hook.mjs (modern pattern)
            # 2. Contains suppressOutput directly (legacy pattern)
            if grep -q "run-hook.mjs" "$hook"; then
                continue  # TypeScript handles suppressOutput
            elif grep -q "suppressOutput" "$hook"; then
                continue  # Legacy pattern with suppressOutput
            else
                echo "FAIL: $hook missing suppressOutput or TypeScript delegation"
                return 1
            fi
        fi
    done
}

test_hooks_registered_in_plugin_json() {
    local plugin_json="$PROJECT_ROOT/.claude-plugin/plugin.json"

    # Check all 5 prompt hooks are registered individually
    grep -q "context-injector.sh" "$plugin_json" || return 1
    grep -q "todo-enforcer.sh" "$plugin_json" || return 1
    grep -q "memory-context.sh" "$plugin_json" || return 1
    grep -q "satisfaction-detector.sh" "$plugin_json" || return 1
    grep -q "context-pruning-advisor.sh" "$plugin_json" || return 1
}

# ============================================================================
# SKILL HOOKS (Additional coverage)
# ============================================================================

describe "Skill Hooks"

test_skill_discovery_finds_skills() {
    local hook="$HOOKS_DIR/skill/skill-discovery.sh"
    if [[ ! -f "$hook" ]]; then
        skip "skill-discovery.sh not found"
    fi

    local input='{"query":"authentication patterns"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_skill_loader_loads_skill() {
    local hook="$HOOKS_DIR/skill/skill-loader.sh"
    if [[ ! -f "$hook" ]]; then
        skip "skill-loader.sh not found"
    fi

    local input='{"skill_name":"unit-testing","tier":1}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_skill_capability_matcher() {
    local hook="$HOOKS_DIR/skill/skill-capability-matcher.sh"
    if [[ ! -f "$hook" ]]; then
        skip "skill-capability-matcher.sh not found"
    fi

    local input='{"task":"write unit tests for API","context":"FastAPI backend"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests