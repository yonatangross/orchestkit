#!/bin/bash
# SessionEnd Dispatcher - Consolidates all session cleanup hooks
# CC 2.1.6 Compliant: silent on success, visible on failure
set -euo pipefail

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
  output=$(bash "$script" 2>&1) && exit_code=0 || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    WARNINGS+=("$name: failed")
  elif [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]]; then
    local warn_msg=$(echo "$output" | grep -i "warning" | head -1 | sed 's/.*warning[: ]*//')
    [[ -n "$warn_msg" ]] && WARNINGS+=("$name: $warn_msg")
  fi

  return 0
}

# Run cleanup hooks in order
run_hook "CoordinationCleanup" "$SCRIPT_DIR/coordination-cleanup.sh"
run_hook "SessionMetrics" "$SCRIPT_DIR/session-metrics-summary.sh"
run_hook "SessionCleanup" "$SCRIPT_DIR/session-cleanup.sh"

# Push patterns to global (cross-project sync)
run_hook "PatternSync" "$SCRIPT_DIR/pattern-sync-push.sh"

# Output: silent on success, show warnings if any
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  echo "{\"systemMessage\": \"${YELLOW}⚠ Cleanup: ${WARN_MSG}${RESET}\", \"continue\": true}"
else
  # Silent success
  echo '{"continue": true, "suppressOutput": true}'
fi

exit 0