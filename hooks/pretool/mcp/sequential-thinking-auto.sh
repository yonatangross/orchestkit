#!/usr/bin/env bash
# CC 2.1.7 PreToolUse Hook: Sequential Thinking Auto-Tracker
# Tracks sequential thinking usage for complex reasoning tasks
set -euo pipefail

# Read stdin once and cache
INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

# Only process sequential-thinking MCP calls
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
if [[ "$TOOL_NAME" != mcp__sequential-thinking__* ]]; then
  output_silent_success
  exit 0
fi

# Extract thinking details
THOUGHT=$(echo "$INPUT" | jq -r '.tool_input.thought // ""')
THOUGHT_NUMBER=$(echo "$INPUT" | jq -r '.tool_input.thoughtNumber // 1')
TOTAL_THOUGHTS=$(echo "$INPUT" | jq -r '.tool_input.totalThoughts // 1')
NEXT_NEEDED=$(echo "$INPUT" | jq -r '.tool_input.nextThoughtNeeded // false')
IS_REVISION=$(echo "$INPUT" | jq -r '.tool_input.isRevision // false')

# Log for telemetry
LOG_DIR="${PLUGIN_ROOT:-$SCRIPT_DIR/../../..}/hooks/logs"
mkdir -p "$LOG_DIR"
THINKING_LOG="$LOG_DIR/sequential-thinking.log"

# Rotate log if > 100KB
if [[ -f "$THINKING_LOG" ]] && [[ $(stat -f%z "$THINKING_LOG" 2>/dev/null || stat -c%s "$THINKING_LOG" 2>/dev/null || echo 0) -gt 102400 ]]; then
  mv "$THINKING_LOG" "${THINKING_LOG}.old"
fi

# Log the thinking step
{
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | step=$THOUGHT_NUMBER/$TOTAL_THOUGHTS | revision=$IS_REVISION | next_needed=$NEXT_NEEDED | thought_length=${#THOUGHT}"
} >> "$THINKING_LOG" 2>/dev/null || true

# Track reasoning chain progress
if [[ "$THOUGHT_NUMBER" -eq 1 ]]; then
  log_permission_feedback "sequential-thinking" "allow" "Starting reasoning chain ($TOTAL_THOUGHTS estimated thoughts)"
elif [[ "$IS_REVISION" == "true" ]]; then
  log_permission_feedback "sequential-thinking" "allow" "Revision at step $THOUGHT_NUMBER"
elif [[ "$NEXT_NEEDED" == "false" ]]; then
  log_permission_feedback "sequential-thinking" "allow" "Completed reasoning chain at step $THOUGHT_NUMBER"
else
  log_permission_feedback "sequential-thinking" "allow" "Reasoning step $THOUGHT_NUMBER/$TOTAL_THOUGHTS"
fi

output_silent_success