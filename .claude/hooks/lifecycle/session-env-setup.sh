#!/bin/bash
set -euo pipefail
# Session Environment Setup - Initializes session environment
# Hook: SessionStart

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

log_hook "Setting up session environment"

# Create logs directory if needed
mkdir -p "$CLAUDE_PROJECT_DIR/.claude/logs" 2>/dev/null

# Initialize session metrics
SESSION_ID=$(get_session_id)
METRICS_FILE="/tmp/claude-session-metrics.json"

if [[ ! -f "$METRICS_FILE" ]] || [[ -n "$SESSION_ID" ]]; then
  cat > "$METRICS_FILE" << EOF
{
  "session_id": "$SESSION_ID",
  "started_at": "$(date -Iseconds)",
  "tools": {},
  "errors": 0,
  "warnings": 0
}
EOF
  log_hook "Initialized session metrics"
fi

# Check git status
BRANCH=$(get_current_branch)
if [[ -n "$BRANCH" ]]; then
  log_hook "Git branch: $BRANCH"
fi

# Output systemMessage for user visibility
echo '{"systemMessage":"Session env setup"}'
exit 0
