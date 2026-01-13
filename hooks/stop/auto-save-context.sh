#!/bin/bash
set -euo pipefail
# Auto-Save Context - Saves session context before stop
# Hook: Stop
# CC 2.1.6 Compliant - Context Protocol 2.0
#
# Ensures state.json always has required fields:
# - $schema: For schema validation
# - _meta: For attention positioning and token budgets

source "$(dirname "$0")/../_lib/common.sh"

log_hook "Stop hook - auto-saving context (Protocol 2.0)"

# Context Protocol 2.0 paths
SESSION_STATE="$CLAUDE_PROJECT_DIR/.claude/context/session/state.json"
SESSION_DIR="$CLAUDE_PROJECT_DIR/.claude/context/session"

# Ensure session directory exists
mkdir -p "$SESSION_DIR" 2>/dev/null || true

# Update session state with timestamp
TIMESTAMP=$(date -Iseconds)

if [[ -f "$SESSION_STATE" ]]; then
  # Update existing session state, preserving required fields
  # Ensure $schema and _meta exist even if missing
  jq --arg ts "$TIMESTAMP" '
    . + {
      "$schema": (."$schema" // "context://session/v1"),
      "_meta": (._meta // {
        "position": "END",
        "token_budget": 500,
        "auto_load": "always",
        "compress": "on_threshold",
        "description": "Session state and progress - ALWAYS loaded at END of context"
      }),
      "last_activity": $ts
    }
  ' "$SESSION_STATE" > "${SESSION_STATE}.tmp" 2>/dev/null && \
    mv "${SESSION_STATE}.tmp" "$SESSION_STATE" 2>/dev/null && \
    log_hook "Updated session state timestamp"
else
  # Create session state with Context Protocol 2.0 required fields
  jq -n --arg ts "$TIMESTAMP" '{
    "$schema": "context://session/v1",
    "_meta": {
      "position": "END",
      "token_budget": 500,
      "auto_load": "always",
      "compress": "on_threshold",
      "description": "Session state and progress - ALWAYS loaded at END of context"
    },
    "session_id": null,
    "started": $ts,
    "last_activity": $ts,
    "current_task": {
      "description": "No active task",
      "status": "pending"
    },
    "next_steps": [],
    "blockers": []
  }' > "$SESSION_STATE" 2>/dev/null && \
    log_hook "Created new session state (Protocol 2.0 compliant)"
fi

# Output CC 2.1.6 compliant response
echo '{"continue":true,"suppressOutput":true}'
exit 0