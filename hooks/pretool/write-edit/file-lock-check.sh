#!/bin/bash
# File Lock Check - Check/acquire locks before Write/Edit operations
# Hook: PreToolUse (Write|Edit)
# CC 2.1.7 Compliant: ensures JSON output on all code paths

set -euo pipefail

# Ensure JSON output on any exit (trap for safety)
trap 'echo "{\"continue\":true,\"suppressOutput\":true}"' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common lib for logging
source "${SCRIPT_DIR}/../../_lib/common.sh" 2>/dev/null || true

# Source coordination lib with fallback
source "${SCRIPT_DIR}/../../../.claude/coordination/lib/coordination.sh" 2>/dev/null || {
    trap - EXIT
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

# Load instance ID
if [[ -f "${CLAUDE_PROJECT_DIR}/.claude/.instance_env" ]]; then
  source "${CLAUDE_PROJECT_DIR}/.claude/.instance_env" 2>/dev/null || true
  export INSTANCE_ID="${CLAUDE_INSTANCE_ID:-}"
fi

# Parse tool input
TOOL_INPUT="${TOOL_INPUT:-}"
if [[ -z "${TOOL_INPUT}" ]]; then
  trap - EXIT
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Extract file path from tool input
FILE_PATH=""
if [[ "${TOOL_NAME:-}" == "Write" ]]; then
  FILE_PATH=$(echo "${TOOL_INPUT}" | jq -r '.file_path // empty' 2>/dev/null || echo "")
elif [[ "${TOOL_NAME:-}" == "Edit" ]]; then
  FILE_PATH=$(echo "${TOOL_INPUT}" | jq -r '.file_path // empty' 2>/dev/null || echo "")
fi

if [[ -z "${FILE_PATH}" ]]; then
  trap - EXIT
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Skip if file is in coordination directory (avoid recursion)
if [[ "${FILE_PATH}" =~ /.claude/coordination/ ]]; then
  trap - EXIT
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Check if file is locked by another instance
if ! coord_check_lock "${FILE_PATH}" 2>/dev/null; then
  HOLDER=$(coord_check_lock "${FILE_PATH}" 2>&1 | grep "Locked by:" | cut -d: -f2 | xargs 2>/dev/null || echo "unknown")
  MSG="File ${FILE_PATH} is locked by instance ${HOLDER}. You may want to wait or check the work registry: .claude/coordination/work-registry.json"
  log_permission_feedback "file-lock-check" "deny" "File $FILE_PATH locked by $HOLDER" 2>/dev/null || true
  trap - EXIT
  jq -n --arg msg "$MSG" '{systemMessage: $msg, continue: false, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "File locked by another instance"}}'
  exit 0
fi

# Try to acquire lock (or renew if we hold it)
INTENT="Modifying file via ${TOOL_NAME:-unknown}"
if ! coord_acquire_lock "${FILE_PATH}" "${INTENT}" 2>/dev/null; then
  EXIT_CODE=$?

  if [[ ${EXIT_CODE} -eq 10 ]]; then
    MSG="Cannot acquire lock on ${FILE_PATH}"
    log_permission_feedback "file-lock-check" "deny" "Lock acquisition failed for $FILE_PATH" 2>/dev/null || true
    trap - EXIT
    jq -n --arg msg "$MSG" '{systemMessage: $msg, continue: false, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Lock acquisition failed"}}'
    exit 0
  elif [[ ${EXIT_CODE} -eq 11 ]]; then
    # Expired lock was cleaned, retry
    coord_acquire_lock "${FILE_PATH}" "${INTENT}" 2>/dev/null || true
  fi
fi

# Check for conflicts (file modified since lock acquired)
CONFLICT_MSG=""
if ! coord_detect_conflict "${FILE_PATH}" 2>/dev/null; then
  CONFLICT_MSG=" (Warning: file has been modified since lock was acquired - consider reviewing changes)"
  log_permission_feedback "file-lock-check" "warn" "File conflict detected: $FILE_PATH" 2>/dev/null || true
fi

# Success - output JSON and clear trap
log_permission_feedback "file-lock-check" "allow" "Lock acquired for $FILE_PATH" 2>/dev/null || true
trap - EXIT
jq -n '{continue: true, suppressOutput: true}'
exit 0