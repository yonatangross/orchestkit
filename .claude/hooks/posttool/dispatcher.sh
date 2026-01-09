#!/bin/bash
# PostToolUse Dispatcher - Runs all post-tool checks and outputs combined status
# CC 2.1.2 Compliant: silent on success, visible on failure/warning
set -euo pipefail

_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$SCRIPT_DIR/../skill"
source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || true

# ANSI colors
RED=$'\033[31m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

TOOL_NAME=$(echo "$_HOOK_INPUT" | jq -r '.tool_name // "unknown"')
TOOL_RESULT=$(echo "$_HOOK_INPUT" | jq -r '.tool_result // ""')
FILE_PATH=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.file_path // ""')

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
  elif [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]] || [[ "$output" == *"BLOCKED"* ]]; then
    # Extract warning/block message
    local warn_msg=$(echo "$output" | grep -iE "(warning|blocked)" | head -1 | sed 's/.*\(warning\|BLOCKED\)[: ]*//')
    [[ -n "$warn_msg" ]] && WARNINGS+=("$name: $warn_msg")
  fi

  return 0
}

# Run core checks (always)
run_check "Audit" "$SCRIPT_DIR/audit-logger.sh"
run_check "Metrics" "$SCRIPT_DIR/session-metrics.sh"

# Tool-specific checks
case "$TOOL_NAME" in
  Write|Edit)
    run_check "Lock" "$SCRIPT_DIR/write-edit/file-lock-release.sh"
    # Skill validators (consolidated from separate hooks)
    run_check "Layers" "$SKILL_DIR/backend-layer-validator.sh"
    run_check "Imports" "$SKILL_DIR/import-direction-enforcer.sh"
    run_check "DI" "$SKILL_DIR/di-pattern-enforcer.sh"
    run_check "Tests" "$SKILL_DIR/test-pattern-validator.sh"
    run_check "Patterns" "$SKILL_DIR/pattern-consistency-enforcer.sh"
    run_check "Duplicates" "$SKILL_DIR/duplicate-code-detector.sh"
    run_check "Cross-test" "$SKILL_DIR/cross-instance-test-validator.sh"
    run_check "Merge" "$SKILL_DIR/merge-conflict-predictor.sh"
    run_check "Migration" "$SKILL_DIR/migration-validator.sh"
    ;;
  Bash)
    run_check "Errors" "$SCRIPT_DIR/error-tracker.sh"
    run_check "Secrets" "$SKILL_DIR/redact-secrets.sh"
    # Check if command failed
    if [[ "$TOOL_RESULT" == *"error"* ]] || [[ "$TOOL_RESULT" == *"Error"* ]]; then
      WARNINGS+=("Command may have errors")
    fi
    ;;
  Task)
    run_check "Heartbeat" "$SCRIPT_DIR/coordination-heartbeat.sh"
    ;;
esac

# Output: silent on success, show warnings if any
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  echo "{\"systemMessage\": \"${YELLOW}⚠ ${WARN_MSG}${RESET}\", \"continue\": true}"
else
  # Silent success - no systemMessage
  echo "{\"continue\": true}"
fi

exit 0