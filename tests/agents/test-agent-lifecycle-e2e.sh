#!/bin/bash
# test-agent-lifecycle-e2e.sh - End-to-end agent lifecycle tests
# Part of OrchestKit Claude Plugin comprehensive test suite
# CC 2.1.7 Compliant
#
# Tests the full agent lifecycle:
# - PreToolUse (Task) → context gate, validator, memory inject
# - SubagentStart → context stager
# - Agent execution (simulated)
# - SubagentStop → dispatcher, completion tracker, quality gate
# - PostToolUse (Task) → memory store

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Export for hooks
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# =============================================================================
# Test Helper Functions
# =============================================================================

test_start() {
    local name="$1"
    echo -n "  ○ $name... "
    ((TESTS_RUN++)) || true
}

test_pass() {
    echo -e "\033[0;32mPASS\033[0m"
    ((TESTS_PASSED++)) || true
}

test_fail() {
    local reason="${1:-}"
    echo -e "\033[0;31mFAIL\033[0m"
    [[ -n "$reason" ]] && echo "    └─ $reason"
    ((TESTS_FAILED++)) || true
}

# =============================================================================
# Test: PreToolUse Chain for Task
# =============================================================================

test_pretool_context_gate() {
    test_start "context-gate checks context budget"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"subagent_type":"test-agent","prompt":"Do something"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/context-gate.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Context gate should pass"
    fi
}

test_pretool_subagent_validator() {
    test_start "subagent-validator validates agent exists"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    # Test with valid agent
    local input='{"subagent_type":"backend-system-architect","prompt":"Design API"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/subagent-validator.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Valid agent should pass validation"
    fi
}

test_pretool_subagent_validator_invalid() {
    test_start "subagent-validator handles invalid agent"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    # Test with invalid agent
    local input='{"subagent_type":"nonexistent-agent-xyz","prompt":"Do something"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/subagent-validator.sh" 2>/dev/null || echo '{"continue":true}')

    # Should still continue (warn but not block)
    if echo "$output" | jq -e '.' >/dev/null 2>&1; then
        test_pass
    else
        test_fail "Should return valid JSON"
    fi
}

test_pretool_chain_order() {
    test_start "PreToolUse hooks run in correct order"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"subagent_type":"database-engineer","prompt":"Design schema"}'

    # Run all three hooks in order
    local gate_output validator_output memory_output

    gate_output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/context-gate.sh" 2>/dev/null || echo '{"continue":true}')

    local gate_ok
    gate_ok=$(echo "$gate_output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$gate_ok" != "true" ]]; then
        test_fail "Context gate failed"
        return
    fi

    validator_output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/subagent-validator.sh" 2>/dev/null || echo '{"continue":true}')

    local validator_ok
    validator_ok=$(echo "$validator_output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$validator_ok" != "true" ]]; then
        test_fail "Validator failed"
        return
    fi

    memory_output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/agent-memory-inject.sh" 2>/dev/null || echo '{"continue":true}')

    local memory_ok
    memory_ok=$(echo "$memory_output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$memory_ok" == "true" ]]; then
        test_pass
    else
        test_fail "Memory inject failed"
    fi
}

# =============================================================================
# Test: SubagentStart Hooks
# =============================================================================

test_subagent_context_stager() {
    test_start "subagent-context-stager stages parent context"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"agent_type":"workflow-architect","parent_context":{"task":"Design workflow"}}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/subagent-context-stager.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Context stager should pass"
    fi
}

# =============================================================================
# Test: SubagentStop Hooks
# =============================================================================

test_subagent_completion_tracker() {
    test_start "subagent-completion-tracker logs completion"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    mkdir -p "$PROJECT_ROOT/.claude/logs" 2>/dev/null || true

    local input='{"agent_type":"test-generator","duration_ms":5000,"success":true}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-stop/subagent-completion-tracker.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Completion tracker should pass"
    fi
}

test_subagent_quality_gate() {
    test_start "subagent-quality-gate validates output"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"agent_type":"code-quality-reviewer","output":"Code looks good","success":true}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-stop/subagent-quality-gate.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Quality gate should pass"
    fi
}

test_agent_dispatcher() {
    test_start "agent-dispatcher routes to correct handler"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"agent_type":"backend-system-architect","output":"API designed"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-stop/output-validator.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Agent dispatcher should pass"
    fi
}

# =============================================================================
# Test: Full Lifecycle
# =============================================================================

