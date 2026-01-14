#!/bin/bash
# Agent Dispatcher - Consolidates all agent hooks for SubagentStop
# CC 2.1.6 Compliant: silent on success, visible on failure
set -euo pipefail

# Read stdin once and export for child hooks
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WARNINGS=()

# ANSI colors
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Helper to run a sub-hook
run_hook() {
  local name="$1"
  local script="$2"

  if [[ ! -f "$script" ]]; then
    return 0
  fi

  local output
  local exit_code
  output=$(echo "$_HOOK_INPUT" | bash "$script" 2>&1) && exit_code=0 || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    WARNINGS+=("$name: failed")
  elif [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]]; then
    local warn_msg=$(echo "$output" | grep -i "warning" | head -1 | sed 's/.*warning[: ]*//')
    [[ -n "$warn_msg" ]] && WARNINGS+=("$name: $warn_msg")
  fi

  return 0
}

# Run agent hooks in order (all are informational, not blocking)
run_hook "OutputValidator" "$SCRIPT_DIR/output-validator.sh"
run_hook "ContextPublisher" "$SCRIPT_DIR/context-publisher.sh"
run_hook "HandoffPreparer" "$SCRIPT_DIR/handoff-preparer.sh"
run_hook "FeedbackLoop" "$SCRIPT_DIR/feedback-loop.sh"
run_hook "AutoSpawnQuality" "$SCRIPT_DIR/auto-spawn-quality.sh"
run_hook "MultiClaudeVerifier" "$SCRIPT_DIR/multi-claude-verifier.sh"

# Output: silent on success, show warnings if any
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  jq -n --arg msg "⚠ Agent: $WARN_MSG" '{continue:true,systemMessage:$msg}'
else
  # Silent success
  echo '{"continue": true, "suppressOutput": true}'
fi

exit 0