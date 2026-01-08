#!/bin/bash
# SessionStart Dispatcher - Runs all startup hooks and outputs combined status
# CC 2.1.1 Compliant: includes continue field in all outputs
# Consolidates: coordination-init, session-context-loader, session-env-setup
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS=()

# ANSI colors
GREEN=$'\033[32m'
CYAN=$'\033[36m'
RESET=$'\033[0m'

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
run_hook "Coordination" "$SCRIPT_DIR/coordination-init.sh"
run_hook "Context loaded" "$SCRIPT_DIR/session-context-loader.sh"
run_hook "Environment" "$SCRIPT_DIR/session-env-setup.sh"

# Build combined output
if [[ ${#RESULTS[@]} -gt 0 ]]; then
  # Format: Startup: ✓ Check1 | ✓ Check2 | ✓ Check3
  MSG=""
  for i in "${!RESULTS[@]}"; do
    if [[ $i -gt 0 ]]; then
      MSG="$MSG | "
    fi
    MSG="$MSG${GREEN}✓${RESET} ${RESULTS[$i]}"
  done
  echo "{\"systemMessage\": \"$MSG\", \"continue\": true}"
fi

exit 0