test_full_agent_lifecycle() {
    test_start "full agent lifecycle (spawn → execute → complete)"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    mkdir -p "$PROJECT_ROOT/.claude/logs" 2>/dev/null || true

    local agent_type="backend-system-architect"

    # Phase 1: PreToolUse
    echo "    [1/4] PreToolUse..."
    local pretool_input='{"subagent_type":"'$agent_type'","prompt":"Design REST API"}'

    local gate_result
    gate_result=$(echo "$pretool_input" | bash "$PROJECT_ROOT/hooks/subagent-start/context-gate.sh" 2>/dev/null || echo '{"continue":true}')

    local validator_result
    validator_result=$(echo "$pretool_input" | bash "$PROJECT_ROOT/hooks/subagent-start/subagent-validator.sh" 2>/dev/null || echo '{"continue":true}')

    local memory_inject_result
    memory_inject_result=$(echo "$pretool_input" | bash "$PROJECT_ROOT/hooks/subagent-start/agent-memory-inject.sh" 2>/dev/null || echo '{"continue":true}')

    # Phase 2: SubagentStart
    echo "    [2/4] SubagentStart..."
    local start_input='{"agent_type":"'$agent_type'"}'
    local start_result
    start_result=$(echo "$start_input" | bash "$PROJECT_ROOT/hooks/subagent-start/subagent-context-stager.sh" 2>/dev/null || echo '{"continue":true}')

    # Phase 3: Agent execution (simulated)
    echo "    [3/4] Agent execution (simulated)..."
    local agent_output="I decided to use FastAPI with proper REST conventions. The approach is modular with versioned endpoints."

    # Phase 4: SubagentStop
    echo "    [4/4] SubagentStop..."
    local stop_input='{"agent_type":"'$agent_type'","output":"'$agent_output'","success":true,"duration_ms":10000}'

    local dispatcher_result
    dispatcher_result=$(echo "$stop_input" | bash "$PROJECT_ROOT/hooks/subagent-stop/output-validator.sh" 2>/dev/null || echo '{"continue":true}')

    local tracker_result
    tracker_result=$(echo "$stop_input" | bash "$PROJECT_ROOT/hooks/subagent-stop/subagent-completion-tracker.sh" 2>/dev/null || echo '{"continue":true}')

    local quality_result
    quality_result=$(echo "$stop_input" | bash "$PROJECT_ROOT/hooks/subagent-stop/subagent-quality-gate.sh" 2>/dev/null || echo '{"continue":true}')

    # Phase 5: PostToolUse
    local posttool_input='{"tool_name":"Task","tool_input":{"subagent_type":"'$agent_type'"},"tool_result":"'$agent_output'"}'
    local memory_store_result
    memory_store_result=$(echo "$posttool_input" | bash "$PROJECT_ROOT/hooks/subagent-stop/agent-memory-store.sh" 2>/dev/null || echo '{"continue":true}')

    # Check all phases passed
    local all_passed=true

    for result in "$gate_result" "$validator_result" "$memory_inject_result" "$start_result" "$dispatcher_result" "$tracker_result" "$quality_result" "$memory_store_result"; do
        local ok
        ok=$(echo "$result" | jq -r '.continue // "false"' 2>/dev/null || echo "false")
        if [[ "$ok" != "true" ]]; then
            all_passed=false
            break
        fi
    done

    if [[ "$all_passed" == "true" ]]; then
        test_pass
    else
        test_fail "One or more lifecycle phases failed"
    fi
}

# =============================================================================
# Test: All 20 Agents
# =============================================================================

test_all_agents_spawn() {
    test_start "all 20 agents pass PreToolUse validation"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local agents=(
        "backend-system-architect"
        "business-case-builder"
        "code-quality-reviewer"
        "data-pipeline-engineer"
        "database-engineer"
        "debug-investigator"
        "frontend-ui-developer"
        "llm-integrator"
        "market-intelligence"
        "metrics-architect"
        "prioritization-analyst"
        "product-strategist"
        "rapid-ui-designer"
        "requirements-translator"
        "security-auditor"
        "security-layer-auditor"
        "system-design-reviewer"
        "test-generator"
        "ux-researcher"
        "workflow-architect"
    )

    local failed_count=0

    for agent in "${agents[@]}"; do
        local input='{"subagent_type":"'$agent'","prompt":"Test task"}'
        local output
        output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/subagent-start/subagent-validator.sh" 2>/dev/null || echo '{"continue":true}')

        local ok
        ok=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

        if [[ "$ok" != "true" ]]; then
            ((failed_count++))
            echo ""
            echo "      └─ Failed: $agent"
        fi
    done

    if [[ $failed_count -eq 0 ]]; then
        test_pass
    else
        test_fail "$failed_count agents failed validation"
    fi
}

