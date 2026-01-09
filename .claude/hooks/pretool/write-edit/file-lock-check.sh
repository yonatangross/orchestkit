#!/bin/bash
set -euo pipefail
# File Lock Check - Check/acquire locks before Write/Edit operations
# Hook: PreToolUse (Write|Edit)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../../coordination/lib/coordination.sh"

# Load instance ID
if [[ -f "${CLAUDE_PROJECT_DIR}/.claude/.instance_env" ]]; then
  source "${CLAUDE_PROJECT_DIR}/.claude/.instance_env"
  export INSTANCE_ID="${CLAUDE_INSTANCE_ID}"
fi

# Parse tool input
TOOL_INPUT="${TOOL_INPUT:-}"
if [[ -z "${TOOL_INPUT}" ]]; then
  echo '{"systemMessage":"No tool input","continue":true}'
  exit 0
fi

# Extract file path from tool input
FILE_PATH=""
if [[ "${TOOL_NAME}" == "Write" ]]; then
  FILE_PATH=$(echo "${TOOL_INPUT}" | jq -r '.file_path // empty' 2>/dev/null || echo "")
elif [[ "${TOOL_NAME}" == "Edit" ]]; then
  FILE_PATH=$(echo "${TOOL_INPUT}" | jq -r '.file_path // empty' 2>/dev/null || echo "")
fi

if [[ -z "${FILE_PATH}" ]]; then
  echo '{"systemMessage":"No file path found","continue":true}'
  exit 0
fi

# Skip if file is in coordination directory (avoid recursion)
if [[ "${FILE_PATH}" =~ /.claude/coordination/ ]]; then
  echo '{"systemMessage":"Skipping coordination files","continue":true}'
  exit 0
fi

# Check if file is locked by another instance
if ! coord_check_lock "${FILE_PATH}"; then
  HOLDER=$(coord_check_lock "${FILE_PATH}" 2>&1 | grep "Locked by:" | cut -d: -f2 | xargs || echo "unknown")
  MSG="File ${FILE_PATH} is locked by instance ${HOLDER}. You may want to wait or check the work registry: .claude/coordination/work-registry.json"
  jq -n --arg msg "$MSG" '{systemMessage: $msg, continue: false, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "File locked by another instance"}}'
  exit 0
fi

# Try to acquire lock (or renew if we hold it)
INTENT="Modifying file via ${TOOL_NAME}"
if ! coord_acquire_lock "${FILE_PATH}" "${INTENT}"; then
  EXIT_CODE=$?

  if [[ ${EXIT_CODE} -eq 10 ]]; then
    MSG="Cannot acquire lock on ${FILE_PATH}"
    jq -n --arg msg "$MSG" '{systemMessage: $msg, continue: false, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Lock acquisition failed"}}'
    exit 0
  elif [[ ${EXIT_CODE} -eq 11 ]]; then
    # Expired lock was cleaned, retry
    coord_acquire_lock "${FILE_PATH}" "${INTENT}"
  fi
fi

# Check for conflicts (file modified since lock acquired)
CONFLICT_MSG=""
if ! coord_detect_conflict "${FILE_PATH}"; then
  CONFLICT_MSG=" (Warning: file has been modified since lock was acquired - consider reviewing changes)"
fi

# Output systemMessage for user visibility
jq -n --arg msg "File lock checked${CONFLICT_MSG}" '{systemMessage: $msg, continue: true}'
exit 0
