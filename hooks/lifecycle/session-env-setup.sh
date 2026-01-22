#!/bin/bash
set -euo pipefail
# Session Environment Setup - Initializes session environment
# Hook: SessionStart
# CC 2.1.6 Compliant - Supports agent_type field

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
# Also check for HOOK_INPUT from parent dispatcher (CC 2.1.6 format)
# CRITICAL: Use completely non-blocking approach - don't read stdin at all if not available
# The read command can still block even with -t flag in some edge cases
if [[ -n "${HOOK_INPUT:-}" ]]; then
  _HOOK_INPUT="$HOOK_INPUT"
else
  # Completely skip stdin reading - it's not critical for this hook
  # If HOOK_INPUT is needed, it will be provided via environment variable
  _HOOK_INPUT=""
fi
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

# Start timing
start_hook_timing

log_hook "Setting up session environment"

# Create logs directory if needed
mkdir -p "${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/logs" 2>/dev/null

# Initialize session metrics
SESSION_ID=$(get_session_id)
METRICS_FILE="/tmp/claude-session-metrics.json"

# Extract agent_type from environment (set by startup-dispatcher) or hook input
AGENT_TYPE="${AGENT_TYPE:-}"
if [[ -z "$AGENT_TYPE" ]] && [[ -n "$_HOOK_INPUT" ]]; then
  AGENT_TYPE=$(echo "$_HOOK_INPUT" | jq -r '.agent_type // ""' 2>/dev/null || echo "")
fi

if [[ ! -f "$METRICS_FILE" ]] || [[ -n "$SESSION_ID" ]]; then
  cat > "$METRICS_FILE" << EOF
{
  "session_id": "$SESSION_ID",
  "started_at": "$(date -Iseconds)",
  "agent_type": "$AGENT_TYPE",
  "tools": {},
  "errors": 0,
  "warnings": 0
}
EOF
  log_hook "Initialized session metrics"
fi

# Update session state with agent_type (CC 2.1.6 feature)
SESSION_STATE="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/context/session/state.json"
if [[ -f "$SESSION_STATE" ]] && [[ -n "$AGENT_TYPE" ]]; then
  # Update session state with agent_type using jq
  if command -v jq >/dev/null 2>&1; then
    TMP_STATE=$(mktemp)
    jq --arg agent_type "$AGENT_TYPE" \
       --arg session_id "$SESSION_ID" \
       --arg last_activity "$(date -Iseconds)" \
       '. + {agent_type: $agent_type, session_id: $session_id, last_activity: $last_activity}' \
       "$SESSION_STATE" > "$TMP_STATE" 2>/dev/null && mv "$TMP_STATE" "$SESSION_STATE"
    log_hook "Updated session state with agent_type: $AGENT_TYPE"
  fi
fi

# Check git status with timeout (non-blocking)
BRANCH=$(run_with_timeout 0.5 get_current_branch 2>/dev/null || echo "")
if [[ -n "$BRANCH" ]]; then
  log_hook "Git branch: $BRANCH"
fi

# Log agent type if present
if [[ -n "$AGENT_TYPE" ]]; then
  log_hook "Agent type: $AGENT_TYPE"
fi

# Log timing
log_hook_timing "session-env-setup"

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0