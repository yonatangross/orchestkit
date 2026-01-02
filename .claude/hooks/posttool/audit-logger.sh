#!/bin/bash
set -euo pipefail
# Audit Logger - Logs all tool executions for audit trail
# Hook: PostToolUse (*)

source "$(dirname "$0")/../_lib/common.sh"

TOOL_NAME=$(get_tool_name)
SESSION_ID=$(get_session_id)

# Skip logging for high-frequency read operations to reduce noise
if [[ "$TOOL_NAME" =~ ^(Read|Glob|Grep)$ ]]; then
  # Only log every 10th read operation
  READ_COUNT_FILE="/tmp/claude-read-count"
  READ_COUNT=$(($(cat "$READ_COUNT_FILE" 2>/dev/null || echo 0) + 1))
  echo "$READ_COUNT" > "$READ_COUNT_FILE"
  if [[ $((READ_COUNT % 10)) -ne 0 ]]; then
    exit 0
  fi
fi

# Log to audit file
AUDIT_LOG="$CLAUDE_PROJECT_DIR/.claude/logs/audit.log"

# Rotate if needed (200KB limit)
rotate_log_file "$AUDIT_LOG" 200

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Get relevant details based on tool type
case "$TOOL_NAME" in
  Bash)
    DETAILS=$(get_field '.tool_input.command' | head -c 100)
    ;;
  Write|Edit)
    DETAILS=$(get_field '.tool_input.file_path')
    ;;
  Task)
    DETAILS=$(get_field '.tool_input.subagent_type')
    ;;
  *)
    DETAILS=""
    ;;
esac

echo "[$TIMESTAMP] $TOOL_NAME ${DETAILS:+| $DETAILS}" >> "$AUDIT_LOG"

exit 0
