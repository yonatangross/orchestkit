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
NOTIFICATION_TYPE=$(get_field '.notification_type')

log_hook "Notification: [$NOTIFICATION_TYPE] $MESSAGE"

# Show desktop notifications for permission prompts and idle prompts
# Valid notification_type values: permission_prompt, idle_prompt, auth_success, elicitation_dialog
if [[ "$NOTIFICATION_TYPE" == "permission_prompt" ]] || [[ "$NOTIFICATION_TYPE" == "idle_prompt" ]]; then
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

# CC 2.1.2 Compliant: output JSON with continue field
echo '{"continue":true}'
exit 0
