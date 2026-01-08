#!/bin/bash
set -euo pipefail
# Session Context Loader - Loads shared context at session start
# Hook: SessionStart

source "$(dirname "$0")/../_lib/common.sh"

log_hook "Session starting - loading context"

CONTEXT_FILE="$CLAUDE_PROJECT_DIR/.claude/context/shared-context.json"

if [[ -f "$CONTEXT_FILE" ]]; then
  # Validate JSON
  if jq empty "$CONTEXT_FILE" 2>/dev/null; then
    log_hook "Context loaded successfully"
    info "Loaded shared context from previous sessions"
  else
    warn "Context file exists but is invalid JSON"
  fi
else
  log_hook "No existing context file"
fi

# Load current status docs if they exist
STATUS_FILE="$CLAUDE_PROJECT_DIR/docs/CURRENT_STATUS.md"
if [[ -f "$STATUS_FILE" ]]; then
  log_hook "Current status document exists"
fi

# Output systemMessage for user visibility
echo '{"systemMessage":"Session context loaded"}'
exit 0
