#!/bin/bash
set -euo pipefail
# Subagent Resource Allocator - Pre-allocates context for subagent launch
# Hook: SubagentStart
# CC 2.1.2 Compliant: includes continue field in all outputs
#
# This hook:
# 1. Logs the subagent type being launched
# 2. Pre-allocates context by reading relevant skill files based on subagent_type
# 3. Sets up environment variables for the subagent
# 4. Returns JSON with optional systemMessage for context injection

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

SUBAGENT_TYPE=$(get_field '.subagent_type')
SESSION_ID=$(get_session_id)
TASK_DESCRIPTION=$(get_field '.task_description')

log_hook "SubagentStart: $SUBAGENT_TYPE (session: $SESSION_ID)"

# === PRE-ALLOCATE CONTEXT BASED ON SUBAGENT TYPE ===

# Use plugin.json as single source of truth (agent-registry.json removed)
REGISTRY="${CLAUDE_PROJECT_DIR:-.}/plugin.json"
SYSTEM_MESSAGE=""

if [[ -f "$REGISTRY" ]]; then
  # Extract skills_used for this subagent type from plugin.json agents array
  SKILL_REFS=$(jq -r ".agents[] | select(.id==\"$SUBAGENT_TYPE\") | .skills_used // [] | join(\",\")" "$REGISTRY" 2>/dev/null || echo "")

  if [[ -n "$SKILL_REFS" && "$SKILL_REFS" != "null" ]]; then
    # Pre-load skill files into context message
    CONTEXT_SUMMARY="Pre-loaded skills for $SUBAGENT_TYPE:\n"

    IFS=',' read -ra SKILLS <<< "$SKILL_REFS"
    for skill in "${SKILLS[@]}"; do
      skill=$(echo "$skill" | xargs) # trim whitespace
      SKILL_FILE="$CLAUDE_PROJECT_DIR/.claude/skills/$skill/SKILL.md"

      if [[ -f "$SKILL_FILE" ]]; then
        log_hook "Pre-loading skill: $skill"
        CONTEXT_SUMMARY="${CONTEXT_SUMMARY}- $skill (available)\n"
      else
        log_hook "Skill not found: $skill"
        CONTEXT_SUMMARY="${CONTEXT_SUMMARY}- $skill (not found)\n"
      fi
    done

    SYSTEM_MESSAGE="$CONTEXT_SUMMARY\nTask: $TASK_DESCRIPTION"
  else
    log_hook "No skills_used found for $SUBAGENT_TYPE"
  fi
else
  log_hook "plugin.json not found at $REGISTRY"
fi

# === SET UP ENVIRONMENT VARIABLES FOR SUBAGENT ===

# Export subagent-specific environment variables
export SUBAGENT_TYPE="$SUBAGENT_TYPE"
export SUBAGENT_SESSION_ID="$SESSION_ID"
export SUBAGENT_PARENT_PROJECT="$CLAUDE_PROJECT_DIR"

log_hook "Environment variables set: SUBAGENT_TYPE=$SUBAGENT_TYPE, SESSION_ID=$SESSION_ID"

# === RETURN JSON WITH SYSTEM MESSAGE (CC 2.1.2 Compliant) ===

# Return JSON response with systemMessage and continue field
if [[ -n "$SYSTEM_MESSAGE" ]]; then
  jq -n \
    --arg msg "$SYSTEM_MESSAGE" \
    '{systemMessage: $msg, continue: true}' 2>/dev/null || {
    # Fallback if jq fails
    echo "{\"systemMessage\":\"Skills loaded\",\"continue\":true}"
  }
else
  # Return minimal JSON with continue field
  echo '{"continue":true}'
fi

exit 0