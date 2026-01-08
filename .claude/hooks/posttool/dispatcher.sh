#!/bin/bash
# PostToolUse Dispatcher - Runs all post-tool checks and outputs combined status
# CC 2.1.1 Compliant: includes continue field in all outputs
set -euo pipefail

_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || true

# ANSI colors
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
CYAN=$'\033[36m'
RESET=$'\033[0m'

TOOL_NAME=$(echo "$_HOOK_INPUT" | jq -r '.tool_name // "unknown"')
TOOL_RESULT=$(echo "$_HOOK_INPUT" | jq -r '.tool_result // ""')
FILE_PATH=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.file_path // ""')

CHECKS=()
WARNINGS=()

# Runner that captures warnings
run_check() {
  local name="$1"
  local script="$2"

  if [[ ! -f "$script" ]]; then
    return 0
  fi

  local output
  local exit_code
  output=$(echo "$_HOOK_INPUT" | bash "$script" 2>&1) && exit_code=0 || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    WARNINGS+=("$name: check failed")
  elif [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]]; then
    # Extract warning message
    local warn_msg=$(echo "$output" | grep -i "warning" | head -1 | sed 's/.*warning[: ]*//')
    [[ -n "$warn_msg" ]] && WARNINGS+=("$name: $warn_msg")
  fi

  CHECKS+=("$name")
  return 0
}

# Run core checks
run_check "Audit logged" "$SCRIPT_DIR/audit-logger.sh"
run_check "Metrics" "$SCRIPT_DIR/session-metrics.sh"

# Tool-specific checks
case "$TOOL_NAME" in
  Write|Edit)
    run_check "Lock released" "$SCRIPT_DIR/write-edit/file-lock-release.sh"
    run_check "Patterns OK" "$SCRIPT_DIR/../skill/test-pattern-validator.sh"
    run_check "Imports OK" "$SCRIPT_DIR/../skill/import-direction-enforcer.sh"
    run_check "Layers OK" "$SCRIPT_DIR/../skill/backend-layer-validator.sh"
    ;;
  Bash)
    run_check "Errors checked" "$SCRIPT_DIR/error-tracker.sh"
    # Check if command failed
    if [[ "$TOOL_RESULT" == *"error"* ]] || [[ "$TOOL_RESULT" == *"Error"* ]]; then
      WARNINGS+=("Command may have errors")
    fi
    ;;
  Task)
    run_check "Heartbeat" "$SCRIPT_DIR/coordination-heartbeat.sh"
    ;;
esac

# Build output message
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  # Show warnings prominently
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  echo "{\"systemMessage\": \"${YELLOW}⚠ ${WARN_MSG}${RESET}\", \"continue\": true}"
elif [[ ${#CHECKS[@]} -gt 0 ]]; then
  # Format: ToolName: ✓ Check1 | ✓ Check2 | ✓ Check3
  MSG=""
  for i in "${!CHECKS[@]}"; do
    if [[ $i -gt 0 ]]; then
      MSG="$MSG | "
    fi
    MSG="$MSG${GREEN}✓${RESET} ${CHECKS[$i]}"
  done
  echo "{\"systemMessage\": \"$MSG\", \"continue\": true}"
fi

exit 0