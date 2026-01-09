#!/bin/bash
set -euo pipefail
# Subagent Validator - Source of truth for subagent tracking
# CC 2.1.2 Compliant: includes continue field in all outputs
# Hook: PreToolUse (Task)
#
# This is the ONLY place we track subagent usage because:
# - SubagentStop hook doesn't receive subagent_type (Claude Code limitation)
# - PreToolUse receives full task details including type, description, prompt

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

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

# === VALIDATION: Load valid types from plugin.json (single source of truth) ===
REGISTRY="${CLAUDE_PROJECT_DIR:-.}/plugin.json"
BUILTIN_TYPES="general-purpose|Explore|Plan|claude-code-guide|statusline-setup|Bash"

if [[ -f "$REGISTRY" ]]; then
  # Extract agent IDs from plugin.json agents array
  REGISTRY_TYPES=$(jq -r '[.agents[].id] | join("|")' "$REGISTRY" 2>/dev/null || echo "")
  if [[ -n "$REGISTRY_TYPES" ]]; then
    VALID_TYPES="$BUILTIN_TYPES|$REGISTRY_TYPES"
  else
    VALID_TYPES="$BUILTIN_TYPES"
  fi
else
  VALID_TYPES="$BUILTIN_TYPES"
fi

if [[ ! "$SUBAGENT_TYPE" =~ ^($VALID_TYPES)$ ]]; then
  warn "Unknown subagent type: $SUBAGENT_TYPE (not in plugin.json)"
  log_hook "WARNING: Unknown subagent type: $SUBAGENT_TYPE"
fi

info "Spawning $SUBAGENT_TYPE agent: $DESCRIPTION"

# CC 2.1.2 Compliant: JSON output without ANSI colors
# (Colors in JSON break JSON parsing)
echo '{"systemMessage":"Subagent validated", "continue": true}'
exit 0