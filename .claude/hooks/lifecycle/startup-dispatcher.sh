#!/bin/bash
# SessionStart Dispatcher - Runs all startup hooks and outputs combined status
# Consolidates: coordination-init, session-context-loader, session-env-setup
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

# Run startup hooks in order
run_hook "Coordination initialized" "$SCRIPT_DIR/coordination-init.sh"
run_hook "Session context loaded" "$SCRIPT_DIR/session-context-loader.sh"
run_hook "Session env setup" "$SCRIPT_DIR/session-env-setup.sh"

# Build combined output
if [[ ${#RESULTS[@]} -gt 0 ]]; then
  MSG=$(IFS=", "; echo "${RESULTS[*]}")
  echo "{\"systemMessage\": \"$MSG\"}"
fi

exit 0