#!/bin/bash
set -euo pipefail
# Auto-Approve Readonly - Automatically approves read-only operations
# Hook: PermissionRequest (Read|Glob|Grep)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

TOOL_NAME=$(get_tool_name)

log_hook "Auto-approving readonly: $TOOL_NAME"

# Use decision.message for user-visible status
echo '{"decision":{"behavior":"allow","message":"Readonly auto-approved"}}'

exit 0
