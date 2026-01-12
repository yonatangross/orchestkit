#!/bin/bash
# UserPromptSubmit Dispatcher - Runs all prompt hooks and outputs combined status
# CC 2.1.2 Compliant: silent on success, visible on failure
# Consolidates: context-injector, todo-enforcer
set -euo pipefail

# Read stdin once and export for child hooks
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WARNINGS=()

# ANSI colors
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Helper to run a hook
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

# Run prompt hooks in order
run_hook "Context" "$SCRIPT_DIR/context-injector.sh"
run_hook "Todo" "$SCRIPT_DIR/todo-enforcer.sh"

# Output: silent on success, show warnings if any
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  echo "{\"systemMessage\": \"${YELLOW}⚠ ${WARN_MSG}${RESET}\", \"continue\": true, \"suppressOutput\": false}"
else
  # Silent success - no systemMessage
  echo "{\"continue\": true, \"suppressOutput\": true}"
fi

exit 0