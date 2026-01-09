#!/bin/bash
# PreToolUse Dispatcher - Runs all pre-tool checks and outputs combined status
# CC 2.1.2 Compliant: silent on success, visible on failure/warning
# Consolidates multiple hooks into single message
set -euo pipefail

# Read stdin once
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

# ANSI colors
RED=$'\033[31m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

TOOL_NAME=$(get_tool_name)
WARNINGS=()
BLOCKED=""
UPDATED_INPUT=""

# Helper to run a check
run_check() {
  local name="$1"
  local script="$2"

  if [[ ! -f "$script" ]]; then
    return 0
  fi

  local output
  local exit_code
  output=$(echo "$_HOOK_INPUT" | bash "$script" 2>/dev/null) && exit_code=0 || exit_code=$?

  if [[ $exit_code -eq 0 && -n "$output" ]]; then
    # Check if it's blocking
    local decision=$(echo "$output" | jq -r '.hookSpecificOutput.permissionDecision // .decision // ""' 2>/dev/null)
    if [[ "$decision" == "deny" || "$decision" == "block" ]]; then
      BLOCKED="$name"
      echo "$output"
      return 1
    fi

    # Check for warnings
    local msg=$(echo "$output" | jq -r '.systemMessage // ""' 2>/dev/null)
    if [[ "$msg" == *"warning"* ]] || [[ "$msg" == *"Warning"* ]] || [[ "$msg" == *"⚠"* ]]; then
      WARNINGS+=("$name")
    fi

    # Check for updated input
    local updated=$(echo "$output" | jq -r '.hookSpecificOutput.updatedInput // .updatedInput // ""' 2>/dev/null)
    if [[ -n "$updated" && "$updated" != "null" ]]; then
      UPDATED_INPUT="$output"
    fi
  fi

  return 0
}

# Run checks based on tool type
case "$TOOL_NAME" in
  Bash)
    run_check "Defaults" "$SCRIPT_DIR/input-mod/bash-defaults.sh" || exit 0
    run_check "Branch" "$SCRIPT_DIR/bash/git-branch-protection.sh" || exit 0
    ;;
  Read|Glob|Grep)
    run_check "Path" "$SCRIPT_DIR/input-mod/path-normalizer.sh" || exit 0
    ;;
  Write|Edit)
    run_check "Path" "$SCRIPT_DIR/input-mod/path-normalizer.sh" || exit 0
    run_check "Guard" "$SCRIPT_DIR/write-edit/file-guard.sh" || exit 0
    run_check "Lock" "$SCRIPT_DIR/write-edit/file-lock-check.sh" || exit 0
    ;;
  Task)
    run_check "Gate" "$SCRIPT_DIR/task/context-gate.sh" || exit 0
    ;;
esac

# Output: show warnings if any, otherwise silent (but include updated input if present)
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  if [[ -n "$UPDATED_INPUT" ]]; then
    echo "$UPDATED_INPUT" | jq --arg msg "${YELLOW}⚠ ${WARN_MSG}${RESET}" '.systemMessage = $msg | .continue = true'
  else
    echo "{\"systemMessage\": \"${YELLOW}⚠ ${WARN_MSG}${RESET}\", \"continue\": true}"
  fi
elif [[ -n "$UPDATED_INPUT" ]]; then
  # Silent success with updated input - remove systemMessage
  echo "$UPDATED_INPUT" | jq 'del(.systemMessage) | .continue = true | .suppressOutput = true'
else
  # Silent success - no systemMessage
  echo "{\"continue\": true}"
fi

exit 0