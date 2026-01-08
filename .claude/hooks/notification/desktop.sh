#!/bin/bash
# Desktop Notifications - Sends desktop notifications for important events
# Hook: Notification
#
# SECURITY: This hook displays user-controlled messages.
# All message content is escaped before interpolation to prevent injection.

set -euo pipefail

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

MESSAGE=$(get_field '.message')
LEVEL=$(get_field '.level')

log_hook "Notification: [$LEVEL] $MESSAGE"

# Only show desktop notifications for important events
if [[ "$LEVEL" == "error" ]] || [[ "$LEVEL" == "warning" ]]; then
  # Escape message for safe shell interpolation (HI-001 fix)
  # Replace backslashes first, then double quotes
  SAFE_MESSAGE="${MESSAGE//\\/\\\\}"
  SAFE_MESSAGE="${SAFE_MESSAGE//\"/\\\"}"

  # macOS notification
  if command -v osascript &>/dev/null; then
    osascript -e "display notification \"$SAFE_MESSAGE\" with title \"Claude Code\" sound name \"Ping\"" 2>/dev/null || true
  # Linux notification (ME-003: use -- to mark end of options)
  elif command -v notify-send &>/dev/null; then
    notify-send -- "Claude Code" "$MESSAGE" 2>/dev/null || true
  fi
fi

exit 0
