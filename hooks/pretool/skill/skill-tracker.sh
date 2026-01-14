#!/bin/bash
set -euo pipefail
# Skill Tracker - Logs Skill tool invocations with analytics
# CC 2.1.6 Compliant: includes continue field in all outputs
# Hook: PreToolUse (Skill)
#
# Enhanced for Phase 4: Skill Usage Analytics (#56)
# - Integrates with feedback-lib for persistent metrics
# - Tracks skill usage patterns over time
# - Enables context efficiency optimization
#
# Version: 2.0.0
# Part of Auto-Feedback Self-Improvement Loop (#50)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/common.sh"

# Source feedback lib for metrics
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
FEEDBACK_LIB="${PLUGIN_ROOT}/.claude/scripts/feedback-lib.sh"
if [[ -f "$FEEDBACK_LIB" ]]; then
    source "$FEEDBACK_LIB"
fi

SKILL_NAME=$(get_field '.tool_input.skill')
SKILL_ARGS=$(get_field '.tool_input.args')

log_hook "Skill invocation: $SKILL_NAME ${SKILL_ARGS:+(args: $SKILL_ARGS)}"

# Log to temporary usage log for quick access
USAGE_LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/skill-usage.log"
mkdir -p "$(dirname "$USAGE_LOG")" 2>/dev/null || true
echo "$(date -Iseconds) | $SKILL_NAME | ${SKILL_ARGS:-no args}" >> "$USAGE_LOG"

# Log to feedback system for persistent analytics
if type log_skill_usage &>/dev/null; then
    # Track with 0 edits initially - posttool hook will update with actual edits
    log_skill_usage "$SKILL_NAME" "true" "0"
    log_hook "Skill usage logged to feedback system"
fi

# Log to JSONL for detailed analytics
SKILL_ANALYTICS="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/skill-analytics.jsonl"
jq -n \
    --arg skill "$SKILL_NAME" \
    --arg args "${SKILL_ARGS:-}" \
    --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --arg project "$(basename "${CLAUDE_PROJECT_DIR:-.}")" \
    '{
        skill: $skill,
        args: $args,
        timestamp: $timestamp,
        project: $project,
        phase: "start"
    }' >> "$SKILL_ANALYTICS"

# Info message (logged, not displayed)
info "Invoking skill: $SKILL_NAME"

# CC 2.1.6 Compliant: JSON output without ANSI colors
echo '{"continue": true, "suppressOutput": true}'
exit 0