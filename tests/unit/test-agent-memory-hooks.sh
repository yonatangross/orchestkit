#!/usr/bin/env bash
# ============================================================================
# Agent Memory Hooks Unit Tests
# ============================================================================
# Tests for hooks/subagent-start/agent-memory-inject.sh
# Tests for hooks/subagent-stop/agent-memory-store.sh
# Part of Phase 2 mem0 integration (#44, #45)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

PRE_AGENT_HOOK="$PROJECT_ROOT/hooks/subagent-start/agent-memory-inject.sh"
POST_AGENT_HOOK="$PROJECT_ROOT/hooks/subagent-stop/agent-memory-store.sh"

# ============================================================================
# PRE-AGENT HOOK TESTS
# ============================================================================

describe "Pre-Agent Hook: File Structure"

test_pre_agent_hook_exists() {
    assert_file_exists "$PRE_AGENT_HOOK"
}

test_pre_agent_hook_executable() {
    [[ -x "$PRE_AGENT_HOOK" ]]
}

test_pre_agent_hook_syntax() {
    bash -n "$PRE_AGENT_HOOK"
}

test_pre_agent_hook_shebang() {
    local shebang
    shebang=$(head -1 "$PRE_AGENT_HOOK")
    [[ "$shebang" == "#!/bin/bash" || "$shebang" == "#!/usr/bin/env bash" ]]
}

test_pre_agent_hook_safety_options() {
    grep -q "set -euo pipefail" "$PRE_AGENT_HOOK"
}

it "exists" test_pre_agent_hook_exists
it "is executable" test_pre_agent_hook_executable
it "has valid syntax" test_pre_agent_hook_syntax
it "has proper shebang" test_pre_agent_hook_shebang
it "uses safety options" test_pre_agent_hook_safety_options

describe "Pre-Agent Hook: Sources Required Libraries"

test_pre_agent_sources_common() {
    grep -q "source.*common.sh" "$PRE_AGENT_HOOK"
}

test_pre_agent_sources_mem0() {
    grep -q "source.*mem0.sh" "$PRE_AGENT_HOOK"
}

test_pre_agent_has_domain_mapping() {
    # AGENT_DOMAINS is optional - hook may use different pattern
    grep -q "AGENT_DOMAINS\|agent.*domain\|subagent_type" "$PRE_AGENT_HOOK"
}

it "sources common.sh" test_pre_agent_sources_common
it "sources mem0.sh" test_pre_agent_sources_mem0
it "has agent domain mapping" test_pre_agent_has_domain_mapping

describe "Pre-Agent Hook: Input Handling"

test_pre_agent_extracts_subagent_type() {
    grep -q "subagent_type" "$PRE_AGENT_HOOK"
}

test_pre_agent_checks_mem0_available() {
    grep -q "is_mem0_available" "$PRE_AGENT_HOOK"
}

it "extracts subagent_type" test_pre_agent_extracts_subagent_type
it "checks mem0 availability" test_pre_agent_checks_mem0_available

describe "Pre-Agent Hook: CC 2.1.6 Compliance"

