#!/bin/bash
set -euo pipefail
# Memory Validator - Warns on destructive memory operations
# CC 2.1.2 Compliant: includes continue field in all outputs
# Hook: PreToolUse (mcp__memory__*)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../../_lib/common.sh"

TOOL_NAME=$(get_tool_name)

log_hook "Memory tool: $TOOL_NAME"

# Warn on delete operations
if [[ "$TOOL_NAME" =~ delete ]]; then
  ENTITY_NAMES=$(get_field '.tool_input.entityNames')
  RELATIONS=$(get_field '.tool_input.relations')

  warn_with_box "Memory Deletion" "DELETING from knowledge graph:
Tool: $TOOL_NAME
Entities: ${ENTITY_NAMES:-N/A}
Relations: ${RELATIONS:-N/A}

This operation cannot be undone."
fi

# CC 2.1.2 Compliant: JSON output without ANSI colors
# (Colors in JSON break JSON parsing)
echo '{"systemMessage":"Memory validated", "continue": true}'
exit 0