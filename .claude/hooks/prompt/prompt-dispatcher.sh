#!/bin/bash
# UserPromptSubmit Dispatcher - Runs all prompt hooks and outputs combined status
# Consolidates: context-injector, todo-enforcer
set -euo pipefail

# Read stdin once and export for child hooks
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS=()

# Helper to run a hook
run_hook() {
  local name="$1"
  local script="$2"

  if [[ ! -f "$script" ]]; then
    return 0
  fi

  # Run hook with stdin, capture stderr for logs, ignore stdout systemMessage
  if echo "$_HOOK_INPUT" | bash "$script" >/dev/null 2>&1; then
    RESULTS+=("$name")
  fi

  return 0
}

# Run prompt hooks in order
run_hook "Context injected" "$SCRIPT_DIR/context-injector.sh"
run_hook "Todo enforced" "$SCRIPT_DIR/todo-enforcer.sh"

# Build combined output
if [[ ${#RESULTS[@]} -gt 0 ]]; then
  MSG=$(IFS=", "; echo "${RESULTS[*]}")
  echo "{\"systemMessage\": \"$MSG\"}"
fi

exit 0