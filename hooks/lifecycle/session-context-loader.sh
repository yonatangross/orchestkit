#!/bin/bash
set -euo pipefail
# Session Context Loader - Loads session context at session start
# Hook: SessionStart
# CC 2.1.2 Compliant - Context Protocol 2.0
# Supports agent_type for context-aware initialization

# Check for HOOK_INPUT from parent dispatcher (CC 2.1.2 format)
if [[ -n "${HOOK_INPUT:-}" ]]; then
  _HOOK_INPUT="$HOOK_INPUT"
fi
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

log_hook "Session starting - loading context (Protocol 2.0)"

# Extract agent_type from environment (set by startup-dispatcher)
AGENT_TYPE="${AGENT_TYPE:-}"

# Context Protocol 2.0 paths
SESSION_STATE="$CLAUDE_PROJECT_DIR/.claude/context/session/state.json"
IDENTITY_FILE="$CLAUDE_PROJECT_DIR/.claude/context/identity.json"
KNOWLEDGE_INDEX="$CLAUDE_PROJECT_DIR/.claude/context/knowledge/index.json"

CONTEXT_LOADED=0

# Load session state
if [[ -f "$SESSION_STATE" ]]; then
  if jq empty "$SESSION_STATE" 2>/dev/null; then
    log_hook "Session state loaded"
    CONTEXT_LOADED=$((CONTEXT_LOADED + 1))
  fi
fi

# Load identity
if [[ -f "$IDENTITY_FILE" ]]; then
  if jq empty "$IDENTITY_FILE" 2>/dev/null; then
    log_hook "Identity loaded"
    CONTEXT_LOADED=$((CONTEXT_LOADED + 1))
  fi
fi

# Check knowledge index
if [[ -f "$KNOWLEDGE_INDEX" ]]; then
  if jq empty "$KNOWLEDGE_INDEX" 2>/dev/null; then
    log_hook "Knowledge index available"
    CONTEXT_LOADED=$((CONTEXT_LOADED + 1))
  fi
fi

# Load current status docs if they exist
STATUS_FILE="$CLAUDE_PROJECT_DIR/docs/CURRENT_STATUS.md"
if [[ -f "$STATUS_FILE" ]]; then
  log_hook "Current status document exists"
fi

# Agent-type aware context loading (CC 2.1.2 feature)
# When --agent flag is used, Claude Code provides agent_type to customize initialization
if [[ -n "$AGENT_TYPE" ]]; then
  log_hook "Agent-type aware initialization: $AGENT_TYPE"

  # Check if there's agent-specific configuration
  AGENT_CONFIG="$CLAUDE_PROJECT_DIR/.claude/agents/${AGENT_TYPE}.md"
  if [[ -f "$AGENT_CONFIG" ]]; then
    log_hook "Agent configuration found: $AGENT_CONFIG"
    CONTEXT_LOADED=$((CONTEXT_LOADED + 1))
  fi

  # Load agent-specific skills based on plugin.json definition
  PLUGIN_JSON="$CLAUDE_PROJECT_DIR/plugin.json"
  if [[ -f "$PLUGIN_JSON" ]] && command -v jq >/dev/null 2>&1; then
    # Check if agent is defined in plugin.json and get its skills_used
    AGENT_SKILLS=$(jq -r --arg agent "$AGENT_TYPE" \
      '.agents[]? | select(.id == $agent) | .skills_used[]?' \
      "$PLUGIN_JSON" 2>/dev/null || echo "")

    if [[ -n "$AGENT_SKILLS" ]]; then
      log_hook "Agent $AGENT_TYPE uses skills: $(echo "$AGENT_SKILLS" | tr '\n' ' ')"
    fi
  fi
fi

# Output CC 2.1.2 compliant response
if [[ $CONTEXT_LOADED -gt 0 ]]; then
  MSG="Session context loaded (Protocol 2.0)"
  if [[ -n "$AGENT_TYPE" ]]; then
    MSG="$MSG - Agent: $AGENT_TYPE"
  fi
  echo "{\"systemMessage\":\"$MSG\",\"continue\":true}"
else
  echo '{"continue":true,"suppressOutput":true}'
fi
exit 0