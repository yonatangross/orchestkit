#!/bin/bash
# Stop Dispatcher - Runs all stop hooks and outputs combined status
# Consolidates: task-completion-check, auto-save-context
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS=()

# Helper to run a hook
run_hook() {
  local name="$1"
  local script="$2"

  if [[ ! -f "$script" ]]; then
    return 0
  fi

  # Run hook, capture stderr for logs, ignore stdout systemMessage
  if bash "$script" >/dev/null 2>&1; then
    RESULTS+=("$name")
  fi

  return 0
}

# Run stop hooks in order
run_hook "Task completion checked" "$SCRIPT_DIR/task-completion-check.sh"
run_hook "Context saved" "$SCRIPT_DIR/auto-save-context.sh"

# Build combined output
if [[ ${#RESULTS[@]} -gt 0 ]]; then
  MSG=$(IFS=", "; echo "${RESULTS[*]}")
  echo "{\"systemMessage\": \"$MSG\"}"
fi

exit 0