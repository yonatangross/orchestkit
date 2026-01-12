#!/bin/bash
set -euo pipefail
# Error Collector - Captures all tool errors for pattern analysis
# Hook: PostToolUse (*)
#
# Purpose: Build a database of errors to detect bad practices
# Analysis: Run .claude/scripts/analyze_errors.py nightly (cron)
# Cost: $0 - No LLM, just logging

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

# Get tool execution details
TOOL_NAME=$(get_tool_name)
SESSION_ID=$(get_session_id)
TIMESTAMP=$(date -Iseconds)

# Check if there was an error in the output
TOOL_OUTPUT=$(get_field '.tool_output // .output // ""')
EXIT_CODE=$(get_field '.exit_code // 0')
TOOL_ERROR=$(get_field '.tool_error // .error // ""')

# Detect errors by multiple signals
IS_ERROR=false
ERROR_TYPE=""
ERROR_MESSAGE=""

# Signal 1: Explicit exit code
if [[ "$EXIT_CODE" != "0" && -n "$EXIT_CODE" ]]; then
  IS_ERROR=true
  ERROR_TYPE="exit_code"
  ERROR_MESSAGE="Exit code: $EXIT_CODE"
fi

# Signal 2: Error field present
if [[ -n "$TOOL_ERROR" ]]; then
  IS_ERROR=true
  ERROR_TYPE="tool_error"
  ERROR_MESSAGE="$TOOL_ERROR"
fi

# Signal 3: Error patterns in output (case-insensitive)
if echo "$TOOL_OUTPUT" | grep -qiE "(error:|Error:|ERROR|FATAL|exception|failed|denied|not found|does not exist|connection refused|timeout|ENOENT|EACCES|EPERM)"; then
  IS_ERROR=true
  ERROR_TYPE="${ERROR_TYPE:-output_pattern}"
  # Extract the error line
  ERROR_LINE=$(echo "$TOOL_OUTPUT" | grep -iE "(error:|Error:|ERROR|FATAL|exception|failed|denied|not found|does not exist|connection refused|timeout)" | head -1)
  ERROR_MESSAGE="${ERROR_MESSAGE:-$ERROR_LINE}"
fi

# Only log if there was an error
if [[ "$IS_ERROR" == "true" ]]; then
  # Get tool input for context
  TOOL_INPUT=$(get_field '.tool_input' | jq -c '.' 2>/dev/null || echo '{"continue":true}')

  # Create hash of input for deduplication
  INPUT_HASH=$(echo "$TOOL_INPUT" | md5sum | cut -d' ' -f1)

  # Error log file (JSONL format for easy analysis)
  ERROR_LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/errors.jsonl"
  mkdir -p "$(dirname "$ERROR_LOG")" 2>/dev/null || true

  # Rotate if > 1MB
  rotate_log_file "$ERROR_LOG" 1000

  # Truncate long values for storage efficiency
  ERROR_MESSAGE_TRUNCATED="${ERROR_MESSAGE:0:500}"
  TOOL_OUTPUT_TRUNCATED="${TOOL_OUTPUT:0:1000}"

  # Write structured error record
  jq -n \
    --arg ts "$TIMESTAMP" \
    --arg tool "$TOOL_NAME" \
    --arg session "$SESSION_ID" \
    --arg type "$ERROR_TYPE" \
    --arg msg "$ERROR_MESSAGE_TRUNCATED" \
    --arg hash "$INPUT_HASH" \
    --argjson input "$TOOL_INPUT" \
    --arg output "$TOOL_OUTPUT_TRUNCATED" \
    '{
      timestamp: $ts,
      tool: $tool,
      session_id: $session,
      error_type: $type,
      error_message: $msg,
      input_hash: $hash,
      tool_input: $input,
      output_preview: $output
    }' >> "$ERROR_LOG" 2>/dev/null || {
    # Fallback if jq fails
    echo "{\"timestamp\":\"$TIMESTAMP\",\"tool\":\"$TOOL_NAME\",\"error_type\":\"$ERROR_TYPE\",\"error_message\":\"${ERROR_MESSAGE_TRUNCATED//\"/\\\"}\"}" >> "$ERROR_LOG"
  }

  # Also track in session metrics for quick access
  METRICS_FILE="/tmp/claude-session-errors.json"
  if [[ -f "$METRICS_FILE" ]]; then
    ERROR_COUNT=$(jq -r '.error_count // 0' "$METRICS_FILE")
    jq --arg tool "$TOOL_NAME" \
       ".error_count = $((ERROR_COUNT + 1)) | .last_error_tool = \$tool | .last_error_time = \"$TIMESTAMP\"" \
       "$METRICS_FILE" > "${METRICS_FILE}.tmp" && mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
  else
    echo "{\"error_count\":1,\"last_error_tool\":\"$TOOL_NAME\",\"last_error_time\":\"$TIMESTAMP\"}" > "$METRICS_FILE"
  fi

  log_hook "ERROR captured: $TOOL_NAME - $ERROR_TYPE - ${ERROR_MESSAGE:0:100}"
fi

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
exit 0
