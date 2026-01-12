#!/bin/bash
set -euo pipefail
# Skill Tracker - Logs Skill tool invocations
# CC 2.1.2 Compliant: includes continue field in all outputs
# Hook: PreToolUse (Skill)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../../_lib/common.sh"

SKILL_NAME=$(get_field '.tool_input.skill')
SKILL_ARGS=$(get_field '.tool_input.args')

log_hook "Skill invocation: $SKILL_NAME ${SKILL_ARGS:+(args: $SKILL_ARGS)}"

# Log skill usage for analytics
USAGE_LOG="/tmp/claude-skill-usage.log"
echo "$(date -Iseconds) | $SKILL_NAME | ${SKILL_ARGS:-no args}" >> "$USAGE_LOG"

# Info message
info "Invoking skill: $SKILL_NAME"

# CC 2.1.2 Compliant: JSON output without ANSI colors
# (Colors in JSON break JSON parsing)
echo '{"continue": true, "suppressOutput": true}'
exit 0