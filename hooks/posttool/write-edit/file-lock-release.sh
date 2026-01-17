#!/bin/bash
# File Lock Release - Release locks after successful Write/Edit
# CC 2.1.7 Compliant: Self-contained hook with stdin reading and self-guard
# Hook: PostToolUse (Write|Edit)
set -euo pipefail

# Read stdin BEFORE sourcing common.sh
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/common.sh"

# EXIT trap to ensure JSON output on unexpected exits only
trap 'echo "{\"continue\":true,\"suppressOutput\":true}"' EXIT

# Helper to exit cleanly (clears trap first to avoid double output)
clean_exit() {
    trap - EXIT
    output_silent_success
    exit 0
}

# Self-guard: Only run for Write/Edit (silent check, no output)
TOOL_NAME_CHECK=$(get_field '.tool_name // ""')
if [[ "$TOOL_NAME_CHECK" != "Write" && "$TOOL_NAME_CHECK" != "Edit" ]]; then
    clean_exit
fi

# Self-guard: Only run if multi-instance coordination is enabled
if ! is_multi_instance_enabled; then
    clean_exit
fi

# Source coordination lib
COORD_LIB="${SCRIPT_DIR}/../../../.claude/coordination/lib/coordination.sh"
if [[ ! -f "$COORD_LIB" ]]; then
    clean_exit
fi
source "$COORD_LIB" 2>/dev/null || { clean_exit; }

# Load instance ID
if [[ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/.instance_env" ]]; then
  source "${CLAUDE_PROJECT_DIR:-.}/.claude/.instance_env"
  export INSTANCE_ID="${CLAUDE_INSTANCE_ID:-}"
fi

# Get file path
FILE_PATH=$(get_field '.tool_input.file_path')
[[ -z "$FILE_PATH" ]] && clean_exit

# Skip coordination directory files
[[ "$FILE_PATH" =~ /.claude/coordination/ ]] && clean_exit

# Check for errors in tool result
TOOL_RESULT=$(get_field '.tool_result // ""')
if [[ "$TOOL_RESULT" == *"error"* ]] || [[ "$TOOL_RESULT" == *"Error"* ]]; then
    # Keep lock on error, will auto-expire
    clean_exit
fi

# Release lock
coord_release_lock "$FILE_PATH" 2>/dev/null || true

# Success
clean_exit