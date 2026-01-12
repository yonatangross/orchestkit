#!/bin/bash
set -euo pipefail
# Sound Notifications - Plays sounds for task completion
# Hook: Notification

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

MESSAGE=$(get_field '.message')
NOTIFICATION_TYPE=$(get_field '.notification_type')

log_hook "Sound notification check: [$NOTIFICATION_TYPE]"

# Play sound based on notification_type (macOS only)
# Valid notification_type values: permission_prompt, idle_prompt, auth_success, elicitation_dialog
if command -v afplay &>/dev/null; then
  case "$NOTIFICATION_TYPE" in
    permission_prompt)
      afplay /System/Library/Sounds/Sosumi.aiff 2>/dev/null &
      ;;
    idle_prompt)
      afplay /System/Library/Sounds/Ping.aiff 2>/dev/null &
      ;;
    auth_success)
      afplay /System/Library/Sounds/Glass.aiff 2>/dev/null &
      ;;
  esac
fi

# CC 2.1.2 Compliant: output JSON with continue field
echo '{"continue":true}'
exit 0