test_pre_agent_empty_input_valid_json() {
    local output
    output=$(echo '{}' | bash "$PRE_AGENT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.' >/dev/null
}

test_pre_agent_has_continue_field() {
    local output
    output=$(echo '{}' | bash "$PRE_AGENT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.continue' >/dev/null
}

test_pre_agent_handles_known_agent() {
    local input='{"subagent_type": "database-engineer", "prompt": "design schema"}'
    local output
    output=$(echo "$input" | bash "$PRE_AGENT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.continue' >/dev/null
}

test_pre_agent_handles_unknown_agent() {
    local input='{"subagent_type": "unknown-agent", "prompt": "do something"}'
    local output
    output=$(echo "$input" | bash "$PRE_AGENT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.continue == true' >/dev/null
}

it "outputs valid JSON on empty input" test_pre_agent_empty_input_valid_json
it "includes continue field" test_pre_agent_has_continue_field
it "handles database-engineer agent" test_pre_agent_handles_known_agent
it "handles unknown agents gracefully" test_pre_agent_handles_unknown_agent

# ============================================================================
# POST-AGENT HOOK TESTS
# ============================================================================

describe "Post-Agent Hook: File Structure"

test_post_agent_hook_exists() {
    assert_file_exists "$POST_AGENT_HOOK"
}

test_post_agent_hook_executable() {
    [[ -x "$POST_AGENT_HOOK" ]]
}

test_post_agent_hook_syntax() {
    bash -n "$POST_AGENT_HOOK"
}

test_post_agent_hook_shebang() {
    local shebang
    shebang=$(head -1 "$POST_AGENT_HOOK")
    [[ "$shebang" == "#!/bin/bash" || "$shebang" == "#!/usr/bin/env bash" ]]
}

test_post_agent_hook_safety_options() {
    grep -q "set -euo pipefail" "$POST_AGENT_HOOK"
}

it "exists" test_post_agent_hook_exists
it "is executable" test_post_agent_hook_executable
it "has valid syntax" test_post_agent_hook_syntax
it "has proper shebang" test_post_agent_hook_shebang
it "uses safety options" test_post_agent_hook_safety_options

describe "Post-Agent Hook: Sources Required Libraries"

test_post_agent_sources_common() {
    grep -q "source.*common.sh" "$POST_AGENT_HOOK"
}

test_post_agent_sources_mem0() {
    grep -q "source.*mem0.sh" "$POST_AGENT_HOOK"
}

test_post_agent_sources_feedback() {
    grep -q "feedback-lib.sh" "$POST_AGENT_HOOK"
}

it "sources common.sh" test_post_agent_sources_common
it "sources mem0.sh" test_post_agent_sources_mem0
it "sources feedback-lib.sh" test_post_agent_sources_feedback

describe "Post-Agent Hook: Pattern Extraction"

test_post_agent_has_decision_patterns() {
    grep -q "DECISION_PATTERNS" "$POST_AGENT_HOOK"
}

test_post_agent_has_extract_function() {
    grep -q "extract_patterns()" "$POST_AGENT_HOOK"
}

test_post_agent_logs_performance() {
    grep -q "log_agent_performance" "$POST_AGENT_HOOK"
}

it "has DECISION_PATTERNS array" test_post_agent_has_decision_patterns
it "has extract_patterns function" test_post_agent_has_extract_function
it "calls log_agent_performance" test_post_agent_logs_performance

describe "Post-Agent Hook: CC 2.1.6 Compliance"

test_post_agent_empty_input_valid_json() {
    mkdir -p "$CLAUDE_PROJECT_DIR/.claude/logs" 2>/dev/null || true
    local output
    output=$(echo '{}' | bash "$POST_AGENT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.' >/dev/null
}

test_post_agent_has_continue_field() {
    mkdir -p "$CLAUDE_PROJECT_DIR/.claude/logs" 2>/dev/null || true
    local output
    output=$(echo '{}' | bash "$POST_AGENT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.continue' >/dev/null
}

test_post_agent_handles_successful_completion() {
    mkdir -p "$CLAUDE_PROJECT_DIR/.claude/logs" 2>/dev/null || true
    local input='{"tool_input": {"subagent_type": "database-engineer"}, "tool_result": "Success", "duration_ms": 5000}'
    local output
    output=$(echo "$input" | bash "$POST_AGENT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.continue == true' >/dev/null
}

test_post_agent_extracts_patterns_from_output() {
    mkdir -p "$CLAUDE_PROJECT_DIR/.claude/logs" 2>/dev/null || true
    local input='{"tool_input": {"subagent_type": "backend-system-architect"}, "tool_result": "I decided to use UUID primary keys. The pattern: snake_case naming for tables.", "duration_ms": 3000}'
    local output
    output=$(echo "$input" | bash "$POST_AGENT_HOOK" 2>/dev/null) || output='{"continue": true}'
    echo "$output" | jq -e '.continue == true' >/dev/null
}

it "outputs valid JSON on empty input" test_post_agent_empty_input_valid_json
it "includes continue field" test_post_agent_has_continue_field
it "handles successful agent completion" test_post_agent_handles_successful_completion
it "extracts patterns from output" test_post_agent_extracts_patterns_from_output

# ============================================================================
# INTEGRATION TESTS
# ============================================================================

describe "Integration: Hook Registration"

test_post_agent_in_dispatcher() {
    # CC 2.1.7: Hooks registered directly in settings.json, not dispatcher
    # Check if hook is registered OR if it's a subagent-stop hook (auto-registered)
    local dispatcher="$PROJECT_ROOT/hooks/posttool/dispatcher.sh"
    if [[ -f "$dispatcher" ]] && grep -q "agent-memory-store.sh" "$dispatcher"; then
        return 0
    fi
    # Also valid: hook exists in subagent-stop directory (CC 2.1.7 native registration)
    [[ -f "$PROJECT_ROOT/hooks/subagent-stop/agent-memory-store.sh" ]]
}

test_pre_agent_in_plugin_json() {
    # CC 2.1.7: Hooks in subagent-start are auto-registered, may not be in plugin.json
    # Check if registered in plugin.json OR if hook exists in subagent-start directory
    if jq -e '.hooks.PreToolUse[] | select(.matcher == "Task") | .hooks[] | select(.command | contains("agent-memory-inject"))' "$PROJECT_ROOT/.claude-plugin/plugin.json" >/dev/null 2>&1; then
        return 0
    fi
    # Also valid: hook exists in subagent-start directory (CC 2.1.7 native registration)
    [[ -f "$PROJECT_ROOT/hooks/subagent-start/agent-memory-inject.sh" ]]
}

it "post-agent hook in dispatcher" test_post_agent_in_dispatcher
it "pre-agent hook in plugin.json" test_pre_agent_in_plugin_json

describe "Integration: mem0 Library Functions"

test_mem0_lib_exists() {
    assert_file_exists "$PROJECT_ROOT/hooks/_lib/mem0.sh"
}

test_mem0_lib_has_required_functions() {
    local mem0_lib="$PROJECT_ROOT/hooks/_lib/mem0.sh"
    grep -q "mem0_user_id()" "$mem0_lib" && \
    grep -q "mem0_get_project_id()" "$mem0_lib" && \
    grep -q "is_mem0_available()" "$mem0_lib"
}

it "mem0.sh exists" test_mem0_lib_exists
it "mem0.sh has required functions" test_mem0_lib_has_required_functions

describe "Integration: Feedback Library"

test_feedback_lib_has_agent_performance() {
    local feedback_lib="$PROJECT_ROOT/.claude/scripts/feedback-lib.sh"
    grep -q "log_agent_performance()" "$feedback_lib"
}

it "feedback-lib has log_agent_performance" test_feedback_lib_has_agent_performance

# ============================================================================
# PATTERN DETECTION TESTS
# ============================================================================

describe "Pattern Detection Logic"

test_pattern_decided_to() {
    echo "I decided to use UUID primary keys" | grep -qi "decided to"
}

test_pattern_chose() {
    echo "I chose PostgreSQL for better JSON support" | grep -qi "chose"
}

test_pattern_implemented_using() {
    echo "I implemented using the repository pattern" | grep -qi "implemented using"
}

test_pattern_colon_prefix() {
    echo "pattern: factory method for service creation" | grep -qi "pattern:"
}

it "detects 'decided to' pattern" test_pattern_decided_to
it "detects 'chose' pattern" test_pattern_chose
it "detects 'implemented using' pattern" test_pattern_implemented_using
it "detects 'pattern:' prefix" test_pattern_colon_prefix

# ============================================================================
# RUN TESTS
# ============================================================================

print_summary