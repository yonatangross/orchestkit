#!/bin/bash
set -euo pipefail
# Subagent Validator - Source of truth for subagent tracking
# CC 2.1.6 Compliant: includes continue field in all outputs
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

# === VALIDATION: Build valid types from multiple sources ===
BUILTIN_TYPES="general-purpose|Explore|Plan|claude-code-guide|statusline-setup|Bash"

# Extract agent type (strip namespace prefix like "skf:")
AGENT_TYPE_ONLY="${SUBAGENT_TYPE##*:}"

# Source 1: Load from plugin.json agents array (if exists)
REGISTRY="${CLAUDE_PROJECT_DIR:-.}/plugin.json"
REGISTRY_TYPES=""
if [[ -f "$REGISTRY" ]]; then
  REGISTRY_TYPES=$(jq -r '[.agents[].id // empty] | join("|")' "$REGISTRY" 2>/dev/null || echo "")
fi

# Source 2: Scan .claude/agents/ directory for agent markdown files
AGENTS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/agents"
AGENT_FILES_TYPES=""
if [[ -d "$AGENTS_DIR" ]]; then
  # List .md files, strip extension, join with |
  AGENT_FILES_TYPES=$(ls "$AGENTS_DIR"/*.md 2>/dev/null | xargs -I{} basename {} .md | tr '\n' '|' | sed 's/|$//')
fi

# Combine all valid types
VALID_TYPES="$BUILTIN_TYPES"
[[ -n "$REGISTRY_TYPES" ]] && VALID_TYPES="$VALID_TYPES|$REGISTRY_TYPES"
[[ -n "$AGENT_FILES_TYPES" ]] && VALID_TYPES="$VALID_TYPES|$AGENT_FILES_TYPES"

# Validate (check both full name and stripped name)
if [[ ! "$SUBAGENT_TYPE" =~ ^($VALID_TYPES)$ ]] && [[ ! "$AGENT_TYPE_ONLY" =~ ^($VALID_TYPES)$ ]]; then
  # Only log to file, no stderr output (silent on unknown types)
  log_hook "WARNING: Unknown subagent type: $SUBAGENT_TYPE"
fi

# Silent on success - only log to file, no stderr output
log_hook "Spawning $SUBAGENT_TYPE agent: $DESCRIPTION"

# CC 2.1.6 Compliant: JSON output without ANSI colors
# (Colors in JSON break JSON parsing)
echo '{"continue": true, "suppressOutput": true}'
exit 0