#!/bin/bash
set -euo pipefail
# Subagent Completion Tracker - Minimal hook
# Hook: SubagentStop
#
# LIMITATION: Claude Code SubagentStop does NOT provide subagent_type.
# Available fields: session_id, transcript_path, permission_mode, hook_event_name
#
# Subagent TYPE tracking is done in PreToolUse (subagent-validator.sh)
# This hook only logs completion events for session correlation.

source "$(dirname "$0")/../_lib/common.sh"

SESSION_ID=$(get_session_id)
log_hook "Subagent completed (session: $SESSION_ID)"

exit 0
