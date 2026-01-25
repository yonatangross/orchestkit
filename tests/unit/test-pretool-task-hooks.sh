#!/usr/bin/env bash
# ============================================================================
# Pretool Task Hooks Unit Tests
# ============================================================================
# Tests Task-related pretool hooks for CC 2.1.6 compliance
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/src/hooks/pretool/task"

# ============================================================================
# CONTEXT GATE
# ============================================================================

describe "Context Gate Hook"

test_context_gate_allows_normal_task() {
    local hook="$HOOKS_DIR/context-gate.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context-gate.sh not found"
    fi

    local input='{"tool_name":"Task","tool_input":{"subagent_type":"Explore","description":"Find files","prompt":"Search for config files"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Normal task should be allowed"
    fi
}

test_context_gate_handles_background_task() {
    local hook="$HOOKS_DIR/context-gate.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context-gate.sh not found"
    fi

    local input='{"tool_name":"Task","tool_input":{"subagent_type":"test-generator","description":"Generate tests","prompt":"Create unit tests","run_in_background":true}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should pass with fresh state (no other agents running)
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "First background task should be allowed"
    fi
}

test_context_gate_has_system_message() {
    local hook="$HOOKS_DIR/context-gate.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context-gate.sh not found"
    fi

    local input='{"tool_name":"Task","tool_input":{"subagent_type":"Plan","description":"Plan feature","prompt":"Design API"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e 'has("systemMessage") or has("suppressOutput")' >/dev/null 2>&1; then
        fail "Missing systemMessage or suppressOutput field"
    fi
}

test_context_gate_handles_expensive_agent_types() {
    local hook="$HOOKS_DIR/context-gate.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context-gate.sh not found"
    fi

    # Test with expensive agent type
    local input='{"tool_name":"Task","tool_input":{"subagent_type":"backend-system-architect","description":"Design system","prompt":"Create architecture"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should still pass (first expensive agent)
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Expensive agent should be allowed when no others running"
    fi
}

# ============================================================================
# SUBAGENT VALIDATOR
# ============================================================================

describe "Subagent Validator Hook"

test_subagent_validator_tracks_valid_type() {
    local hook="$HOOKS_DIR/subagent-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "subagent-validator.sh not found"
    fi

    local input='{"tool_name":"Task","tool_input":{"subagent_type":"Explore","description":"Explore codebase","prompt":"Find all Python files"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Valid subagent type should be allowed"
    fi
}

test_subagent_validator_handles_builtin_types() {
    local hook="$HOOKS_DIR/subagent-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "subagent-validator.sh not found"
    fi

    # Test all builtin types
    local builtin_types=("general-purpose" "Explore" "Plan" "claude-code-guide" "Bash")

    for type in "${builtin_types[@]}"; do
        local input="{\"tool_name\":\"Task\",\"tool_input\":{\"subagent_type\":\"$type\",\"description\":\"Test $type\",\"prompt\":\"Test prompt\"}}"
        local output
        output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

        if [[ -n "$output" ]]; then
            if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
                fail "Builtin type $type should be allowed"
            fi
        fi
    done
}

test_subagent_validator_handles_plugin_types() {
    local hook="$HOOKS_DIR/subagent-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "subagent-validator.sh not found"
    fi

    # Test with a plugin-defined agent type
    local input='{"tool_name":"Task","tool_input":{"subagent_type":"code-quality-reviewer","description":"Review code","prompt":"Check quality"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should pass (plugin.json defines this agent)
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Plugin-defined agent type should be allowed"
    fi
}

test_subagent_validator_warns_unknown_type() {
    local hook="$HOOKS_DIR/subagent-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "subagent-validator.sh not found"
    fi

    # Test with unknown type - should warn but allow
    local input='{"tool_name":"Task","tool_input":{"subagent_type":"totally-unknown-type","description":"Unknown","prompt":"Test"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    assert_valid_json "$output"
    # Should still continue (with warning)
    if ! strip_ansi "$output" | jq -e '.continue == true' >/dev/null 2>&1; then
        fail "Unknown type should still be allowed (with warning)"
    fi
}

test_subagent_validator_has_system_message() {
    local hook="$HOOKS_DIR/subagent-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "subagent-validator.sh not found"
    fi

    local input='{"tool_name":"Task","tool_input":{"subagent_type":"Explore","description":"Test","prompt":"Test"}}'
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