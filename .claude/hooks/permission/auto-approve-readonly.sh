#!/bin/bash
set -euo pipefail
# Auto-Approve Readonly - Automatically approves read-only operations
# Hook: PermissionRequest (Read|Glob|Grep)
# CC 2.1.2 Compliant: includes continue field in all outputs

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

TOOL_NAME=$(get_tool_name)

log_hook "Auto-approving readonly: $TOOL_NAME"

# Silent approval with CC 2.1.2 compliant output
echo '{"decision":{"behavior":"allow"}, "continue": true}'

exit 0