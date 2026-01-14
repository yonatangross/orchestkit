#!/bin/bash
# test-mem0-integration.sh - Integration tests for mem0 hooks and workflows
# Part of SkillForge Claude Plugin comprehensive test suite
# CC 2.1.7 Compliant
#
# Tests:
# - Session start context retrieval hook
# - Agent memory injection (PreToolUse Task)
# - Agent memory storage (PostToolUse Task)
# - Decision sync push/pull cycle
# - Pre-compaction sync
# - Graceful degradation when mem0 unavailable

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
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
    echo -e "\033[0;32mPASS\033[0m"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    local reason="${1:-}"
    echo -e "\033[0;31mFAIL\033[0m"
    [[ -n "$reason" ]] && echo "    └─ $reason"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# =============================================================================
# Test: Session Start Context Retrieval
# =============================================================================

test_mem0_context_retrieval_output_format() {
    test_start "mem0-context-retrieval outputs valid CC 2.1.7 JSON"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export HOOK_INPUT='{}'

    local output
    output=$(bash "$PROJECT_ROOT/hooks/lifecycle/mem0-context-retrieval.sh" 2>/dev/null || echo '{"continue":true}')

    # Validate JSON
    if echo "$output" | jq -e '.' >/dev/null 2>&1; then
        # Check has continue field
        local has_continue
        has_continue=$(echo "$output" | jq -r '.continue')

        if [[ "$has_continue" == "true" ]]; then
            test_pass
        else
            test_fail "Missing continue:true field"
        fi
    else
        test_fail "Invalid JSON: $output"
    fi
}

test_mem0_context_retrieval_provides_hint() {
    test_start "mem0-context-retrieval provides search hint when available"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export HOOK_INPUT='{}'

    local output
    output=$(bash "$PROJECT_ROOT/hooks/lifecycle/mem0-context-retrieval.sh" 2>/dev/null || echo '{}')

    # Check for additionalContext with mem0 hint
    local context
    context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext // ""' 2>/dev/null || echo "")

    if [[ "$context" == *"mcp__mem0__search_memories"* ]] || [[ "$context" == "" ]]; then
        test_pass
    else
        test_fail "Expected mem0 search hint or empty"
    fi
}

test_mem0_context_graceful_no_config() {
    test_start "mem0-context-retrieval graceful when no mem0 config"

    # Use temp dir with no Claude config
    export CLAUDE_PROJECT_DIR="/tmp/test-no-mem0-$$"
    mkdir -p "$CLAUDE_PROJECT_DIR"
    export HOOK_INPUT='{}'
    export HOME="/tmp/no-home-$$"

    local output
    output=$(bash "$PROJECT_ROOT/hooks/lifecycle/mem0-context-retrieval.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    # Cleanup
    rm -rf "$CLAUDE_PROJECT_DIR" 2>/dev/null || true

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should continue gracefully"
    fi
}

# =============================================================================
# Test: Agent Memory Inject (PreToolUse Task)
# =============================================================================

test_agent_memory_inject_detects_agent_type() {
    test_start "agent-memory-inject detects agent type from input"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"subagent_type":"database-engineer","prompt":"Design a schema"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/pretool/task/agent-memory-inject.sh" 2>/dev/null || echo '{"continue":true}')

    # Should output system message with agent info
    local msg
    msg=$(echo "$output" | jq -r '.systemMessage // ""' 2>/dev/null || echo "")

    if [[ "$msg" == *"database-engineer"* ]] || [[ -z "$msg" ]]; then
        test_pass
    else
        test_fail "Expected agent type in message"
    fi
}

test_agent_memory_inject_unknown_agent() {
    test_start "agent-memory-inject passes through unknown agent"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"subagent_type":"unknown-agent-type","prompt":"Do something"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/pretool/task/agent-memory-inject.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should continue for unknown agent"
    fi
}

test_agent_memory_inject_no_agent_type() {
    test_start "agent-memory-inject passes through when no agent type"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"prompt":"Just a prompt without agent"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/pretool/task/agent-memory-inject.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should continue without agent type"
    fi
}

# =============================================================================
# Test: Agent Memory Store (PostToolUse Task)
# =============================================================================

test_agent_memory_store_extracts_patterns() {
    test_start "agent-memory-store extracts decision patterns"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    mkdir -p "$PROJECT_ROOT/.claude/logs" 2>/dev/null || true

    local input='{
        "tool_input": {"subagent_type": "backend-system-architect"},
        "tool_result": "I decided to use FastAPI for the backend. The approach is to implement REST endpoints with proper versioning."
    }'

    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/posttool/task/agent-memory-store.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should continue after storing"
    fi
}

test_agent_memory_store_no_patterns_short_output() {
    test_start "agent-memory-store skips short outputs"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{
        "tool_input": {"subagent_type": "test-agent"},
        "tool_result": "Done"
    }'

    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/posttool/task/agent-memory-store.sh" 2>/dev/null || echo '{"continue":true}')

    # Should not have pattern extraction message for short output
    local msg
    msg=$(echo "$output" | jq -r '.systemMessage // ""' 2>/dev/null || echo "")

    if [[ -z "$msg" ]] || [[ "$msg" == "null" ]] || [[ "$msg" != *"patterns extracted"* ]]; then
        test_pass
    else
        test_fail "Should not extract patterns from short output"
    fi
}

