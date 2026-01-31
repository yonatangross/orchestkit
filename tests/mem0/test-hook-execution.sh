#!/bin/bash
# test-hook-execution.sh - Actual hook execution tests for Mem0-related hooks
# Part of OrchestKit Claude Plugin comprehensive test suite
#
# Unlike other test files that grep source, this file EXECUTES compiled hooks
# via node and validates their JSON output against expected behavior.
#
# Hooks are compiled into split bundles at src/hooks/dist/
# The hook runner at src/hooks/bin/run-hook.mjs reads JSON from stdin,
# dispatches to the correct bundle, and writes JSON to stdout.

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

test_skip() {
    local reason="${1:-}"
    echo -e "\033[0;33mSKIP\033[0m"
    [[ -n "$reason" ]] && echo "    └─ $reason"
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
        HOOK_OUTPUT=$(echo "$json_input" | $TIMEOUT_CMD 10 node "$HOOK_RUNNER" "$hook_name" 2>/dev/null) || HOOK_EXIT_CODE=$?
    else
        # Fallback: run without timeout but kill after 10s via background watchdog
        local tmp_out
        tmp_out=$(mktemp)
        echo "$json_input" | node "$HOOK_RUNNER" "$hook_name" >"$tmp_out" 2>/dev/null &
        local pid=$!
        (sleep 10 && kill "$pid" 2>/dev/null) &
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

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Mem0 Hook Execution Tests (actual hook execution)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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

# =============================================================================
# Test: Hook Runner Exists
# =============================================================================

test_hook_runner_exists() {
    test_start "hook runner run-hook.mjs exists and is a valid file"

    if [[ -f "$HOOK_RUNNER" ]]; then
        # Verify it starts with a shebang or is a valid JS module
        local first_line
        first_line=$(head -n1 "$HOOK_RUNNER")
        if [[ "$first_line" == "#!/usr/bin/env node"* ]] || [[ "$first_line" == *"import"* ]]; then
            test_pass
        else
            test_fail "run-hook.mjs exists but does not appear to be a valid node script"
        fi
    else
        test_fail "src/hooks/bin/run-hook.mjs not found"
    fi
}

# =============================================================================
# Test: Hook Bundles Exist
# =============================================================================

test_hook_bundles_exist() {
    test_start "all 11 split bundles exist in dist/"

    local expected_bundles=(
        "permission"
        "pretool"
        "posttool"
        "prompt"
        "lifecycle"
        "stop"
        "subagent"
        "notification"
        "setup"
        "skill"
        "agent"
    )

    local missing=()
    for bundle in "${expected_bundles[@]}"; do
        if [[ ! -f "$DIST_DIR/${bundle}.mjs" ]]; then
            missing+=("$bundle")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        test_pass
    else
        test_fail "Missing bundles: ${missing[*]}"
    fi
}

# =============================================================================
# Test: Hook Runner Returns Silent Success With No Args
# =============================================================================

test_hook_runner_no_args() {
    test_start "hook runner returns silent success with no hook name"

    HOOK_OUTPUT=""
    HOOK_EXIT_CODE=0
    HOOK_OUTPUT=$(echo '{}' | node "$HOOK_RUNNER" 2>/dev/null) || HOOK_EXIT_CODE=$?

    if assert_valid_json && assert_jq '.continue == true'; then
        test_pass
    else
        test_fail "Expected {\"continue\":true,...} but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Memory Context Returns JSON (UserPromptSubmit)
# =============================================================================

test_memory_context_returns_json() {
    test_start "memory-context hook returns valid JSON for triggering prompt"

    local input
    input=$(cat <<'ENDJSON'
{
  "hook_event": "UserPromptSubmit",
  "prompt": "implement a new feature for the authentication system",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-session-001",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "prompt/memory-context" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    if assert_jq '.continue == true'; then
        test_pass
    else
        test_fail "Expected continue=true but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Memory Context Silent For Unrelated Prompt
# =============================================================================

test_memory_context_silent_for_unrelated() {
    test_start "memory-context hook returns silent success for short prompt"

    local input
    input=$(cat <<'ENDJSON'
{
  "hook_event": "UserPromptSubmit",
  "prompt": "hello",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-session-002",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "prompt/memory-context" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Short prompt (< 20 chars) should return silent success
    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success (continue=true, suppressOutput=true) but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Webhook Handler Returns JSON For Non-Webhook Bash
# =============================================================================

test_webhook_handler_returns_json() {
    test_start "webhook handler returns silent success for non-webhook Bash command"

    local input
    input=$(cat <<'ENDJSON'
{
  "hook_event": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "ls -la"
  },
  "tool_result": "",
  "session_id": "test-session-003",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "posttool/mem0-webhook-handler" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Webhook Handler Processes Event
# =============================================================================

test_webhook_handler_processes_event() {
    test_start "webhook handler processes webhook-receiver.py event"

    local event_payload='{"event_type": "memory.created", "memory_id": "test-123"}'
    local input
    input=$(cat <<ENDJSON
{
  "hook_event": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "python3 webhook-receiver.py --listen"
  },
  "tool_result": "$event_payload",
  "session_id": "test-session-004",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "posttool/mem0-webhook-handler" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Webhook handler logs the event and returns silent success
    if assert_jq '.continue == true'; then
        test_pass
    else
        test_fail "Expected continue=true but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Memory Validator Allows Reads
# =============================================================================

test_memory_validator_allows_reads() {
    test_start "memory-validator allows search_memories (read operation)"

    local input
    input=$(cat <<'ENDJSON'
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__memory__search_nodes",
  "tool_input": {
    "query": "database patterns"
  },
  "session_id": "test-session-005",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "pretool/mcp/memory-validator" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    if assert_jq '.continue == true'; then
        test_pass
    else
        test_fail "Expected continue=true for read operation but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Memory Validator Warns Bulk Delete
# =============================================================================

test_memory_validator_warns_bulk_delete() {
    test_start "memory-validator warns on bulk entity delete (>5 entities)"

    local input
    input=$(cat <<'ENDJSON'
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__memory__delete_entities",
  "tool_input": {
    "entityNames": ["entity1", "entity2", "entity3", "entity4", "entity5", "entity6", "entity7"]
  },
  "session_id": "test-session-006",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "pretool/mcp/memory-validator" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Should return continue=true but with a systemMessage warning
    if assert_jq '.continue == true and (.systemMessage | length) > 0'; then
        test_pass
    else
        test_fail "Expected warning message for bulk delete but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Pre-Compaction Sync No Pending
# =============================================================================

test_pre_compaction_sync_no_pending() {
    test_start "pre-compaction-sync returns silent success with no pending items"

    # Create a temporary project dir with no pending decisions or patterns
    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"
    mkdir -p "$tmp_dir/.claude/context/session"

    # Set CLAUDE_PLUGIN_ROOT to the temp dir so it finds no decision log
    local orig_plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
    export CLAUDE_PLUGIN_ROOT="$tmp_dir"

    local input
    input=$(cat <<ENDJSON
{
  "hook_event": "Stop",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-session-007",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "stop/mem0-pre-compaction-sync" "$input"

    # Restore original CLAUDE_PLUGIN_ROOT
    if [[ -n "$orig_plugin_root" ]]; then
        export CLAUDE_PLUGIN_ROOT="$orig_plugin_root"
    else
        unset CLAUDE_PLUGIN_ROOT
    fi

    # Clean up temp dir
    rm -rf "$tmp_dir"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # No pending decisions/patterns and no current task means silent success
    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success (no pending items) but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Memory Fabric Init Returns JSON
# =============================================================================

test_memory_fabric_init_returns_json() {
    test_start "memory-fabric-init returns valid JSON for MCP tool use"

    # Create a temporary project dir for init
    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"

    local input
    input=$(cat <<ENDJSON
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__memory__search_nodes",
  "tool_input": {
    "query": "test"
  },
  "session_id": "test-session-008",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "pretool/mcp/memory-fabric-init" "$input"

    # Clean up temp dir
    rm -rf "$tmp_dir"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Should return continue=true (either silent success or with context)
    if assert_jq '.continue == true'; then
        test_pass
    else
        test_fail "Expected continue=true but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Memory Bridge Returns Silent Success For Non-Memory Tool
# =============================================================================

test_memory_bridge_non_memory_tool() {
    test_start "memory-bridge returns silent success for non-memory tool"

    local input
    input=$(cat <<'ENDJSON'
{
  "hook_event": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "echo hello"
  },
  "session_id": "test-session-009",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "posttool/memory-bridge" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success for non-memory tool but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Memory Validator Allows Entity Creation With Valid Data
# =============================================================================

test_memory_validator_allows_valid_entities() {
    test_start "memory-validator allows create_entities with valid data"

    local input
    input=$(cat <<'ENDJSON'
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__memory__create_entities",
  "tool_input": {
    "entities": [
      {"name": "PostgreSQL", "entityType": "Technology", "observations": ["Used for data storage"]},
      {"name": "FastAPI", "entityType": "Technology", "observations": ["Web framework"]}
    ]
  },
  "session_id": "test-session-010",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "pretool/mcp/memory-validator" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Valid entities should pass without warning
    if assert_jq '.continue == true'; then
        # Additionally verify there is no warning in systemMessage
        local has_warning
        has_warning=$(echo "$HOOK_OUTPUT" | jq -r 'if .systemMessage then "yes" else "no" end' 2>/dev/null)
        if [[ "$has_warning" == "no" ]]; then
            test_pass
        else
            test_fail "Expected no warning for valid entities but got systemMessage: $HOOK_OUTPUT"
        fi
    else
        test_fail "Expected continue=true but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Run All Tests
# =============================================================================

echo "--- Infrastructure ---"
test_hook_runner_exists
test_hook_bundles_exist
test_hook_runner_no_args
echo ""

echo "--- Prompt Hooks (UserPromptSubmit) ---"
test_memory_context_returns_json
test_memory_context_silent_for_unrelated
echo ""

echo "--- PostToolUse Hooks ---"
test_webhook_handler_returns_json
test_webhook_handler_processes_event
test_memory_bridge_non_memory_tool
echo ""

echo "--- PreToolUse Hooks ---"
test_memory_validator_allows_reads
test_memory_validator_warns_bulk_delete
test_memory_validator_allows_valid_entities
test_memory_fabric_init_returns_json
echo ""

echo "--- Stop Hooks ---"
test_pre_compaction_sync_no_pending
echo ""

# =============================================================================
# Test: Analytics Tracker Returns JSON (SessionStart / Lifecycle)
# =============================================================================

test_analytics_tracker_returns_json() {
    test_start "mem0-analytics-tracker returns valid JSON for SessionStart event"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"

    local input
    input=$(cat <<ENDJSON
{
  "hook_event": "SessionStart",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-session-analytics-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "lifecycle/mem0-analytics-tracker" "$input"

    rm -rf "$tmp_dir"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Without MEM0_API_KEY, the hook degrades gracefully to silent success
    if assert_jq '.continue == true'; then
        test_pass
    else
        test_fail "Expected continue=true but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Context Retrieval Returns JSON (SessionStart / Lifecycle)
# =============================================================================

test_context_retrieval_returns_json() {
    test_start "mem0-context-retrieval returns valid JSON for SessionStart event"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"

    local input
    input=$(cat <<ENDJSON
{
  "hook_event": "SessionStart",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-session-retrieval-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "lifecycle/mem0-context-retrieval" "$input"

    rm -rf "$tmp_dir"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Without MEM0_API_KEY, should return silent success (graceful degradation)
    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success (continue=true, suppressOutput=true) but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Webhook Setup Returns JSON (SessionStart / Lifecycle)
# =============================================================================

test_webhook_setup_returns_json() {
    test_start "mem0-webhook-setup returns valid JSON for SessionStart event"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude"

    local input
    input=$(cat <<ENDJSON
{
  "hook_event": "SessionStart",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-session-webhook-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "lifecycle/mem0-webhook-setup" "$input"

    rm -rf "$tmp_dir"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Without MEM0_API_KEY, should return silent success
    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Agent Memory Inject Returns JSON (SubagentStart)
# =============================================================================

test_agent_memory_inject_returns_json() {
    test_start "agent-memory-inject returns valid JSON for SubagentStart event"

    local input
    input=$(cat <<'ENDJSON'
{
  "hook_event": "SubagentStart",
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "test-generator",
    "prompt": "generate tests for the auth module"
  },
  "session_id": "test-session-inject-001",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "subagent-start/agent-memory-inject" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Should return continue=true regardless of mem0 availability
    if assert_jq '.continue == true'; then
        test_pass
    else
        test_fail "Expected continue=true but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Agent Memory Inject Silent For No Agent Type
# =============================================================================

test_agent_memory_inject_no_agent_type() {
    test_start "agent-memory-inject returns silent success when no agent type provided"

    local input
    input=$(cat <<'ENDJSON'
{
  "hook_event": "SubagentStart",
  "tool_name": "Task",
  "tool_input": {
    "prompt": "do something generic"
  },
  "session_id": "test-session-inject-002",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "subagent-start/agent-memory-inject" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # No agent type detected means silent success passthrough
    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success (no agent type) but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Agent Memory Store Returns JSON (SubagentStop)
# =============================================================================

test_agent_memory_store_returns_json() {
    test_start "agent-memory-store returns valid JSON for SubagentStop event"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"
    mkdir -p "$tmp_dir/.claude/session"

    # Provide agent output with a decision pattern so patterns are extracted
    local input
    input=$(cat <<ENDJSON
{
  "hook_event": "SubagentStop",
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "database-engineer"
  },
  "subagent_type": "database-engineer",
  "tool_result": "We decided to use cursor-based pagination for the listings endpoint because offset pagination does not scale well for large datasets. We chose PostgreSQL as our database for ACID compliance.",
  "session_id": "test-session-store-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    # Set CLAUDE_PROJECT_DIR so getProjectDir() resolves correctly
    local orig_project_dir="${CLAUDE_PROJECT_DIR:-}"
    export CLAUDE_PROJECT_DIR="$tmp_dir"

    run_hook "subagent-stop/agent-memory-store" "$input"

    # Restore original CLAUDE_PROJECT_DIR
    if [[ -n "$orig_project_dir" ]]; then
        export CLAUDE_PROJECT_DIR="$orig_project_dir"
    else
        export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
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

    # With patterns in the output, should return continue=true with a systemMessage
    if assert_jq '.continue == true'; then
        test_pass
    else
        test_fail "Expected continue=true but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Agent Memory Store Silent For No Agent Type (SubagentStop)
# =============================================================================

test_agent_memory_store_no_agent_type() {
    test_start "agent-memory-store returns silent success when no agent type provided"

    local input
    input=$(cat <<'ENDJSON'
{
  "hook_event": "SubagentStop",
  "tool_name": "Task",
  "tool_input": {},
  "tool_result": "Some generic output",
  "session_id": "test-session-store-002",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

    run_hook "subagent-stop/agent-memory-store" "$input"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # No agent type means silent success
    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success (no agent type) but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Backup Setup Returns JSON (Setup)
# =============================================================================

test_backup_setup_returns_json() {
    test_start "mem0-backup-setup returns valid JSON for Setup event"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude"

    local input
    input=$(cat <<ENDJSON
{
  "hook_event": "Setup",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-session-backup-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "setup/mem0-backup-setup" "$input"

    rm -rf "$tmp_dir"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Without MEM0_API_KEY, should return silent success
    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Cleanup Returns JSON (Setup)
# =============================================================================

test_cleanup_returns_json() {
    test_start "mem0-cleanup returns valid JSON for Setup event"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"

    local input
    input=$(cat <<ENDJSON
{
  "hook_event": "Setup",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-session-cleanup-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "setup/mem0-cleanup" "$input"

    rm -rf "$tmp_dir"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Without MEM0_API_KEY, should return silent success
    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Test: Analytics Dashboard Returns JSON (Setup)
# =============================================================================

test_analytics_dashboard_returns_json() {
    test_start "mem0-analytics-dashboard returns valid JSON for Setup event"

    local tmp_dir
    tmp_dir=$(mktemp -d)
    mkdir -p "$tmp_dir/.claude/logs"

    local input
    input=$(cat <<ENDJSON
{
  "hook_event": "Setup",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-session-dashboard-001",
  "project_dir": "$tmp_dir"
}
ENDJSON
)

    run_hook "setup/mem0-analytics-dashboard" "$input"

    rm -rf "$tmp_dir"

    if [[ $HOOK_EXIT_CODE -ne 0 ]]; then
        test_fail "Hook exited with code $HOOK_EXIT_CODE"
        return
    fi

    if ! assert_valid_json; then
        test_fail "Output is not valid JSON: $HOOK_OUTPUT"
        return
    fi

    # Without MEM0_API_KEY, should return silent success
    if assert_jq '.continue == true and .suppressOutput == true'; then
        test_pass
    else
        test_fail "Expected silent success but got: $HOOK_OUTPUT"
    fi
}

# =============================================================================
# Run New Tests
# =============================================================================

echo "--- Lifecycle Hooks (SessionStart) ---"
test_analytics_tracker_returns_json
test_context_retrieval_returns_json
test_webhook_setup_returns_json
echo ""

echo "--- Subagent Hooks (SubagentStart / SubagentStop) ---"
test_agent_memory_inject_returns_json
test_agent_memory_inject_no_agent_type
test_agent_memory_store_returns_json
test_agent_memory_store_no_agent_type
echo ""

echo "--- Setup Hooks ---"
test_backup_setup_returns_json
test_cleanup_returns_json
test_analytics_dashboard_returns_json
echo ""

# =============================================================================
# Summary
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Results: $TESTS_PASSED passed, $TESTS_FAILED failed, $TESTS_SKIPPED skipped (of $TESTS_RUN total)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $TESTS_FAILED -gt 0 ]]; then
    exit 1
fi

exit 0
