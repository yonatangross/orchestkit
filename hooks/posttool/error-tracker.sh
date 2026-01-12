#!/bin/bash
set -euo pipefail
# Error Tracker - Tracks and logs tool errors
# Hook: PostToolUse (*)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

TOOL_NAME=$(get_tool_name)
TOOL_ERROR=$(get_field '.tool_error')
EXIT_CODE=$(get_field '.exit_code')

# Check if there was an error
if [[ -n "$TOOL_ERROR" ]] || [[ "$EXIT_CODE" != "0" && "$EXIT_CODE" != "" && "$EXIT_CODE" != "null" ]]; then
  log_hook "ERROR: $TOOL_NAME failed (exit: $EXIT_CODE)"

  # Track error count
  METRICS_FILE="/tmp/claude-session-metrics.json"
  if [[ -f "$METRICS_FILE" ]]; then
    ERRORS=$(jq -r '.errors // 0' "$METRICS_FILE")
    jq ".errors = $((ERRORS + 1))" "$METRICS_FILE" > "${METRICS_FILE}.tmp" 2>/dev/null
    mv "${METRICS_FILE}.tmp" "$METRICS_FILE" 2>/dev/null
  fi

  # Log error details
  ERROR_LOG="$CLAUDE_PROJECT_DIR/.claude/logs/errors.log"
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$TIMESTAMP] $TOOL_NAME | exit: $EXIT_CODE | ${TOOL_ERROR:0:200}" >> "$ERROR_LOG"
fi

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
exit 0
