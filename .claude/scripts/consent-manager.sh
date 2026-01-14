#!/usr/bin/env bash
# consent-manager.sh - GDPR-compliant consent management for anonymous analytics
# Part of SkillForge Claude Plugin
#
# This module implements the consent gate for analytics collection.
# NO DATA IS COLLECTED OR TRANSMITTED WITHOUT EXPLICIT USER CONSENT.
#
# Usage:
#   source ".claude/scripts/consent-manager.sh"
#   if has_consent; then
#     # Proceed with analytics
#   fi
#
# Issue: #59 - Optional Anonymous Analytics
# Version: 1.0.0

set -euo pipefail

# Guard against re-sourcing (prevents readonly variable errors)
[[ -n "${_CONSENT_MANAGER_LOADED:-}" ]] && return 0
_CONSENT_MANAGER_LOADED=1

# =============================================================================
# CONSTANTS
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Feedback directory
FEEDBACK_DIR="${FEEDBACK_DIR:-${PROJECT_ROOT}/.claude/feedback}"
CONSENT_LOG_FILE="${CONSENT_LOG_FILE:-${FEEDBACK_DIR}/consent-log.json}"
PREFERENCES_FILE="${PREFERENCES_FILE:-${FEEDBACK_DIR}/preferences.json}"

# Current consent version - bump this when privacy policy changes significantly
readonly CONSENT_VERSION="1.0"

# =============================================================================
# INITIALIZATION
# =============================================================================

# Initialize consent log if needed
_init_consent_log() {
    mkdir -p "$FEEDBACK_DIR"

    if [[ ! -f "$CONSENT_LOG_FILE" ]]; then
        cat > "$CONSENT_LOG_FILE" << 'EOF'
{
  "$schema": "../schemas/consent.schema.json",
  "version": "1.0",
  "events": []
}
EOF
    fi
}

# =============================================================================
# CONSENT STATE
# =============================================================================

# Check if user has given consent for anonymous analytics
# Returns: 0 if consent granted, 1 if not
has_consent() {
    # Check preferences file for shareAnonymized flag
    if [[ ! -f "$PREFERENCES_FILE" ]]; then
        return 1  # No preferences = no consent
    fi

    local sharing
    sharing=$(jq -r '.shareAnonymized // false' "$PREFERENCES_FILE" 2>/dev/null || echo "false")

    [[ "$sharing" == "true" ]]
}

# Check if user has ever been asked about consent
# Returns: 0 if asked before, 1 if never asked
has_been_asked() {
    if [[ ! -f "$CONSENT_LOG_FILE" ]]; then
        return 1
    fi

    local event_count
    event_count=$(jq '.events | length' "$CONSENT_LOG_FILE" 2>/dev/null || echo "0")

    [[ "$event_count" -gt 0 ]]
}

# Get current consent status as JSON
get_consent_status() {
    _init_consent_log

    local has_consent_val="false"
    local has_been_asked_val="false"
    local consent_version=""
    local consented_at=""
    local last_action=""

    if has_consent; then
        has_consent_val="true"
    fi

    if has_been_asked; then
        has_been_asked_val="true"

        # Get last event details
        local last_event
        last_event=$(jq '.events[-1] // {}' "$CONSENT_LOG_FILE" 2>/dev/null || echo '{}')

        last_action=$(echo "$last_event" | jq -r '.action // ""')
        consent_version=$(echo "$last_event" | jq -r '.version // ""')
        consented_at=$(echo "$last_event" | jq -r '.timestamp // ""')
    fi

    jq -n \
        --argjson hasConsent "$has_consent_val" \
        --argjson hasBeenAsked "$has_been_asked_val" \
        --arg consentVersion "$consent_version" \
        --arg consentedAt "$consented_at" \
        --arg lastAction "$last_action" \
        --arg currentVersion "$CONSENT_VERSION" \
        '{
            hasConsent: $hasConsent,
            hasBeenAsked: $hasBeenAsked,
            consentVersion: (if $consentVersion != "" then $consentVersion else null end),
            consentedAt: (if $consentedAt != "" then $consentedAt else null end),
            lastAction: (if $lastAction != "" then $lastAction else null end),
            currentPolicyVersion: $currentVersion
        }'
}

# =============================================================================
# CONSENT MANAGEMENT
# =============================================================================

