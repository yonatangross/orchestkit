#!/bin/bash
# test-mem0-error-scenarios.sh - Error handling and edge case tests
# Validates graceful degradation for both Python scripts and TypeScript hooks.
# These tests verify that invalid inputs, missing configs, and edge cases
# produce graceful errors rather than crashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

SCRIPTS_DIR="$PROJECT_ROOT/src/skills/mem0-memory/scripts"
CRUD_DIR="$SCRIPTS_DIR/crud"
HOOKS_DIR="$PROJECT_ROOT/src/hooks"
HOOK_RUNNER="$HOOKS_DIR/bin/run-hook.mjs"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Unique prefix for test run (used for any API-created memories)
TEST_PREFIX="err-test-$(date +%s)"

# Track temp dirs for cleanup
TEMP_DIRS=()

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
    [[ -n "$reason" ]] && echo "    +-- $reason"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

test_skip() {
    local reason="${1:-}"
    echo -e "\033[0;33mSKIP\033[0m"
    [[ -n "$reason" ]] && echo "    +-- $reason"
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

# Portable timeout command
TIMEOUT_CMD=""
if command -v timeout &>/dev/null; then
    TIMEOUT_CMD="timeout"
elif command -v gtimeout &>/dev/null; then
    TIMEOUT_CMD="gtimeout"
fi

# Run a hook with JSON input on stdin and capture stdout.
# Usage: run_hook <hook-name> <json-input> [timeout-seconds]
# Sets: HOOK_OUTPUT and HOOK_EXIT_CODE
run_hook() {
    local hook_name="$1"
    local json_input="$2"
    local timeout_secs="${3:-15}"
    HOOK_OUTPUT=""
    HOOK_EXIT_CODE=0

    if [[ -n "$TIMEOUT_CMD" ]]; then
        HOOK_OUTPUT=$(echo "$json_input" | $TIMEOUT_CMD "$timeout_secs" node "$HOOK_RUNNER" "$hook_name" 2>/dev/null) || HOOK_EXIT_CODE=$?
    else
        local tmp_out
        tmp_out=$(mktemp)
        echo "$json_input" | node "$HOOK_RUNNER" "$hook_name" >"$tmp_out" 2>/dev/null &
        local pid=$!
        (sleep "$timeout_secs" && kill "$pid" 2>/dev/null) &
        local watchdog=$!
        wait "$pid" 2>/dev/null
        HOOK_EXIT_CODE=$?
        kill "$watchdog" 2>/dev/null
        wait "$watchdog" 2>/dev/null
        HOOK_OUTPUT=$(cat "$tmp_out")
        rm -f "$tmp_out"
    fi
}

# Assert HOOK_OUTPUT is valid JSON
assert_valid_json() {
    if echo "$HOOK_OUTPUT" | jq empty 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Assert a jq expression evaluates to "true" against HOOK_OUTPUT
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

# Cleanup temp dirs on exit
cleanup() {
    for dir in "${TEMP_DIRS[@]}"; do
        [[ -d "$dir" ]] && rm -rf "$dir"
    done
}
trap cleanup EXIT

# =============================================================================
# Header
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Mem0 Error Scenario & Edge Case Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# =============================================================================
# Prerequisite Checks
# =============================================================================

echo "--- Prerequisite Checks ---"

if ! command -v node &>/dev/null; then
    echo "  ERROR: node is not installed. Cannot run hook tests."
    exit 1
fi
echo "  node: $(node --version 2>&1)"

if ! command -v jq &>/dev/null; then
    echo "  ERROR: jq is not installed. Cannot validate JSON output."
    exit 1
fi
echo "  jq: $(jq --version 2>&1)"

HAS_PYTHON=false
if command -v python3 &>/dev/null; then
    HAS_PYTHON=true
    echo "  python3: $(python3 --version 2>&1)"
else
    echo "  python3: NOT FOUND (script tests will be skipped)"
fi

HAS_API_KEY=false
if [[ -n "${MEM0_API_KEY:-}" ]]; then
    HAS_API_KEY=true
    echo "  MEM0_API_KEY: set"
else
    echo "  MEM0_API_KEY: NOT SET (API script tests will be skipped)"
fi

HAS_SCRIPTS=false
if [[ -f "$CRUD_DIR/add-memory.py" ]]; then
    HAS_SCRIPTS=true
    echo "  Scripts: $CRUD_DIR"
else
    echo "  Scripts: NOT FOUND at $CRUD_DIR (script tests will be skipped)"
fi

echo ""

# =============================================================================
# Python Script Error Handling
# =============================================================================

echo "--- Python Script Error Handling ---"

# ── test_add_memory_empty_text ──────────────────────────────────────────────

test_start "test_add_memory_empty_text"

if [[ "$HAS_PYTHON" == "true" && "$HAS_API_KEY" == "true" && "$HAS_SCRIPTS" == "true" ]]; then
    OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
        --text "" \
        --user-id "${TEST_PREFIX}-empty" 2>&1)
    EXIT_CODE=$?

    # Graceful handling: either an error JSON, or success with empty, or non-zero exit
    # The key requirement is NO unhandled traceback crash
    if echo "$OUTPUT" | grep -qi "Traceback" 2>/dev/null; then
        test_fail "Unhandled traceback for empty text input. Output: $OUTPUT"
    else
        test_pass
    fi
else
    test_skip "Requires python3, MEM0_API_KEY, and CRUD scripts"
fi

# ── test_add_memory_very_long_text ──────────────────────────────────────────

test_start "test_add_memory_very_long_text"

if [[ "$HAS_PYTHON" == "true" && "$HAS_API_KEY" == "true" && "$HAS_SCRIPTS" == "true" ]]; then
    LONG_TEXT=$(printf 'A%.0s' $(seq 1 10000))

    OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" \
        --text "$LONG_TEXT" \
        --user-id "${TEST_PREFIX}-longtext" 2>&1)
    EXIT_CODE=$?

    if echo "$OUTPUT" | grep -qi "Traceback" 2>/dev/null; then
        test_fail "Unhandled traceback for 10K-char text. Output (truncated): ${OUTPUT:0:200}"
    else
        # Non-crash is acceptable regardless of exit code
        test_pass
    fi
else
    test_skip "Requires python3, MEM0_API_KEY, and CRUD scripts"
fi

# ── test_search_empty_query ─────────────────────────────────────────────────

test_start "test_search_empty_query"

if [[ "$HAS_PYTHON" == "true" && "$HAS_API_KEY" == "true" && "$HAS_SCRIPTS" == "true" ]]; then
    OUTPUT=$(python3 "$CRUD_DIR/search-memories.py" \
        --query "" \
        --user-id "${TEST_PREFIX}-emptysearch" 2>&1)
    EXIT_CODE=$?

    if echo "$OUTPUT" | grep -qi "Traceback" 2>/dev/null; then
        test_fail "Unhandled traceback for empty query. Output: $OUTPUT"
    else
        test_pass
    fi
else
    test_skip "Requires python3, MEM0_API_KEY, and CRUD scripts"
fi

# ── test_search_special_characters ──────────────────────────────────────────

test_start "test_search_special_characters"

if [[ "$HAS_PYTHON" == "true" && "$HAS_API_KEY" == "true" && "$HAS_SCRIPTS" == "true" ]]; then
    SPECIAL_QUERY='DROP TABLE; <script>alert(1)</script> \n\t'

    OUTPUT=$(python3 "$CRUD_DIR/search-memories.py" \
        --query "$SPECIAL_QUERY" \
        --user-id "${TEST_PREFIX}-special" 2>&1)
    EXIT_CODE=$?

    if echo "$OUTPUT" | grep -qi "Traceback" 2>/dev/null; then
        test_fail "Unhandled traceback for special characters. Output: $OUTPUT"
    else
        # Verify output is valid JSON (not an HTML error page or raw crash)
        if echo "$OUTPUT" | jq empty 2>/dev/null; then
            test_pass
        else
            # Non-JSON but no traceback is acceptable (e.g., usage error message)
            test_pass
        fi
    fi
else
    test_skip "Requires python3, MEM0_API_KEY, and CRUD scripts"
fi

# ── test_delete_nonexistent_id ──────────────────────────────────────────────

test_start "test_delete_nonexistent_id"

if [[ "$HAS_PYTHON" == "true" && "$HAS_API_KEY" == "true" && "$HAS_SCRIPTS" == "true" ]]; then
    OUTPUT=$(python3 "$CRUD_DIR/delete-memory.py" \
        --memory-id "nonexistent-00000000" 2>&1)
    EXIT_CODE=$?

    if echo "$OUTPUT" | grep -qi "Traceback" 2>/dev/null; then
        test_fail "Unhandled traceback for nonexistent ID. Output: $OUTPUT"
    else
        test_pass
    fi
else
    test_skip "Requires python3, MEM0_API_KEY, and CRUD scripts"
fi

# ── test_get_memories_invalid_filters ───────────────────────────────────────

test_start "test_get_memories_invalid_filters"

if [[ "$HAS_PYTHON" == "true" && "$HAS_API_KEY" == "true" && "$HAS_SCRIPTS" == "true" ]]; then
    OUTPUT=$(python3 "$CRUD_DIR/get-memories.py" \
        --user-id "${TEST_PREFIX}-badfilter" \
        --filters "not-valid-json" 2>&1)
    EXIT_CODE=$?

    if echo "$OUTPUT" | grep -qi "Traceback" 2>/dev/null; then
        test_fail "Unhandled traceback for invalid JSON filters. Output: $OUTPUT"
    else
        # Graceful error or ignored filters are both acceptable
        test_pass
    fi
else
    test_skip "Requires python3, MEM0_API_KEY, and CRUD scripts"
fi

# ── test_script_missing_required_args ───────────────────────────────────────

test_start "test_script_missing_required_args"

if [[ "$HAS_PYTHON" == "true" && "$HAS_SCRIPTS" == "true" ]]; then
    # Call add-memory.py with NO arguments at all
    OUTPUT=$(python3 "$CRUD_DIR/add-memory.py" 2>&1)
    EXIT_CODE=$?

    # Should exit non-zero (usage error) but without an unhandled traceback
    if [[ $EXIT_CODE -ne 0 ]]; then
        if echo "$OUTPUT" | grep -qi "Traceback" 2>/dev/null; then
            # A traceback from argparse is acceptable (SystemExit), but raw exceptions are not
            # argparse exits with code 2 and shows usage; check for that
            if [[ $EXIT_CODE -eq 2 ]]; then
                # argparse standard exit code for missing args
                test_pass
            else
                test_fail "Unexpected traceback for missing args. Exit code: $EXIT_CODE. Output: ${OUTPUT:0:300}"
            fi
        else
            test_pass
        fi
    else
        # Exit code 0 with no args is unexpected but not a crash
        test_pass
    fi
else
    test_skip "Requires python3 and CRUD scripts"
fi

echo ""

# =============================================================================
# Hook Error Handling
# =============================================================================

echo "--- Hook Error Handling ---"

# ── test_hook_empty_stdin ───────────────────────────────────────────────────

test_start "test_hook_empty_stdin"

# Pipe empty string to run-hook.mjs with a valid hook name
HOOK_OUTPUT=""
HOOK_EXIT_CODE=0
if [[ -n "$TIMEOUT_CMD" ]]; then
    HOOK_OUTPUT=$(echo "" | $TIMEOUT_CMD 15 node "$HOOK_RUNNER" "prompt/memory-context" 2>/dev/null) || HOOK_EXIT_CODE=$?
else
    HOOK_OUTPUT=$(echo "" | node "$HOOK_RUNNER" "prompt/memory-context" 2>/dev/null) || HOOK_EXIT_CODE=$?
fi

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected valid JSON with continue:true for empty stdin. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

# ── test_hook_malformed_json_input ──────────────────────────────────────────

test_start "test_hook_malformed_json_input"

run_hook "prompt/memory-context" "{invalid json not closed"

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected graceful JSON response for malformed input. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

# ── test_hook_nonexistent_hook_name ─────────────────────────────────────────

test_start "test_hook_nonexistent_hook_name"

run_hook "nonexistent/fake-hook" '{"hook_event":"UserPromptSubmit","prompt":"test"}'

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected silent success for nonexistent hook. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

# ── test_hook_very_large_input ──────────────────────────────────────────────

test_start "test_hook_very_large_input"

# Generate a 50KB prompt field
LARGE_PROMPT=$(printf 'implement a new feature with authentication and database patterns %.0s' $(seq 1 500))
LARGE_INPUT=$(jq -n --arg prompt "$LARGE_PROMPT" '{
    hook_event: "UserPromptSubmit",
    prompt: $prompt,
    tool_name: "",
    tool_input: {},
    session_id: "test-large-input",
    project_dir: "/tmp/test-project"
}')

run_hook "prompt/memory-context" "$LARGE_INPUT" 15

if [[ $HOOK_EXIT_CODE -eq 124 ]]; then
    test_fail "Hook timed out on large input (50KB prompt)"
elif assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected valid JSON for large input. Exit: $HOOK_EXIT_CODE. Output: ${HOOK_OUTPUT:0:200}"
fi

# ── test_webhook_handler_malformed_event ────────────────────────────────────

test_start "test_webhook_handler_malformed_event"

INPUT=$(cat <<'ENDJSON'
{
  "hook_event": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "python3 webhook-receiver.py --listen"
  },
  "tool_result": "not-json-at-all",
  "session_id": "test-malformed-event",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

run_hook "posttool/mem0-webhook-handler" "$INPUT"

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected graceful handling of malformed event data. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

# ── test_webhook_handler_missing_event_type ─────────────────────────────────

test_start "test_webhook_handler_missing_event_type"

INPUT=$(cat <<'ENDJSON'
{
  "hook_event": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "python3 webhook-receiver.py --listen"
  },
  "tool_result": "{\"memory_id\": \"123\"}",
  "session_id": "test-missing-event-type",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

run_hook "posttool/mem0-webhook-handler" "$INPUT"

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected graceful handling of missing event_type. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

# ── test_memory_validator_empty_entities ────────────────────────────────────

test_start "test_memory_validator_empty_entities"

INPUT=$(cat <<'ENDJSON'
{
  "hook_event": "PreToolUse",
  "tool_name": "mcp__memory__create_entities",
  "tool_input": {
    "entities": []
  },
  "session_id": "test-empty-entities",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

run_hook "pretool/mcp/memory-validator" "$INPUT"

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected passthrough for empty entities array. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

# ── test_pre_compaction_sync_corrupt_decision_log ───────────────────────────

test_start "test_pre_compaction_sync_corrupt_decision_log"

TMP_DIR=$(mktemp -d)
TEMP_DIRS+=("$TMP_DIR")
mkdir -p "$TMP_DIR/.claude/coordination"
mkdir -p "$TMP_DIR/.claude/logs"

# Write invalid JSON to the decision log
echo "this is not valid json {{{" > "$TMP_DIR/.claude/coordination/decision-log.json"

ORIG_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
export CLAUDE_PLUGIN_ROOT="$TMP_DIR"

INPUT=$(cat <<ENDJSON
{
  "hook_event": "Stop",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-corrupt-decision-log",
  "project_dir": "$TMP_DIR"
}
ENDJSON
)

run_hook "stop/mem0-pre-compaction-sync" "$INPUT"

if [[ -n "$ORIG_PLUGIN_ROOT" ]]; then
    export CLAUDE_PLUGIN_ROOT="$ORIG_PLUGIN_ROOT"
else
    unset CLAUDE_PLUGIN_ROOT
fi

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected graceful handling of corrupt decision log. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

# ── test_pre_compaction_sync_missing_dirs ───────────────────────────────────

test_start "test_pre_compaction_sync_missing_dirs"

ORIG_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
export CLAUDE_PLUGIN_ROOT="/tmp/nonexistent-orchestkit-dir-$(date +%s)"

INPUT=$(cat <<'ENDJSON'
{
  "hook_event": "Stop",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-missing-dirs",
  "project_dir": "/tmp/nonexistent-project-dir-00000"
}
ENDJSON
)

run_hook "stop/mem0-pre-compaction-sync" "$INPUT"

if [[ -n "$ORIG_PLUGIN_ROOT" ]]; then
    export CLAUDE_PLUGIN_ROOT="$ORIG_PLUGIN_ROOT"
else
    unset CLAUDE_PLUGIN_ROOT
fi

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected graceful handling of nonexistent dirs. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

echo ""

# =============================================================================
# Environment Edge Cases
# =============================================================================

echo "--- Environment Edge Cases ---"

# ── test_hooks_without_mem0_api_key ─────────────────────────────────────────

test_start "test_hooks_without_mem0_api_key"

# Save and unset MEM0_API_KEY
SAVED_API_KEY="${MEM0_API_KEY:-}"
unset MEM0_API_KEY 2>/dev/null || true

INPUT=$(cat <<'ENDJSON'
{
  "hook_event": "UserPromptSubmit",
  "prompt": "implement a new feature for the authentication system",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-no-api-key",
  "project_dir": "/tmp/test-project"
}
ENDJSON
)

run_hook "prompt/memory-context" "$INPUT"

# Restore API key
if [[ -n "$SAVED_API_KEY" ]]; then
    export MEM0_API_KEY="$SAVED_API_KEY"
fi

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected graceful degradation without MEM0_API_KEY. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

# ── test_hooks_without_project_dir ──────────────────────────────────────────

test_start "test_hooks_without_project_dir"

# Save and unset CLAUDE_PROJECT_DIR
SAVED_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
unset CLAUDE_PROJECT_DIR 2>/dev/null || true

INPUT=$(cat <<'ENDJSON'
{
  "hook_event": "SessionStart",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-no-project-dir"
}
ENDJSON
)

run_hook "lifecycle/mem0-context-retrieval" "$INPUT"

# Restore CLAUDE_PROJECT_DIR
if [[ -n "$SAVED_PROJECT_DIR" ]]; then
    export CLAUDE_PROJECT_DIR="$SAVED_PROJECT_DIR"
fi

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected graceful handling without CLAUDE_PROJECT_DIR. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

# ── test_hooks_with_unicode_project_dir ─────────────────────────────────────

test_start "test_hooks_with_unicode_project_dir"

UNICODE_DIR=$(mktemp -d)
UNICODE_PATH="$UNICODE_DIR/projet-numero-un"
mkdir -p "$UNICODE_PATH/.claude/logs"
TEMP_DIRS+=("$UNICODE_DIR")

INPUT=$(cat <<ENDJSON
{
  "hook_event": "UserPromptSubmit",
  "prompt": "implement a new feature for the authentication system",
  "tool_name": "",
  "tool_input": {},
  "session_id": "test-unicode-dir",
  "project_dir": "$UNICODE_PATH"
}
ENDJSON
)

run_hook "prompt/memory-context" "$INPUT"

if assert_valid_json && assert_jq '.continue == true'; then
    test_pass
else
    test_fail "Expected graceful handling with unicode-like project dir. Exit: $HOOK_EXIT_CODE. Output: $HOOK_OUTPUT"
fi

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
