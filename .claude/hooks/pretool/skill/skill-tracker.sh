#!/bin/bash
set -euo pipefail
# Skill Tracker - Logs Skill tool invocations
# CC 2.1.1 Compliant: includes continue field in all outputs
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

# ANSI colors for consolidated output
GREEN=$'\033[32m'
CYAN=$'\033[36m'
RESET=$'\033[0m'

# Format: Skill: ✓ Tracked
MSG="${GREEN}✓${RESET} Skill tracked"
echo "{\"systemMessage\":\"$MSG\", \"continue\": true}"
exit 0