# Record user granting consent
# Usage: record_consent
record_consent() {
    _init_consent_log

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Update consent log
    local tmp_file
    tmp_file=$(mktemp)

    jq --arg now "$now" --arg version "$CONSENT_VERSION" '
        .events += [{
            "action": "granted",
            "version": $version,
            "timestamp": $now
        }]
    ' "$CONSENT_LOG_FILE" > "$tmp_file" && mv "$tmp_file" "$CONSENT_LOG_FILE"

    # Update preferences
    if [[ -f "$PREFERENCES_FILE" ]]; then
        tmp_file=$(mktemp)
        jq --arg now "$now" --arg version "$CONSENT_VERSION" '
            .shareAnonymized = true |
            .consentedAt = $now |
            .consentVersion = $version
        ' "$PREFERENCES_FILE" > "$tmp_file" && mv "$tmp_file" "$PREFERENCES_FILE"
    else
        mkdir -p "$(dirname "$PREFERENCES_FILE")"
        cat > "$PREFERENCES_FILE" << EOF
{
  "version": "1.0",
  "enabled": true,
  "learnFromEdits": true,
  "learnFromApprovals": true,
  "learnFromAgentOutcomes": true,
  "shareAnonymized": true,
  "consentedAt": "$now",
  "consentVersion": "$CONSENT_VERSION",
  "syncGlobalPatterns": true,
  "retentionDays": 90,
  "pausedUntil": null
}
EOF
    fi

    return 0
}

# Record user declining consent
# Usage: record_decline
record_decline() {
    _init_consent_log

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Update consent log
    local tmp_file
    tmp_file=$(mktemp)

    jq --arg now "$now" --arg version "$CONSENT_VERSION" '
        .events += [{
            "action": "declined",
            "version": $version,
            "timestamp": $now
        }]
    ' "$CONSENT_LOG_FILE" > "$tmp_file" && mv "$tmp_file" "$CONSENT_LOG_FILE"

    # Ensure preferences has shareAnonymized = false
    if [[ -f "$PREFERENCES_FILE" ]]; then
        tmp_file=$(mktemp)
        jq '.shareAnonymized = false' "$PREFERENCES_FILE" > "$tmp_file" && mv "$tmp_file" "$PREFERENCES_FILE"
    fi

    return 0
}

# Record user revoking previously granted consent
# Usage: revoke_consent
revoke_consent() {
    _init_consent_log

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Update consent log
    local tmp_file
    tmp_file=$(mktemp)

    jq --arg now "$now" '
        .events += [{
            "action": "revoked",
            "timestamp": $now
        }]
    ' "$CONSENT_LOG_FILE" > "$tmp_file" && mv "$tmp_file" "$CONSENT_LOG_FILE"

    # Update preferences
    if [[ -f "$PREFERENCES_FILE" ]]; then
        tmp_file=$(mktemp)
        jq '.shareAnonymized = false | del(.consentedAt) | del(.consentVersion)' "$PREFERENCES_FILE" > "$tmp_file" && mv "$tmp_file" "$PREFERENCES_FILE"
    fi

    return 0
}

# =============================================================================
# OPT-IN PROMPT UI
# =============================================================================

# Show the opt-in prompt and record response
# Returns: 0 if user opted in, 1 if declined
show_opt_in_prompt() {
    # Check if running in non-interactive mode
    if [[ ! -t 0 ]]; then
        return 1  # Non-interactive, skip prompt
    fi

    cat << 'EOF'

┌─────────────────────────────────────────────────────────────┐
│  📊 Help Improve SkillForge                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Share anonymous usage statistics to help improve the       │
│  plugin for everyone.                                       │
│                                                             │
│  What we collect (examples):                                │
│  • "api-design skill used 12 times, 92% success"            │
│  • "backend-architect agent: 88% success rate"              │
│  • "bash hook blocked 3 commands this week"                 │
│                                                             │
│  What we NEVER collect:                                     │
│  • Your code or file contents                               │
│  • Project names or file paths                              │
│  • Personal information or mem0 data                        │
│                                                             │
│  You can change this anytime: /skf:feedback opt-out         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

EOF

    local response=""
    while [[ "$response" != "y" && "$response" != "n" ]]; do
        printf "Enable anonymous analytics sharing? [y/n]: "
        read -r response
        response=$(echo "$response" | tr '[:upper:]' '[:lower:]')
    done

    if [[ "$response" == "y" ]]; then
        record_consent
        echo ""
        echo "Thank you! Anonymous analytics sharing enabled."
        echo "Disable anytime with: /skf:feedback opt-out"
        return 0
    else
        record_decline
        echo ""
        echo "No problem! Analytics sharing disabled."
        echo "You can enable it anytime with: /skf:feedback opt-in"
        return 1
    fi
}

# Show a brief reminder about analytics (for periodic prompts)
# Only shows if user hasn't been asked recently
show_reminder_prompt() {
    # Check if running in non-interactive mode
    if [[ ! -t 0 ]]; then
        return 1
    fi

    # Don't show if already consented or recently declined
    if has_consent; then
        return 0  # Already sharing
    fi

    # Check last decline time
    if [[ -f "$CONSENT_LOG_FILE" ]]; then
        local last_decline
        last_decline=$(jq -r '.events | map(select(.action == "declined")) | .[-1].timestamp // ""' "$CONSENT_LOG_FILE" 2>/dev/null || echo "")

        if [[ -n "$last_decline" ]]; then
            # Don't remind for 30 days after decline
            local decline_ts
            decline_ts=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_decline" +%s 2>/dev/null || echo "0")
            local now_ts
            now_ts=$(date +%s)
            local days_since=$(( (now_ts - decline_ts) / 86400 ))

            if [[ $days_since -lt 30 ]]; then
                return 1  # Too soon to remind
            fi
        fi
    fi

    # Show brief reminder
    cat << 'EOF'

┌──────────────────────────────────────────────────────────┐
│ 📊 Quick reminder: Anonymous analytics help us improve   │
│    SkillForge. Enable with: /skf:feedback opt-in        │
└──────────────────────────────────────────────────────────┘

EOF

    return 1
}

