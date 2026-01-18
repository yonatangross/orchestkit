#!/bin/bash
set -euo pipefail
# Session Context Loader - Loads session context at session start
# Hook: SessionStart
# CC 2.1.7 Compliant - Context Protocol 2.0
# Supports agent_type for context-aware initialization

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

log_hook "Session starting - loading context (Protocol 2.0)"

# Extract agent_type from environment (set by startup-dispatcher)
AGENT_TYPE="${AGENT_TYPE:-}"

# Context Protocol 2.0 paths
SESSION_STATE="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/context/session/state.json"
IDENTITY_FILE="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/context/identity.json"
KNOWLEDGE_INDEX="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/context/knowledge/index.json"

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
STATUS_FILE="${CLAUDE_PROJECT_DIR:-$(pwd)}/docs/CURRENT_STATUS.md"
if [[ -f "$STATUS_FILE" ]]; then
  log_hook "Current status document exists"
fi

# Agent-type aware context loading (CC 2.1.6 feature)
# When --agent flag is used, Claude Code provides agent_type to customize initialization
# CC 2.1.6 natively loads skills from agent frontmatter - no need to read plugin.json
if [[ -n "$AGENT_TYPE" ]]; then
  log_hook "Agent-type aware initialization: $AGENT_TYPE"

  # Check if there's agent-specific configuration
  AGENT_CONFIG="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/agents/${AGENT_TYPE}.md"
  if [[ -f "$AGENT_CONFIG" ]]; then
    log_hook "Agent configuration found: $AGENT_CONFIG"
    CONTEXT_LOADED=$((CONTEXT_LOADED + 1))
  fi
fi

# Output CC 2.1.7 compliant response
# Note: SessionStart hooks don't support hookSpecificOutput.additionalContext
if [[ $CONTEXT_LOADED -gt 0 ]]; then
  if [[ -n "$AGENT_TYPE" ]]; then
    log_hook "Session context loaded (Protocol 2.0) - Agent: $AGENT_TYPE"
  else
    log_hook "Session context loaded (Protocol 2.0)"
  fi
fi

echo '{"continue":true,"suppressOutput":true}'
exit 0