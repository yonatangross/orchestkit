#!/bin/bash
set -euo pipefail
# File Lock Release - Release locks after successful Write/Edit
# Hook: PostToolUse (Write|Edit)

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

# Skip if file is in coordination directory
if [[ "${FILE_PATH}" =~ /.claude/coordination/ ]]; then
  exit 0
fi

# Only release lock if tool execution was successful
TOOL_ERROR="${TOOL_ERROR:-}"
if [[ -n "${TOOL_ERROR}" ]]; then
  # Keep lock on error, will auto-expire in 5 minutes
  exit 0
fi

# Release lock
coord_release_lock "${FILE_PATH}"

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
exit 0