# =============================================================================
# PRIVACY INFORMATION
# =============================================================================

# Display full privacy policy
show_privacy_policy() {
    cat << 'EOF'

═══════════════════════════════════════════════════════════════════════════════
                     SKILLFORGE ANONYMOUS ANALYTICS PRIVACY POLICY
═══════════════════════════════════════════════════════════════════════════════

WHAT WE COLLECT (only with your consent)
────────────────────────────────────────────────────────────────────────────────

  ✓ Skill usage counts        - e.g., "api-design used 45 times"
  ✓ Skill success rates       - e.g., "92% success rate"
  ✓ Agent spawn counts        - e.g., "backend-architect spawned 8 times"
  ✓ Agent success rates       - e.g., "88% tasks completed successfully"
  ✓ Hook trigger counts       - e.g., "bash-dispatcher triggered 120 times"
  ✓ Hook block counts         - e.g., "blocked 5 potentially unsafe commands"
  ✓ Plugin version            - e.g., "4.12.0"
  ✓ Report date               - e.g., "2026-01-14" (date only, no time)


WHAT WE NEVER COLLECT
────────────────────────────────────────────────────────────────────────────────

  ✗ Your code or file contents
  ✗ Project names, paths, or directory structure
  ✗ User names, emails, or any personal information
  ✗ IP addresses (stripped at network layer)
  ✗ mem0 memory data or conversation history
  ✗ Architecture decisions or design documents
  ✗ API keys, tokens, or credentials
  ✗ Git history or commit messages
  ✗ Any data that could identify you or your projects


HOW DATA IS PROTECTED
────────────────────────────────────────────────────────────────────────────────

  1. Explicit Consent Required
     - No data is collected until you actively opt in
     - Declining is the default - we never assume consent

  2. Local Validation
     - All data is scanned for PII patterns before export
     - Any detection of personal information aborts the process

  3. Transmission Security
     - HTTPS only, no cookies, no tracking headers
     - No IP logging on receiving servers

  4. Data Retention
     - Raw reports deleted after aggregation (max 30 days)
     - Only aggregate statistics retained


YOUR RIGHTS
────────────────────────────────────────────────────────────────────────────────

  • Opt-out anytime:     /skf:feedback opt-out
  • View your data:      /skf:feedback export
  • Check status:        /skf:feedback status
  • View this policy:    /skf:feedback privacy


CONTACT
────────────────────────────────────────────────────────────────────────────────

  Repository:  https://github.com/yonatangross/skillforge-claude-plugin
  Issues:      https://github.com/yonatangross/skillforge-claude-plugin/issues

═══════════════════════════════════════════════════════════════════════════════

EOF
}

# =============================================================================
# STATUS DISPLAY
# =============================================================================

# Show human-readable consent status
show_consent_status() {
    local status
    status=$(get_consent_status)

    local has_consent_val
    has_consent_val=$(echo "$status" | jq -r '.hasConsent')

    local has_been_asked_val
    has_been_asked_val=$(echo "$status" | jq -r '.hasBeenAsked')

    local consent_version
    consent_version=$(echo "$status" | jq -r '.consentVersion // "N/A"')

    local consented_at
    consented_at=$(echo "$status" | jq -r '.consentedAt // "N/A"')

    local last_action
    last_action=$(echo "$status" | jq -r '.lastAction // "N/A"')

    echo ""
    echo "Analytics Consent Status"
    echo "────────────────────────────"

    if [[ "$has_consent_val" == "true" ]]; then
        echo "Status: ENABLED (sharing anonymous data)"
        echo "Consented: $consented_at"
        echo "Policy version: $consent_version"
    elif [[ "$has_been_asked_val" == "true" ]]; then
        echo "Status: DISABLED (not sharing)"
        echo "Last action: $last_action"
    else
        echo "Status: NOT CONFIGURED"
        echo "Run /skf:feedback opt-in to enable"
    fi

    echo ""
    echo "Commands:"
    echo "  /skf:feedback opt-in   - Enable sharing"
    echo "  /skf:feedback opt-out  - Disable sharing"
    echo "  /skf:feedback export   - Export data for review"
    echo "  /skf:feedback privacy  - View privacy policy"
    echo ""
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f has_consent
export -f has_been_asked
export -f get_consent_status
export -f record_consent
export -f record_decline
export -f revoke_consent
export -f show_opt_in_prompt
export -f show_reminder_prompt
export -f show_privacy_policy
export -f show_consent_status
export CONSENT_VERSION