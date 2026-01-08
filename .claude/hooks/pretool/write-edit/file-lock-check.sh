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
  exit 0
fi

# Skip if file is in coordination directory (avoid recursion)
if [[ "${FILE_PATH}" =~ /.claude/coordination/ ]]; then
  exit 0
fi

# Check if file is locked by another instance
if ! coord_check_lock "${FILE_PATH}"; then
  HOLDER=$(coord_check_lock "${FILE_PATH}" 2>&1 | grep "Locked by:" | cut -d: -f2 | xargs || echo "unknown")
  echo "WARNING: File ${FILE_PATH} is locked by instance ${HOLDER}" >&2
  echo "You may want to wait or check the work registry: .claude/coordination/work-registry.json" >&2
  exit 1
fi

# Try to acquire lock (or renew if we hold it)
INTENT="Modifying file via ${TOOL_NAME}"
if ! coord_acquire_lock "${FILE_PATH}" "${INTENT}"; then
  EXIT_CODE=$?

  if [[ ${EXIT_CODE} -eq 10 ]]; then
    echo "ERROR: Cannot acquire lock on ${FILE_PATH}" >&2
    exit 1
  elif [[ ${EXIT_CODE} -eq 11 ]]; then
    # Expired lock was cleaned, retry
    coord_acquire_lock "${FILE_PATH}" "${INTENT}"
  fi
fi

# Check for conflicts (file modified since lock acquired)
if ! coord_detect_conflict "${FILE_PATH}"; then
  echo "WARNING: File ${FILE_PATH} has been modified since lock was acquired" >&2
  echo "This may indicate concurrent edits. Consider reviewing changes." >&2
fi

# Output systemMessage for user visibility
echo '{"systemMessage":"File lock checked"}'
exit 0