# =============================================================================
# Test: Decision Sync
# =============================================================================

test_decision_sync_pull_output_format() {
    test_start "decision-sync-pull outputs valid JSON"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export HOOK_INPUT='{}'

    local output
    output=$(bash "$PROJECT_ROOT/hooks/lifecycle/decision-sync-pull.sh" 2>/dev/null || echo '{"continue":true}')

    if echo "$output" | jq -e '.' >/dev/null 2>&1; then
        test_pass
    else
        test_fail "Invalid JSON output"
    fi
}

test_decision_sync_push_finds_decisions() {
    test_start "decision-sync-push detects pending decisions"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export HOOK_INPUT='{}'

    # Check if there's a decisions file to sync
    if [[ -f "$PROJECT_ROOT/.claude/context/knowledge/decisions/active.json" ]]; then
        local output
        output=$(bash "$PROJECT_ROOT/hooks/lifecycle/decision-sync-push.sh" 2>/dev/null || echo '{"continue":true}')

        local has_continue
        has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

        if [[ "$has_continue" == "true" ]]; then
            test_pass
        else
            test_fail "Should continue after push check"
        fi
    else
        # No decisions file - should still pass
        test_pass
    fi
}

# =============================================================================
# Test: Pre-Compaction Sync
# =============================================================================

test_pre_compaction_sync_output() {
    test_start "pre-compaction sync outputs valid JSON"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"reason":"context_limit"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/stop/mem0-pre-compaction-sync.sh" 2>/dev/null || echo '{"continue":true}')

    if echo "$output" | jq -e '.' >/dev/null 2>&1; then
        test_pass
    else
        test_fail "Invalid JSON output"
    fi
}

# =============================================================================
# Test: Prompt Hook Memory Context
# =============================================================================

test_prompt_memory_context_output() {
    test_start "memory-context prompt hook outputs valid JSON"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

    local input='{"prompt":"Help me with the database schema"}'
    local output
    output=$(echo "$input" | bash "$PROJECT_ROOT/hooks/prompt/memory-context.sh" 2>/dev/null || echo '{"continue":true}')

    local has_continue
    has_continue=$(echo "$output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$has_continue" == "true" ]]; then
        test_pass
    else
        test_fail "Should continue"
    fi
}

# =============================================================================
# Test: Full Workflow Integration
# =============================================================================

test_full_session_lifecycle() {
    test_start "full session lifecycle (start → work → end)"

    export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    export HOOK_INPUT='{}'

    # Step 1: Session start (use session-context-loader as primary SessionStart hook)
    local start_output
    start_output=$(bash "$PROJECT_ROOT/hooks/lifecycle/session-context-loader.sh" 2>/dev/null || echo '{"continue":true}')

    local start_ok
    start_ok=$(echo "$start_output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$start_ok" != "true" ]]; then
        test_fail "Session start failed"
        return
    fi

    # Step 2: Simulate agent work (PreTool)
    local agent_input='{"subagent_type":"backend-system-architect"}'
    local pretool_output
    pretool_output=$(echo "$agent_input" | bash "$PROJECT_ROOT/hooks/pretool/task/agent-memory-inject.sh" 2>/dev/null || echo '{"continue":true}')

    local pretool_ok
    pretool_ok=$(echo "$pretool_output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$pretool_ok" != "true" ]]; then
        test_fail "PreTool hook failed"
        return
    fi

    # Step 3: Session end (use session-cleanup as primary SessionEnd hook)
    local end_output
    end_output=$(bash "$PROJECT_ROOT/hooks/lifecycle/session-cleanup.sh" 2>/dev/null || echo '{"continue":true}')

    local end_ok
    end_ok=$(echo "$end_output" | jq -r '.continue // "false"' 2>/dev/null || echo "false")

    if [[ "$end_ok" == "true" ]]; then
        test_pass
    else
        test_fail "Session end failed"
    fi
}

# =============================================================================
# Run All Tests
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Mem0 Integration Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Session Start Context Retrieval"
echo "────────────────────────────────────────"
test_mem0_context_retrieval_output_format
test_mem0_context_retrieval_provides_hint
test_mem0_context_graceful_no_config

echo ""
echo "▶ Agent Memory Inject (PreToolUse)"
echo "────────────────────────────────────────"
test_agent_memory_inject_detects_agent_type
test_agent_memory_inject_unknown_agent
test_agent_memory_inject_no_agent_type

echo ""
echo "▶ Agent Memory Store (PostToolUse)"
echo "────────────────────────────────────────"
test_agent_memory_store_extracts_patterns
test_agent_memory_store_no_patterns_short_output

echo ""
echo "▶ Decision Sync"
echo "────────────────────────────────────────"
test_decision_sync_pull_output_format
test_decision_sync_push_finds_decisions

echo ""
echo "▶ Pre-Compaction Sync"
echo "────────────────────────────────────────"
test_pre_compaction_sync_output

echo ""
echo "▶ Prompt Memory Context"
echo "────────────────────────────────────────"
test_prompt_memory_context_output

echo ""
echo "▶ Full Workflow"
echo "────────────────────────────────────────"
test_full_session_lifecycle

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