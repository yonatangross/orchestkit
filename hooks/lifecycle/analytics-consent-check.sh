#!/bin/bash
# analytics-consent-check.sh - Check if user needs to be prompted for analytics consent
# Part of SkillForge Claude Plugin (#59)
#
# This hook runs on session start to check if user has been asked about analytics.
# It outputs a gentle reminder or first-time prompt if appropriate.
#
# CC 2.1.7 Compliant: uses hookSpecificOutput.additionalContext for context injection
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Source consent manager
CONSENT_MANAGER="$PROJECT_ROOT/.claude/scripts/consent-manager.sh"
if [[ ! -f "$CONSENT_MANAGER" ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# shellcheck source=../../.claude/scripts/consent-manager.sh
source "$CONSENT_MANAGER"

# Check consent status
if has_consent; then
    # Already consented - nothing to do
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

if has_been_asked; then
    # Already asked and declined - check if we should show reminder
    # Get last decline time
    CONSENT_LOG="${PROJECT_ROOT}/.claude/feedback/consent-log.json"
    if [[ -f "$CONSENT_LOG" ]]; then
        last_event=$(jq -r '.events[-1] // {}' "$CONSENT_LOG" 2>/dev/null || echo '{}')
        last_action=$(echo "$last_event" | jq -r '.action // ""')

        if [[ "$last_action" == "declined" || "$last_action" == "revoked" ]]; then
            # Check if 30 days have passed
            last_timestamp=$(echo "$last_event" | jq -r '.timestamp // ""')
            if [[ -n "$last_timestamp" ]]; then
                # Parse timestamp and check days
                decline_ts=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_timestamp" +%s 2>/dev/null || echo "0")
                now_ts=$(date +%s)
                days_since=$(( (now_ts - decline_ts) / 86400 ))

                if [[ $days_since -ge 30 ]]; then
                    # Show gentle reminder (not blocking)
                    reminder='📊 Reminder: Anonymous analytics help improve SkillForge. Enable with /skf:feedback opt-in'
                    jq -nc --arg msg "$reminder" '{systemMessage:$msg,continue:true}'
                    exit 0
                fi
            fi
        fi
    fi

    # Don't show anything if recently asked
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# First time - show a brief notice (not the full prompt, to avoid blocking)
# The full prompt will be shown when user runs /skf:feedback
first_time_msg='📊 SkillForge collects local usage metrics. Share anonymously with /skf:feedback opt-in'
jq -nc --arg msg "$first_time_msg" '{systemMessage:$msg,continue:true}'
exit 0