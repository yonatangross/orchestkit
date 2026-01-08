#!/bin/bash
# PreToolUse Dispatcher - Runs all pre-tool checks and outputs combined status
# Consolidates multiple hooks into single message
set -euo pipefail

# Read stdin once
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

TOOL_NAME=$(get_tool_name)
RESULTS=()
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

    # Check for updated input
    local updated=$(echo "$output" | jq -r '.hookSpecificOutput.updatedInput // .updatedInput // ""' 2>/dev/null)
    if [[ -n "$updated" && "$updated" != "null" ]]; then
      UPDATED_INPUT="$output"
    fi

    RESULTS+=("$name")
  elif [[ $exit_code -eq 0 ]]; then
    RESULTS+=("$name")
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

# Build output
if [[ -n "$UPDATED_INPUT" ]]; then
  # Return the updated input with combined message
  MSG=$(IFS=", "; echo "${RESULTS[*]}")
  echo "$UPDATED_INPUT" | jq --arg msg "$MSG" '.systemMessage = $msg'
elif [[ ${#RESULTS[@]} -gt 0 ]]; then
  MSG=$(IFS=", "; echo "${RESULTS[*]}")
  echo "{\"systemMessage\": \"$MSG\"}"
fi

exit 0
