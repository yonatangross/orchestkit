#!/bin/bash
# File Lock Check - PreToolUse Hook for Write
# CC 2.1.2 Compliant: includes continue field in all outputs
# Prevents writing to files locked by other Claude Code instances
#
# BLOCKS: When file is locked by another active instance
# ALLOWS: When file is unlocked or locked by current instance
#
# Version: 1.0.0
# Part of Multi-Worktree Coordination System

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/coordination.sh" 2>/dev/null || {
    # If coordination lib not available, allow operation
    echo '{"continue": true, "suppressOutput": true}'
    exit 0
}

# Parse input from stdin
INPUT=$(cat)

# Extract file path from tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
    # No file path, can't check lock
    echo '{"continue": true, "suppressOutput": true}'
    exit 0
fi

# Check if file is locked
LOCK_STATUS=$(is_file_locked "$FILE_PATH")

if [[ "$LOCK_STATUS" == "false" ]]; then
    # Not locked, acquire lock and proceed
    acquire_file_lock "$FILE_PATH" "write"
    echo '{"continue": true, "suppressOutput": true}'
    exit 0
fi

# File is locked by another instance
LOCK_HOLDER=$(echo "$LOCK_STATUS" | cut -d'|' -f2)
LOCK_INFO=$(get_lock_info "$FILE_PATH")
HOLDER_INFO=$(get_instance_info "$LOCK_HOLDER")

HOLDER_BRANCH=$(echo "$HOLDER_INFO" | jq -r '.branch // "unknown"')
HOLDER_TASK=$(echo "$HOLDER_INFO" | jq -r '.task // "unknown task"')
LOCK_REASON=$(echo "$LOCK_INFO" | jq -r '.reason // "editing"')

# Output block message using correct hookSpecificOutput schema with continue field
jq -n \
  --arg file "$FILE_PATH" \
  --arg holder "$LOCK_HOLDER" \
  --arg branch "$HOLDER_BRANCH" \
  --arg task "$HOLDER_TASK" \
  --arg reason "$LOCK_REASON" \
  '{
    "continue": false,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("File is locked by instance " + $holder + " on branch " + $branch + " for: " + $task + ". Wait or use /worktree-release to force release.")
    }
  }'

exit 0