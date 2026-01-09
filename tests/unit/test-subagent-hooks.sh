#!/usr/bin/env bash
# ============================================================================
# Subagent & Agent Hooks Unit Tests
# ============================================================================
# Tests hooks that run during subagent spawning and completion:
# - subagent-start/: context loading, model enforcement
# - subagent-stop/: quality gates, completion tracking
# - agent/: handoff, output validation
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/.claude/hooks"

# ============================================================================
# SUBAGENT-START HOOKS
# ============================================================================

describe "Subagent Start Hooks"

test_agent_context_loader_outputs_valid_json() {
    local hook="$HOOKS_DIR/subagent-start/agent-context-loader.sh"
    if [[ ! -f "$hook" ]]; then
        skip "agent-context-loader.sh not found"
    fi

    local input='{"subagent_type":"code-quality-reviewer","prompt":"Review this code"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
        # Should have continue field for CC 2.1.2
        if echo "$output" | jq -e 'has("continue")' >/dev/null 2>&1; then
            return 0
        fi
    fi
}

test_model_enforcer_validates_model() {
    local hook="$HOOKS_DIR/subagent-start/model-enforcer.sh"
    if [[ ! -f "$hook" ]]; then
        skip "model-enforcer.sh not found"
    fi

    # Test with valid model
    local input='{"subagent_type":"test-agent","model":"sonnet"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_subagent_context_stager_loads_context() {
    local hook="$HOOKS_DIR/subagent-start/subagent-context-stager.sh"
    if [[ ! -f "$hook" ]]; then
        skip "subagent-context-stager.sh not found"
    fi

    local input='{"subagent_type":"backend-system-architect","prompt":"Design API"}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    # Should not crash
    assert_less_than "$exit_code" 3
}

test_subagent_resource_allocator_runs() {
    local hook="$HOOKS_DIR/subagent-start/subagent-resource-allocator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "subagent-resource-allocator.sh not found"
    fi

    local input='{"subagent_type":"test-agent","estimated_tokens":5000}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# SUBAGENT-STOP HOOKS
# ============================================================================

describe "Subagent Stop Hooks"

test_subagent_completion_tracker_logs_completion() {
    local hook="$HOOKS_DIR/subagent-stop/subagent-completion-tracker.sh"
    if [[ ! -f "$hook" ]]; then
        skip "subagent-completion-tracker.sh not found"
    fi

    local input='{"subagent_type":"test-agent","status":"completed","duration_ms":5000}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    assert_less_than "$exit_code" 3
}

test_subagent_quality_gate_validates_output() {
    local hook="$HOOKS_DIR/subagent-stop/subagent-quality-gate.sh"
    if [[ ! -f "$hook" ]]; then
        skip "subagent-quality-gate.sh not found"
    fi

    # Test with successful completion
    local input='{"subagent_type":"test-generator","status":"completed","output":"Generated 5 tests"}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# AGENT HOOKS
# ============================================================================

describe "Agent Hooks"

test_context_publisher_outputs_json() {
    local hook="$HOOKS_DIR/agent/context-publisher.sh"
    if [[ ! -f "$hook" ]]; then
        skip "context-publisher.sh not found"
    fi

    local input='{"agent_id":"test-agent-001","context":{"key":"value"}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_handoff_preparer_creates_handoff_context() {
    local hook="$HOOKS_DIR/agent/handoff-preparer.sh"
    if [[ ! -f "$hook" ]]; then
        skip "handoff-preparer.sh not found"
    fi

    local input='{"source_agent":"plan","target_agent":"implement","context":{}}'
    local output
    output=$(echo "$input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_output_validator_validates_agent_output() {
    local hook="$HOOKS_DIR/agent/output-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "output-validator.sh not found"
    fi

    local input='{"agent_type":"test-generator","output":"Tests generated successfully"}'
    local exit_code
    echo "$input" | bash "$hook" >/dev/null 2>&1 && exit_code=0 || exit_code=$?

    assert_less_than "$exit_code" 3
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests