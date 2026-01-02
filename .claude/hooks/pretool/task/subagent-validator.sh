#!/bin/bash
set -euo pipefail
# Subagent Validator - Source of truth for subagent tracking
# Hook: PreToolUse (Task)
#
# This is the ONLY place we track subagent usage because:
# - SubagentStop hook doesn't receive subagent_type (Claude Code limitation)
# - PreToolUse receives full task details including type, description, prompt

source "$(dirname "$0")/../../_lib/common.sh"

SUBAGENT_TYPE=$(get_field '.tool_input.subagent_type')
DESCRIPTION=$(get_field '.tool_input.description')
SESSION_ID=$(get_session_id)

log_hook "Task invocation: $SUBAGENT_TYPE - $DESCRIPTION"

# === SUBAGENT TRACKING (JSONL for analysis) ===
TRACKING_LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/subagent-spawns.jsonl"
mkdir -p "$(dirname "$TRACKING_LOG")" 2>/dev/null || true

jq -n \
  --arg ts "$(date -Iseconds)" \
  --arg type "$SUBAGENT_TYPE" \
  --arg desc "$DESCRIPTION" \
  --arg session "$SESSION_ID" \
  '{timestamp: $ts, subagent_type: $type, description: $desc, session_id: $session}' \
  >> "$TRACKING_LOG" 2>/dev/null || {
  # Fallback if jq fails
  echo "{\"timestamp\":\"$(date -Iseconds)\",\"subagent_type\":\"$SUBAGENT_TYPE\",\"description\":\"$DESCRIPTION\"}" >> "$TRACKING_LOG"
}

# === VALIDATION: Load valid types from agent-registry.json ===
REGISTRY="${CLAUDE_PROJECT_DIR:-.}/.claude/agent-registry.json"
BUILTIN_TYPES="general-purpose|Explore|Plan|claude-code-guide|statusline-setup"

if [[ -f "$REGISTRY" ]]; then
  # Extract agent keys from registry
  REGISTRY_TYPES=$(jq -r '.agents | keys | join("|")' "$REGISTRY" 2>/dev/null || echo "")
  if [[ -n "$REGISTRY_TYPES" ]]; then
    VALID_TYPES="$BUILTIN_TYPES|$REGISTRY_TYPES"
  else
    VALID_TYPES="$BUILTIN_TYPES"
  fi
else
  VALID_TYPES="$BUILTIN_TYPES"
fi

if [[ ! "$SUBAGENT_TYPE" =~ ^($VALID_TYPES)$ ]]; then
  warn "Unknown subagent type: $SUBAGENT_TYPE (not in agent-registry.json)"
  log_hook "WARNING: Unknown subagent type: $SUBAGENT_TYPE"
fi

info "Spawning $SUBAGENT_TYPE agent: $DESCRIPTION"

exit 0