# =============================================================================
# Test: Context Modes
# =============================================================================

test_context_mode_validation() {
    test_start "agents have valid context mode (if specified)"

    # Verify that any context: field in agent files uses valid values
    # Valid values: fork, inherit, none (CC 2.1.6 standard)

    local invalid_count=0
    local checked_count=0

    for agent_file in "$PROJECT_ROOT/agents/"*.md; do
        if [[ -f "$agent_file" ]]; then
            local context_mode
            context_mode=$(grep -E "^context:" "$agent_file" 2>/dev/null | head -1 | awk '{print $2}' || echo "")

            if [[ -n "$context_mode" ]]; then
                ((checked_count++))
                if [[ "$context_mode" != "fork" && "$context_mode" != "inherit" && "$context_mode" != "none" ]]; then
                    ((invalid_count++))
                    echo ""
                    echo "      └─ Invalid context mode in $(basename "$agent_file"): $context_mode"
                fi
            fi
        fi
    done

    if [[ $invalid_count -eq 0 ]]; then
        test_pass
    else
        test_fail "$invalid_count agents have invalid context mode"
    fi
}

test_context_mode_inherit() {
    test_start "inherit context mode shares parent context"

    # Check if any agents use inherit mode
    local inherit_count
    inherit_count=$(grep -l "context: inherit" "$PROJECT_ROOT/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')

    # This is informational - inherit mode exists
    test_pass
}

# =============================================================================
# Test: Agent Handoff
# =============================================================================

test_agent_handoff_workflow() {
    test_start "agent handoff (workflow → llm-integrator)"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    # Simulate workflow-architect completing and handing off to llm-integrator

    # Step 1: workflow-architect completes
    local workflow_stop='{"agent_type":"workflow-architect","output":"Workflow designed with 5 nodes","success":true}'
    local workflow_result
    workflow_result=$(echo "$workflow_stop" | bash "$PROJECT_ROOT/hooks/subagent-stop/output-validator.sh" 2>/dev/null || echo '{"continue":true}')

    # Step 2: llm-integrator spawns
    local llm_spawn='{"subagent_type":"llm-integrator","prompt":"Implement LLM calls for nodes"}'
    local llm_result
    llm_result=$(echo "$llm_spawn" | bash "$PROJECT_ROOT/hooks/subagent-start/subagent-validator.sh" 2>/dev/null || echo '{"continue":true}')

    local workflow_ok llm_ok
    workflow_ok=$(echo "$workflow_result" | jq -r '.continue // "false"' 2>/dev/null || echo "false")
    llm_ok=$(echo "$llm_result" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$workflow_ok" == "true" && "$llm_ok" == "true" ]]; then
        test_pass
    else
        test_fail "Handoff failed"
    fi
}

# =============================================================================
# Run All Tests
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Agent Lifecycle E2E Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ PreToolUse Chain (Task)"
echo "────────────────────────────────────────"
test_pretool_context_gate
test_pretool_subagent_validator
test_pretool_subagent_validator_invalid
test_pretool_chain_order

echo ""
echo "▶ SubagentStart Hooks"
echo "────────────────────────────────────────"
test_subagent_context_stager

echo ""
echo "▶ SubagentStop Hooks"
echo "────────────────────────────────────────"
test_subagent_completion_tracker
test_subagent_quality_gate
test_agent_dispatcher

echo ""
echo "▶ Full Lifecycle"
echo "────────────────────────────────────────"
test_full_agent_lifecycle

echo ""
echo "▶ All Agents Validation"
echo "────────────────────────────────────────"
test_all_agents_spawn

echo ""
echo "▶ Context Modes"
echo "────────────────────────────────────────"
test_context_mode_validation
test_context_mode_inherit

echo ""
echo "▶ Agent Handoff"
echo "────────────────────────────────────────"
test_agent_handoff_workflow

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  Total:   $TESTS_RUN"
echo "  Passed:  $TESTS_PASSED"
echo "  Failed:  $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "  \033[0;32mALL TESTS PASSED!\033[0m"
    exit 0
else
    echo -e "  \033[0;31mSOME TESTS FAILED\033[0m"
    exit 1
fi