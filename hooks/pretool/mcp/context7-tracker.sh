#!/bin/bash
set -euo pipefail
# Context7 Tracker - Logs library documentation lookups
# CC 2.1.2 Compliant: includes continue field in all outputs
# Hook: PreToolUse (mcp__context7__*)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../../_lib/common.sh"

TOOL_NAME=$(get_tool_name)

# Track library documentation lookups
if [[ "$TOOL_NAME" == "mcp__context7__resolve-library-id" ]]; then
  LIBRARY=$(get_field '.tool_input.libraryName')
  log_hook "Context7 resolve: $LIBRARY"
  echo "$(date -Iseconds) | resolve | $LIBRARY" >> "/tmp/claude-context7-usage.log"
fi

if [[ "$TOOL_NAME" == "mcp__context7__get-library-docs" ]]; then
  LIBRARY_ID=$(get_field '.tool_input.context7CompatibleLibraryID')
  TOPIC=$(get_field '.tool_input.topic')
  log_hook "Context7 docs: $LIBRARY_ID (topic: $TOPIC)"
  echo "$(date -Iseconds) | docs | $LIBRARY_ID | $TOPIC" >> "/tmp/claude-context7-usage.log"
fi

# CC 2.1.2 Compliant: JSON output without ANSI colors
# (Colors in JSON break JSON parsing)
echo '{"continue": true, "suppressOutput": true}'
exit 0