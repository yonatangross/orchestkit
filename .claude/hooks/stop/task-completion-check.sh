#!/bin/bash
set -euo pipefail
# Task Completion Check - Verifies tasks are properly completed before stop
# Hook: Stop

source "$(dirname "$0")/../_lib/common.sh"

log_hook "Stop hook - checking task completion"

# Check if there are any in-progress todos
# This is informational only - doesn't block stop

TODOS_FILE="/tmp/claude-active-todos.json"
if [[ -f "$TODOS_FILE" ]]; then
  IN_PROGRESS=$(jq '[.[] | select(.status == "in_progress")] | length' "$TODOS_FILE" 2>/dev/null)

  if [[ "$IN_PROGRESS" -gt 0 ]]; then
    warn "$IN_PROGRESS task(s) still in progress"
    log_hook "WARNING: $IN_PROGRESS tasks in progress at stop"
  fi
fi

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0
