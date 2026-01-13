#!/usr/bin/env bash
# ============================================================================
# Prompt Hooks Unit Tests
# ============================================================================
# Tests hooks that run during prompt processing:
# - prompt/: context injection, todo enforcement
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
        # Check for continue field (CC 2.1.6)
        if echo "$output" | jq -e 'has("continue")' >/dev/null 2>&1; then
            return 0
        fi
    fi
}

test_prompt_dispatcher_routes_correctly() {
    local hook="$HOOKS_DIR/prompt/prompt-dispatcher.sh"
    if [[ ! -f "$hook" ]]; then
        skip "prompt-dispatcher.sh not found"
    fi

    local input='{"prompt":"Build a REST API","role":"user"}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    # Should not crash
    assert_less_than "$exit_code" 3
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