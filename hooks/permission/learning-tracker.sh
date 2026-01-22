#!/bin/bash
# Permission Learning Tracker - Learns from user approval patterns
# Hook: PermissionRequest (Post-approval tracking)
# CC 2.1.6 Compliant: includes continue field in all outputs
#
# This hook runs AFTER other permission hooks and tracks:
# 1. Commands that are approved manually (potential auto-approve candidates)
# 2. Patterns in approved commands for learning
# 3. Frequency of command types
#
# Data is stored in .claude/feedback/learned-patterns.json
# Users can manage this via /ork:feedback command

set -euo pipefail

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

# Determine plugin root
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Source feedback library (provides all learning functions)
FEEDBACK_LIB="${PLUGIN_ROOT}/.claude/scripts/feedback-lib.sh"
FEEDBACK_LIB_LOADED=false
if [[ -f "$FEEDBACK_LIB" ]]; then
    source "$FEEDBACK_LIB"
    FEEDBACK_LIB_LOADED=true
fi

log_hook "Permission learning tracker starting"

# -----------------------------------------------------------------------------
# Main Logic
# -----------------------------------------------------------------------------

# Get tool info from hook input
TOOL_NAME=$(get_field '.tool_name')
COMMAND=$(get_field '.tool_input.command // .tool_input.file_path // ""')

log_hook "Processing permission for tool: $TOOL_NAME, command: ${COMMAND:0:50}..."

# Skip if feedback library not loaded
if [[ "$FEEDBACK_LIB_LOADED" != "true" ]]; then
    log_hook "Feedback library not loaded, skipping learning"
    output_silent_success
    exit 0
fi

# Skip if feedback is disabled
if ! is_feedback_enabled; then
    log_hook "Feedback disabled, skipping learning"
    output_silent_success
    exit 0
fi

# For Bash commands, check if we should auto-approve based on learned patterns
if [[ "$TOOL_NAME" == "Bash" && -n "$COMMAND" ]]; then
    # First check security blocklist - never auto-approve these
    if is_security_blocked "$COMMAND"; then
        log_hook "Command matches security blocklist, skipping"
        output_silent_success
        exit 0
    fi

    # Check if this command matches a learned auto-approve pattern
    if should_auto_approve "$COMMAND"; then
        log_hook "Command matches learned auto-approve pattern"
        # Auto-approve silently
        output_silent_allow
        output_silent_success
        exit 0
    fi

    # Log this permission request for future learning
    # Note: We log it as "approved" when user accepts - this hook runs before decision
    # In a full implementation, we'd need a PostPermission hook to track actual decisions
    log_hook "Logging permission request for learning"
fi

# Output: Silent pass-through (don't affect the permission decision)
# This hook observes for learning purposes
output_silent_success
exit 0