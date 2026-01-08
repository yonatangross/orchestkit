#!/bin/bash
set -euo pipefail
# Sound Notifications - Plays sounds for task completion
# Hook: Notification

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

MESSAGE=$(get_field '.message')
LEVEL=$(get_field '.level')

log_hook "Sound notification check: [$LEVEL]"

# Play sound based on level (macOS only)
if command -v afplay &>/dev/null; then
  case "$LEVEL" in
    error)
      afplay /System/Library/Sounds/Basso.aiff 2>/dev/null &
      ;;
    warning)
      afplay /System/Library/Sounds/Sosumi.aiff 2>/dev/null &
      ;;
    success)
      afplay /System/Library/Sounds/Glass.aiff 2>/dev/null &
      ;;
  esac
fi

exit 0
