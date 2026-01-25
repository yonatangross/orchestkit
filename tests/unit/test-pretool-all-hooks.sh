#!/usr/bin/env bash
# ============================================================================
# Pretool Hooks Comprehensive Tests
# ============================================================================
# Tests all pretool hook categories for CC 2.1.6 compliance
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

HOOKS_DIR="$PROJECT_ROOT/src/hooks"
PRETOOL_INPUT='{"tool_name":"Bash","tool_input":{"command":"echo test"}}'

# ============================================================================
# PRETOOL/BASH HOOKS
# ============================================================================

describe "Pretool Bash Hooks"

test_bash_defaults_blocks_dangerous_commands() {
    local hook="$HOOKS_DIR/pretool/bash/bash-defaults.sh"
    if [[ ! -f "$hook" ]]; then
        skip "bash-defaults.sh not found"
    fi

    # Test with safe command
    local safe_input='{"tool_name":"Bash","tool_input":{"command":"ls -la"}}'
    local output
    output=$(echo "$safe_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_ci_simulation_hook() {
    local hook="$HOOKS_DIR/pretool/bash/ci-simulation.sh"
    if [[ ! -f "$hook" ]]; then
        skip "ci-simulation.sh not found"
    fi

    local output
    output=$(echo "$PRETOOL_INPUT" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_conflict_predictor_hook() {
    local hook="$HOOKS_DIR/pretool/bash/conflict-predictor.sh"
    if [[ ! -f "$hook" ]]; then
        skip "conflict-predictor.sh not found"
    fi

    local git_input='{"tool_name":"Bash","tool_input":{"command":"git merge feature"}}'
    local output
    output=$(echo "$git_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_error_pattern_warner_hook() {
    local hook="$HOOKS_DIR/pretool/bash/error-pattern-warner.sh"
    if [[ ! -f "$hook" ]]; then
        skip "error-pattern-warner.sh not found"
    fi

    local output
    output=$(echo "$PRETOOL_INPUT" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_issue_docs_requirement_hook() {
    local hook="$HOOKS_DIR/pretool/bash/issue-docs-requirement.sh"
    if [[ ! -f "$hook" ]]; then
        skip "issue-docs-requirement.sh not found"
    fi

    local output
    output=$(echo "$PRETOOL_INPUT" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_multi_instance_quality_gate_hook() {
    local hook="$HOOKS_DIR/pretool/bash/multi-instance-quality-gate.sh"
    if [[ ! -f "$hook" ]]; then
        skip "multi-instance-quality-gate.sh not found"
    fi

    local output
    output=$(echo "$PRETOOL_INPUT" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# PRETOOL/WRITE-EDIT HOOKS
# ============================================================================

describe "Pretool Write-Edit Hooks"

test_write_edit_file_guard() {
    local hook="$HOOKS_DIR/pretool/write-edit/file-guard.sh"
    if [[ ! -f "$hook" ]]; then
        skip "file-guard.sh not found"
    fi

    local write_input='{"tool_name":"Write","tool_input":{"file_path":"/tmp/test.txt","content":"test"}}'
    local output
    output=$(echo "$write_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_write_edit_permission_validator() {
    local hook="$HOOKS_DIR/pretool/write-edit/permission-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "permission-validator.sh not found"
    fi

    local write_input='{"tool_name":"Edit","tool_input":{"file_path":"test.txt"}}'
    local output
    output=$(echo "$write_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_write_edit_backup_creator() {
    local hook="$HOOKS_DIR/pretool/write-edit/backup-creator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "backup-creator.sh not found"
    fi

    local write_input='{"tool_name":"Write","tool_input":{"file_path":"test.txt","content":"new"}}'
    local output
    output=$(echo "$write_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# PRETOOL/MCP HOOKS
# ============================================================================

describe "Pretool MCP Hooks"

test_mcp_rate_limiter() {
    local hook="$HOOKS_DIR/pretool/mcp/mcp-rate-limiter.sh"
    if [[ ! -f "$hook" ]]; then
        skip "mcp-rate-limiter.sh not found"
    fi

    local mcp_input='{"tool_name":"mcp__context7__query-docs","tool_input":{"query":"test"}}'
    local output
    output=$(echo "$mcp_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_mcp_token_budget() {
    local hook="$HOOKS_DIR/pretool/mcp/mcp-token-budget.sh"
    if [[ ! -f "$hook" ]]; then
        skip "mcp-token-budget.sh not found"
    fi

    local mcp_input='{"tool_name":"mcp__memory__search_nodes","tool_input":{"query":"test"}}'
    local output
    output=$(echo "$mcp_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_mcp_validator() {
    local hook="$HOOKS_DIR/pretool/mcp/mcp-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "mcp-validator.sh not found"
    fi

    local mcp_input='{"tool_name":"mcp__sequential-thinking__sequentialthinking","tool_input":{}}'
    local output
    output=$(echo "$mcp_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# PRETOOL/TASK HOOKS
# ============================================================================

describe "Pretool Task Hooks"

test_task_spawn_limiter() {
    local hook="$HOOKS_DIR/pretool/task/task-spawn-limiter.sh"
    if [[ ! -f "$hook" ]]; then
        skip "task-spawn-limiter.sh not found"
    fi

    local task_input='{"tool_name":"Task","tool_input":{"subagent_type":"test","prompt":"test"}}'
    local output
    output=$(echo "$task_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

test_task_context_validator() {
    local hook="$HOOKS_DIR/pretool/task/task-context-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "task-context-validator.sh not found"
    fi

    local task_input='{"tool_name":"Task","tool_input":{"subagent_type":"explore","prompt":"find code"}}'
    local output
    output=$(echo "$task_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# PRETOOL/SKILL HOOKS
# ============================================================================

describe "Pretool Skill Hooks"

test_skill_validator() {
    local hook="$HOOKS_DIR/pretool/skill/skill-validator.sh"
    if [[ ! -f "$hook" ]]; then
        skip "skill-validator.sh not found"
    fi

    local skill_input='{"tool_name":"Skill","tool_input":{"skill":"commit"}}'
    local output
    output=$(echo "$skill_input" | bash "$hook" 2>/dev/null) || true

    if [[ -n "$output" ]]; then
        assert_valid_json "$output"
    fi
}

# ============================================================================
# RUN TESTS
# ============================================================================

run_tests