#!/bin/bash
# test-mem0-cross-hook-integration.sh - Cross-hook integration tests for Mem0 hooks
# Part of OrchestKit Claude Plugin comprehensive test suite
#
# Tests how multiple mem0 hooks work together in realistic sequences,
# simulating actual Claude Code lifecycle events in order.
#
# Each test fires hooks in the ORDER they would execute during a real
# Claude Code session, verifying the full chain works end-to-end.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

HOOK_RUNNER="$PROJECT_ROOT/src/hooks/bin/run-hook.mjs"
DIST_DIR="$PROJECT_ROOT/src/hooks/dist"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# =============================================================================
# Test Helper Functions
# =============================================================================

test_start() {
    local name="$1"
    echo -n "  o $name... "
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
    echo -e "\033[0;32mPASS\033[0m"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    local reason="${1:-}"
    echo -e "\033[0;31mFAIL\033[0m"
    [[ -n "$reason" ]] && echo "    ^-- $reason"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

test_skip() {
    local reason="${1:-}"
    echo -e "\033[0;33mSKIP\033[0m"
    [[ -n "$reason" ]] && echo "    ^-- $reason"
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

# Portable timeout: use timeout (Linux) or gtimeout (macOS/coreutils), else fallback
TIMEOUT_CMD=""
if command -v timeout &>/dev/null; then
    TIMEOUT_CMD="timeout"
elif command -v gtimeout &>/dev/null; then
    TIMEOUT_CMD="gtimeout"
fi

# Run a hook with JSON input on stdin and capture stdout.
# Usage: run_hook <hook-name> <json-input>
# Returns: sets HOOK_OUTPUT and HOOK_EXIT_CODE
run_hook() {
    local hook_name="$1"
    local json_input="$2"
    HOOK_OUTPUT=""
    HOOK_EXIT_CODE=0

    if [[ -n "$TIMEOUT_CMD" ]]; then
        HOOK_OUTPUT=$(echo "$json_input" | $TIMEOUT_CMD 15 node "$HOOK_RUNNER" "$hook_name" 2>/dev/null) || HOOK_EXIT_CODE=$?
    else
        # Fallback: run without timeout but kill after 15s via background watchdog
        local tmp_out
        tmp_out=$(mktemp)
        echo "$json_input" | node "$HOOK_RUNNER" "$hook_name" >"$tmp_out" 2>/dev/null &
        local pid=$!
        (sleep 15 && kill "$pid" 2>/dev/null) &
        local watchdog=$!
        wait "$pid" 2>/dev/null
        HOOK_EXIT_CODE=$?
        kill "$watchdog" 2>/dev/null
        wait "$watchdog" 2>/dev/null
        HOOK_OUTPUT=$(cat "$tmp_out")
        rm -f "$tmp_out"
    fi
}

# Assert that HOOK_OUTPUT is valid JSON. Returns 0 on success.
assert_valid_json() {
    if echo "$HOOK_OUTPUT" | jq empty 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Assert a jq expression evaluates to "true" against HOOK_OUTPUT.
# Usage: assert_jq '.continue == true'
assert_jq() {
    local expr="$1"
    local result
    result=$(echo "$HOOK_OUTPUT" | jq -r "$expr" 2>/dev/null)
    if [[ "$result" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

echo "============================================================================"
echo " Mem0 Cross-Hook Integration Tests"
echo "============================================================================"
echo ""

# =============================================================================
# Prerequisite Checks
# =============================================================================

if ! command -v node &>/dev/null; then
    echo "ERROR: node is not installed. Cannot run hook execution tests."
    exit 1
fi

if ! command -v jq &>/dev/null; then
    echo "ERROR: jq is not installed. Cannot validate hook JSON output."
    exit 1
fi

if [[ ! -f "$HOOK_RUNNER" ]]; then
    echo "ERROR: Hook runner not found at $HOOK_RUNNER"
    exit 1
fi

# =============================================================================
# Sequence 1: Session Start Chain
# =============================================================================

echo "--- Sequence 1: Session Start Chain ---"

test_session_start_chain() {
    test_start "session start chain (backup-setup -> cleanup -> context-retrieval -> analytics-tracker)"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"
    mkdir -p "$tmp_dir/.claude/context/session"

    local chain_success=0
    local chain_total=4

    # Step 1: setup/mem0-backup-setup
    local setup_input
    setup_input=$(cat <<ENDJSON
{
  "hook_event": "Setup",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-chain-start-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "setup/mem0-backup-setup" "$setup_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        chain_success=$((chain_success + 1))
    fi

    # Step 2: setup/mem0-cleanup
    run_hook "setup/mem0-cleanup" "$setup_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        chain_success=$((chain_success + 1))
    fi

    # Step 3: lifecycle/mem0-context-retrieval
    local lifecycle_input
    lifecycle_input=$(cat <<ENDJSON
{
  "hook_event": "SessionStart",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-chain-start-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "lifecycle/mem0-context-retrieval" "$lifecycle_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        chain_success=$((chain_success + 1))
    fi

    # Step 4: lifecycle/mem0-analytics-tracker
    run_hook "lifecycle/mem0-analytics-tracker" "$lifecycle_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        chain_success=$((chain_success + 1))
    fi

    rm -rf "$tmp_dir"

    if [[ $chain_success -eq $chain_total ]]; then
        test_pass
    else
        test_fail "Only $chain_success/$chain_total hooks succeeded in chain"
    fi
}

test_session_start_chain
echo ""

# =============================================================================
# Sequence 2: Memory Tool Usage Chain (PreTool -> PostTool)
# =============================================================================

echo "--- Sequence 2: Memory Tool Usage Chain ---"

test_memory_tool_pretool_posttool_chain() {
    test_start "memory tool chain (fabric-init -> validator -> [exec] -> memory-bridge)"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"

    local chain_success=0
    local chain_total=3

    # Step 1: pretool/mcp/memory-fabric-init (first memory MCP call triggers init)
    local pretool_input
    pretool_input=$(cat <<ENDJSON
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__mem0__add_memory",
  "tool_input": {
    "text": "We decided to use PostgreSQL with pgvector for RAG applications",
    "user_id": "test-project-decisions"
  },
  "session_id": "test-chain-tool-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "pretool/mcp/memory-fabric-init" "$pretool_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        chain_success=$((chain_success + 1))
    fi

    # Step 2: pretool/mcp/memory-validator (validates the operation)
    # memory-validator checks mcp__memory__* tools, so use a graph tool for validation
    local validator_input
    validator_input=$(cat <<'ENDJSON'
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__memory__create_entities",
  "tool_input": {
    "entities": [
      {"name": "PostgreSQL", "entityType": "Technology", "observations": ["Used for data storage"]},
      {"name": "pgvector", "entityType": "Technology", "observations": ["Used for RAG"]}
    ]
  },
  "session_id": "test-chain-tool-001",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "pretool/mcp/memory-validator" "$validator_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        chain_success=$((chain_success + 1))
    fi

    # Step 3: posttool/memory-bridge (after tool execution completes)
    local posttool_input
    posttool_input=$(cat <<'ENDJSON'
{
  "hook_event": "PostToolUse",
  "tool_name": "mcp__mem0__add_memory",
  "tool_input": {
    "text": "We decided to use PostgreSQL with pgvector for RAG applications"
  },
  "tool_result": "{\"id\": \"mem-123\", \"status\": \"created\"}",
  "session_id": "test-chain-tool-001",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "posttool/memory-bridge" "$posttool_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        chain_success=$((chain_success + 1))
    fi

    rm -rf "$tmp_dir"

    if [[ $chain_success -eq $chain_total ]]; then
        test_pass
    else
        test_fail "Only $chain_success/$chain_total hooks succeeded in pretool->posttool chain"
    fi
}

test_memory_tool_pretool_posttool_chain
echo ""

# =============================================================================
# Sequence 3: Memory Validator Gate
# =============================================================================

echo "--- Sequence 3: Memory Validator Gate ---"

test_validator_blocks_then_allows() {
    test_start "validator gates: bulk delete warns, small delete passes, search passes"

    local gate_success=0
    local gate_total=3

    # Gate 1: Bulk delete (>5 entities) should produce a systemMessage warning
    local bulk_delete_input
    bulk_delete_input=$(cat <<'ENDJSON'
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__memory__delete_entities",
  "tool_input": {
    "entityNames": ["e1", "e2", "e3", "e4", "e5", "e6", "e7"]
  },
  "session_id": "test-gate-001",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "pretool/mcp/memory-validator" "$bulk_delete_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true and (.systemMessage | length) > 0'; then
        gate_success=$((gate_success + 1))
    fi

    # Gate 2: Small delete (2 entities) should pass silently without warning
    local small_delete_input
    small_delete_input=$(cat <<'ENDJSON'
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__memory__delete_entities",
  "tool_input": {
    "entityNames": ["e1", "e2"]
  },
  "session_id": "test-gate-002",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "pretool/mcp/memory-validator" "$small_delete_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        # Verify NO systemMessage warning
        local has_system_msg
        has_system_msg=$(echo "$HOOK_OUTPUT" | jq -r 'if .systemMessage and (.systemMessage | length) > 0 then "yes" else "no" end' 2>/dev/null)
        if [[ "$has_system_msg" == "no" ]]; then
            gate_success=$((gate_success + 1))
        fi
    fi

    # Gate 3: Search operation should pass silently
    local search_input
    search_input=$(cat <<'ENDJSON'
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__memory__search_nodes",
  "tool_input": {
    "query": "database patterns"
  },
  "session_id": "test-gate-003",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "pretool/mcp/memory-validator" "$search_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true and .suppressOutput == true'; then
        gate_success=$((gate_success + 1))
    fi

    if [[ $gate_success -eq $gate_total ]]; then
        test_pass
    else
        test_fail "Only $gate_success/$gate_total gate checks passed"
    fi
}

test_validator_blocks_then_allows
echo ""

# =============================================================================
# Sequence 4: Subagent Lifecycle
# =============================================================================

echo "--- Sequence 4: Subagent Lifecycle ---"

test_subagent_memory_lifecycle() {
    test_start "subagent lifecycle (agent-memory-inject -> [work] -> agent-memory-store)"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"
    mkdir -p "$tmp_dir/.claude/session"

    local lifecycle_success=0
    local lifecycle_total=2

    # Step 1: SubagentStart - agent-memory-inject
    local start_input
    start_input=$(cat <<'ENDJSON'
{
  "hook_event": "SubagentStart",
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "database-engineer",
    "prompt": "design the schema for user authentication"
  },
  "session_id": "test-subagent-001",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "subagent-start/agent-memory-inject" "$start_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        lifecycle_success=$((lifecycle_success + 1))
    fi

    # Step 2: SubagentStop - agent-memory-store (with decision patterns in output)
    local orig_project_dir="${CLAUDE_PROJECT_DIR:-}"
    export CLAUDE_PROJECT_DIR="$tmp_dir"

    local stop_input
    stop_input=$(cat <<ENDJSON
{
  "hook_event": "SubagentStop",
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "database-engineer"
  },
  "subagent_type": "database-engineer",
  "tool_result": "We decided to use cursor-based pagination for the listings endpoint because offset pagination does not scale well for large datasets. We chose PostgreSQL as our database for ACID compliance.",
  "session_id": "test-subagent-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "subagent-stop/agent-memory-store" "$stop_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        lifecycle_success=$((lifecycle_success + 1))
    fi

    # Restore original CLAUDE_PROJECT_DIR
    if [[ -n "$orig_project_dir" ]]; then
        export CLAUDE_PROJECT_DIR="$orig_project_dir"
    else
        export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    fi

    rm -rf "$tmp_dir"

    if [[ $lifecycle_success -eq $lifecycle_total ]]; then
        test_pass
    else
        test_fail "Only $lifecycle_success/$lifecycle_total lifecycle hooks succeeded"
    fi
}

test_subagent_memory_lifecycle
echo ""

# =============================================================================
# Sequence 5: Session End Chain
# =============================================================================

echo "--- Sequence 5: Session End Chain ---"

test_session_end_chain() {
    test_start "session end chain (pre-compaction-sync detects pending decisions)"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"
    mkdir -p "$tmp_dir/.claude/context/session"
    mkdir -p "$tmp_dir/.claude/coordination"

    # Create a decision log with 2 pending decisions
    cat > "$tmp_dir/.claude/coordination/decision-log.json" <<'ENDJSON'
{
  "decisions": [
    {"decision_id": "dec-001", "text": "Use PostgreSQL for primary storage", "timestamp": "2026-01-27T10:00:00Z"},
    {"decision_id": "dec-002", "text": "Implement cursor-based pagination", "timestamp": "2026-01-27T10:05:00Z"}
  ]
}
ENDJSON

    # Create a session state file with a current task
    cat > "$tmp_dir/.claude/context/session/state.json" <<'ENDJSON'
{
  "current_task": "Implementing database schema for authentication module"
}
ENDJSON

    # Set CLAUDE_PLUGIN_ROOT so the hook finds the decision log
    local orig_plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
    export CLAUDE_PLUGIN_ROOT="$tmp_dir"

    local stop_input
    stop_input=$(cat <<ENDJSON
{
  "hook_event": "Stop",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-end-chain-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "stop/mem0-pre-compaction-sync" "$stop_input"

    # Restore original CLAUDE_PLUGIN_ROOT
    if [[ -n "$orig_plugin_root" ]]; then
        export CLAUDE_PLUGIN_ROOT="$orig_plugin_root"
    else
        unset CLAUDE_PLUGIN_ROOT
    fi

    rm -rf "$tmp_dir"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # The hook should detect pending decisions and/or current task, producing a systemMessage
    if assert_jq '.continue == true and (.systemMessage | length) > 0'; then
        # Verify the systemMessage mentions sync-related content
        local msg_content
        msg_content=$(echo "$HOOK_OUTPUT" | jq -r '.systemMessage' 2>/dev/null)
        if echo "$msg_content" | grep -qi -E "sync|decision|pattern|session"; then
            test_pass
        else
            test_fail "systemMessage does not mention sync/decision/pattern: $msg_content"
        fi
    else
        test_fail "Expected systemMessage about pending sync but got: $HOOK_OUTPUT"
    fi
}

test_session_end_chain
echo ""

# =============================================================================
# Sequence 6: Prompt -> Memory Context Flow
# =============================================================================

echo "--- Sequence 6: Prompt -> Memory Context Flow ---"

test_prompt_triggers_memory_context() {
    test_start "prompt classifier (memory keyword triggers, short prompt silent, pattern keyword triggers)"

    local prompt_success=0
    local prompt_total=3

    # Prompt 1: Contains "remember" + "decision" keywords, long enough -> triggers memory context
    # Note: memory-context currently returns silent success always (Claude already has tools),
    # but it should still return continue:true and not block
    local memory_prompt_input
    memory_prompt_input=$(cat <<'ENDJSON'
{
  "hook_event": "UserPromptSubmit",
  "prompt": "remember the decision about TypeScript migration we made last time for the backend",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-prompt-001",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "prompt/memory-context" "$memory_prompt_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        prompt_success=$((prompt_success + 1))
    fi

    # Prompt 2: Short prompt "hello" -> silent success (< 20 chars, no trigger)
    local short_prompt_input
    short_prompt_input=$(cat <<'ENDJSON'
{
  "hook_event": "UserPromptSubmit",
  "prompt": "hello",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-prompt-002",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "prompt/memory-context" "$short_prompt_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true and .suppressOutput == true'; then
        prompt_success=$((prompt_success + 1))
    fi

    # Prompt 3: Contains "pattern" keyword, long enough -> triggers memory context
    local pattern_prompt_input
    pattern_prompt_input=$(cat <<'ENDJSON'
{
  "hook_event": "UserPromptSubmit",
  "prompt": "what pattern did we use before for handling authentication in the API layer",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-prompt-003",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "prompt/memory-context" "$pattern_prompt_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        prompt_success=$((prompt_success + 1))
    fi

    if [[ $prompt_success -eq $prompt_total ]]; then
        test_pass
    else
        test_fail "Only $prompt_success/$prompt_total prompt checks passed"
    fi
}

test_prompt_triggers_memory_context
echo ""

# =============================================================================
# Sequence 7: Full Session Lifecycle
# =============================================================================

echo "--- Sequence 7: Full Session Lifecycle (10-hook chain) ---"

test_full_session_lifecycle() {
    test_start "full session lifecycle (setup -> lifecycle -> prompt -> pretool -> posttool -> subagent -> stop)"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"
    mkdir -p "$tmp_dir/.claude/context/session"
    mkdir -p "$tmp_dir/.claude/session"
    mkdir -p "$tmp_dir/.claude/coordination"

    local orig_project_dir="${CLAUDE_PROJECT_DIR:-}"
    export CLAUDE_PROJECT_DIR="$tmp_dir"

    local total_hooks=10
    local hooks_passed=0

    # --- Phase 1: Setup hooks ---

    local setup_input
    setup_input=$(cat <<ENDJSON
{
  "hook_event": "Setup",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-full-lifecycle-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    # Hook 1: setup/mem0-backup-setup
    run_hook "setup/mem0-backup-setup" "$setup_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        hooks_passed=$((hooks_passed + 1))
    fi

    # Hook 2: setup/mem0-cleanup
    run_hook "setup/mem0-cleanup" "$setup_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        hooks_passed=$((hooks_passed + 1))
    fi

    # --- Phase 2: Lifecycle hooks ---

    local lifecycle_input
    lifecycle_input=$(cat <<ENDJSON
{
  "hook_event": "SessionStart",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-full-lifecycle-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    # Hook 3: lifecycle/mem0-context-retrieval
    run_hook "lifecycle/mem0-context-retrieval" "$lifecycle_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        hooks_passed=$((hooks_passed + 1))
    fi

    # Hook 4: lifecycle/mem0-analytics-tracker
    run_hook "lifecycle/mem0-analytics-tracker" "$lifecycle_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        hooks_passed=$((hooks_passed + 1))
    fi

    # --- Phase 3: Prompt hook ---

    local prompt_input
    prompt_input=$(cat <<'ENDJSON'
{
  "hook_event": "UserPromptSubmit",
  "prompt": "implement authentication using JWT tokens with refresh token rotation",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-full-lifecycle-001",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    # Hook 5: prompt/memory-context
    run_hook "prompt/memory-context" "$prompt_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        hooks_passed=$((hooks_passed + 1))
    fi

    # --- Phase 4: PreToolUse hooks (memory search) ---

    local pretool_init_input
    pretool_init_input=$(cat <<ENDJSON
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__memory__search_nodes",
  "tool_input": {
    "query": "authentication JWT patterns"
  },
  "session_id": "test-full-lifecycle-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    # Hook 6: pretool/mcp/memory-fabric-init
    run_hook "pretool/mcp/memory-fabric-init" "$pretool_init_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        hooks_passed=$((hooks_passed + 1))
    fi

    # Hook 7: pretool/mcp/memory-validator
    run_hook "pretool/mcp/memory-validator" "$pretool_init_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        hooks_passed=$((hooks_passed + 1))
    fi

    # --- Phase 5: PostToolUse hook ---

    local posttool_input
    posttool_input=$(cat <<'ENDJSON'
{
  "hook_event": "PostToolUse",
  "tool_name": "mcp__memory__create_entities",
  "tool_input": {
    "entities": [
      {"name": "JWT", "entityType": "Technology", "observations": ["Used for authentication"]}
    ]
  },
  "session_id": "test-full-lifecycle-001",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    # Hook 8: posttool/memory-bridge
    run_hook "posttool/memory-bridge" "$posttool_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        hooks_passed=$((hooks_passed + 1))
    fi

    # --- Phase 6: Subagent hooks ---

    local subagent_start_input
    subagent_start_input=$(cat <<'ENDJSON'
{
  "hook_event": "SubagentStart",
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "security-auditor",
    "prompt": "audit the JWT authentication implementation"
  },
  "session_id": "test-full-lifecycle-001",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    # Hook 9: subagent-start/agent-memory-inject
    run_hook "subagent-start/agent-memory-inject" "$subagent_start_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        hooks_passed=$((hooks_passed + 1))
    fi

    # Create patterns log so pre-compaction-sync has something to find
    cat > "$tmp_dir/.claude/logs/agent-patterns.jsonl" <<'ENDJSON'
{"agent":"security-auditor","agent_id":"ork:security-auditor","pattern":"recommends using httpOnly cookies for JWT refresh tokens","project":"test","timestamp":"2026-01-27T10:00:00Z","category":"security","pending_sync":true}
ENDJSON

    # Set CLAUDE_PLUGIN_ROOT for pre-compaction-sync
    local orig_plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
    export CLAUDE_PLUGIN_ROOT="$tmp_dir"

    # Create a session state for pre-compaction-sync to detect
    cat > "$tmp_dir/.claude/context/session/state.json" <<'ENDJSON'
{
  "current_task": "Implementing JWT authentication with refresh token rotation"
}
ENDJSON

    local stop_input
    stop_input=$(cat <<ENDJSON
{
  "hook_event": "Stop",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-full-lifecycle-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    # Hook 10: stop/mem0-pre-compaction-sync
    run_hook "stop/mem0-pre-compaction-sync" "$stop_input"
    if [[ $HOOK_EXIT_CODE -eq 0 ]] && assert_valid_json && assert_jq '.continue == true'; then
        hooks_passed=$((hooks_passed + 1))
    fi

    # Restore environment
    if [[ -n "$orig_plugin_root" ]]; then
        export CLAUDE_PLUGIN_ROOT="$orig_plugin_root"
    else
        unset CLAUDE_PLUGIN_ROOT
    fi

    if [[ -n "$orig_project_dir" ]]; then
        export CLAUDE_PROJECT_DIR="$orig_project_dir"
    else
        export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
    fi

    rm -rf "$tmp_dir"

    if [[ $hooks_passed -eq $total_hooks ]]; then
        test_pass
    else
        test_fail "Only $hooks_passed/$total_hooks hooks returned continue:true in full lifecycle"
    fi
}

test_full_session_lifecycle
echo ""

# =============================================================================
# Summary
# =============================================================================

echo "============================================================================"
echo " Results: $TESTS_PASSED passed, $TESTS_FAILED failed, $TESTS_SKIPPED skipped (of $TESTS_RUN total)"
echo "============================================================================"

if [[ $TESTS_FAILED -gt 0 ]]; then
    exit 1
fi

exit 0
