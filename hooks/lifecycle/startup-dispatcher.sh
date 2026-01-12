#!/bin/bash
# SessionStart Dispatcher - Runs all startup hooks and outputs combined status
# CC 2.1.2 Compliant: silent on success, visible on failure
# Supports agent_type field from CC 2.1.2 --agent flag
# Consolidates: coordination-init, session-context-loader, session-env-setup
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WARNINGS=()

# ANSI colors
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Read and parse hook input (CC 2.1.2 format)
# Capture stdin BEFORE any subshell operations
HOOK_INPUT=$(cat)
export HOOK_INPUT

# Extract agent_type from hook input (CC 2.1.2 feature)
# agent_type is provided when Claude Code is started with --agent flag
AGENT_TYPE=""
if command -v jq >/dev/null 2>&1 && [[ -n "$HOOK_INPUT" ]]; then
  AGENT_TYPE=$(echo "$HOOK_INPUT" | jq -r '.agent_type // ""' 2>/dev/null || echo "")
fi
export AGENT_TYPE

# Helper to run a hook (passes hook input and agent_type via environment)
run_hook() {
  local name="$1"
  local script="$2"

  if [[ ! -f "$script" ]]; then
    return 0
  fi

  local output
  local exit_code
  # Pass HOOK_INPUT and AGENT_TYPE to child scripts via environment
  output=$(HOOK_INPUT="$HOOK_INPUT" AGENT_TYPE="$AGENT_TYPE" bash "$script" 2>&1) && exit_code=0 || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    WARNINGS+=("$name: failed")
  elif [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]]; then
    local warn_msg=$(echo "$output" | grep -i "warning" | head -1 | sed 's/.*warning[: ]*//')
    [[ -n "$warn_msg" ]] && WARNINGS+=("$name: $warn_msg")
  fi

  return 0
}

# Run startup hooks in order
run_hook "Coordination" "$SCRIPT_DIR/coordination-init.sh"
run_hook "Context" "$SCRIPT_DIR/session-context-loader.sh"
run_hook "Environment" "$SCRIPT_DIR/session-env-setup.sh"

# Build output message based on agent type
OUTPUT_MSG=""
if [[ -n "$AGENT_TYPE" ]]; then
  # Log agent type for debugging
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [startup-dispatcher] Agent type: $AGENT_TYPE" >> "${CLAUDE_PROJECT_DIR:-.}/.claude/logs/hooks.log" 2>/dev/null || true
fi

# Output: silent on success, show warnings if any
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  echo "{\"systemMessage\": \"${YELLOW}⚠ ${WARN_MSG}${RESET}\", \"continue\": true}"
else
  # Silent success - no systemMessage
  echo "{\"continue\": true, \"suppressOutput\": true}"
fi

exit 0