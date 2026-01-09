#!/bin/bash
set -euo pipefail
# Playwright Safety - Validates browser automation operations
# CC 2.1.2 Compliant: includes continue field in all outputs
# Hook: PreToolUse (mcp__playwright__*)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../../_lib/common.sh"

TOOL_NAME=$(get_tool_name)

log_hook "Playwright tool: $TOOL_NAME"

# Log navigation for security awareness
if [[ "$TOOL_NAME" == "mcp__playwright__browser_navigate" ]]; then
  URL=$(get_field '.tool_input.url')
  log_hook "Browser navigating to: $URL"
  info "Browser navigating to: $URL"
fi

# Warn on file upload
if [[ "$TOOL_NAME" == "mcp__playwright__browser_file_upload" ]]; then
  PATHS=$(get_field '.tool_input.paths')
  warn "Playwright file upload: $PATHS"
  log_hook "File upload: $PATHS"
fi

# CC 2.1.2 Compliant: JSON output without ANSI colors
# (Colors in JSON break JSON parsing)
echo '{"systemMessage":"Browser safe", "continue": true}'
exit 0