#!/bin/bash
set -euo pipefail
# Auto-Save Context - Saves session context before stop
# Hook: Stop

source "$(dirname "$0")/../_lib/common.sh"

log_hook "Stop hook - auto-saving context"

CONTEXT_FILE="$CLAUDE_PROJECT_DIR/.claude/context/shared-context.json"

# Ensure context directory exists
mkdir -p "$(dirname "$CONTEXT_FILE")" 2>/dev/null

# If context file exists, update last_session timestamp
if [[ -f "$CONTEXT_FILE" ]]; then
  TIMESTAMP=$(date -Iseconds)
  jq ".last_session = \"$TIMESTAMP\"" "$CONTEXT_FILE" > "${CONTEXT_FILE}.tmp" 2>/dev/null
  mv "${CONTEXT_FILE}.tmp" "$CONTEXT_FILE" 2>/dev/null
  log_hook "Updated context timestamp"
fi

# Output systemMessage for user visibility
echo '{"systemMessage":"Context saved"}'
exit 0
