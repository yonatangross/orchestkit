#!/usr/bin/env bash
# analytics-lib.sh - Anonymous analytics preparation
# Part of OrchestKit Claude Plugin
#
# This library prepares anonymous, aggregated usage data for optional sharing.
# CRITICAL: No PII (Personally Identifiable Information) is ever included.
#
# Usage:
#   source ".claude/scripts/analytics-lib.sh"
#   prepare_anonymous_report
#   export_analytics "/path/to/export.json"
#
# Issue: #59 - Optional Anonymous Analytics
# Version: 1.0.0

set -euo pipefail

# =============================================================================
# CONSTANTS
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Feedback directory
FEEDBACK_DIR="${FEEDBACK_DIR:-${PROJECT_ROOT}/.claude/feedback}"
METRICS_FILE="${METRICS_FILE:-${FEEDBACK_DIR}/metrics.json}"
PREFERENCES_FILE="${PREFERENCES_FILE:-${FEEDBACK_DIR}/preferences.json}"

# Analytics export directory
ANALYTICS_EXPORT_DIR="${FEEDBACK_DIR}/analytics-exports"

# Plugin version - read from plugin.json if available
PLUGIN_VERSION="4.12.0"
if [[ -f "${PROJECT_ROOT}/.claude-plugin/plugin.json" ]]; then
    PLUGIN_VERSION=$(jq -r '.version // "4.12.0"' "${PROJECT_ROOT}/.claude-plugin/plugin.json" 2>/dev/null || echo "4.12.0")
fi

# =============================================================================
# PII PATTERNS - Strings that could identify users or projects
# =============================================================================

# Patterns that indicate potential PII - NEVER include these in analytics
readonly PII_PATTERNS=(
    # File paths and project identifiers
    '/Users/'
    '/home/'
    '/var/'
    '/tmp/'
    'C:\\'
    'D:\\'

    # Common project path patterns
    '/projects/'
    '/workspace/'
    '/code/'
    '/repos/'
    '/Documents/'
    '/Desktop/'

    # Email patterns (loose match to catch variations)
    '@'

    # URL patterns
    'http://'
    'https://'
    'ftp://'

    # Common secret patterns
    'password'
    'secret'
    'token'
    'api_key'
    'apikey'
    'api-key'
    'credential'
    'private_key'
    'ssh_key'
    'bearer'

    # User identifiers
    'username'
    'user_id'
    'userid'
    'account'
    'email'

    # IP addresses (v4 pattern)
    '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}'
)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Source feedback-lib if available
_source_feedback_lib() {
    local feedback_lib="${SCRIPT_DIR}/feedback-lib.sh"
    if [[ -f "$feedback_lib" ]]; then
        # shellcheck source=feedback-lib.sh
        source "$feedback_lib"
    fi
}

# Check if anonymous sharing is enabled
is_sharing_enabled() {
    if [[ ! -f "$PREFERENCES_FILE" ]]; then
        return 1  # Default to disabled
    fi

    local sharing
    sharing=$(jq -r '.shareAnonymized // false' "$PREFERENCES_FILE" 2>/dev/null || echo "false")

    [[ "$sharing" == "true" ]]
}

# =============================================================================
# PII VALIDATION
# =============================================================================

# Validate that data contains no PII
# Usage: validate_no_pii "$data"
# Returns: 0 if clean, 1 if PII detected
validate_no_pii() {
    local data="$1"

    # Check for empty data
    if [[ -z "$data" ]]; then
        return 0
    fi

    # Check against all PII patterns
    for pattern in "${PII_PATTERNS[@]}"; do
        if echo "$data" | grep -qiE "$pattern" 2>/dev/null; then
            echo "PII_DETECTED: Pattern '$pattern' found in data" >&2
            return 1
        fi
    done

    # Check for potential file paths (anything starting with /)
    if echo "$data" | grep -qE '"/[^"]+/"' 2>/dev/null; then
        echo "PII_DETECTED: Potential file path found" >&2
        return 1
    fi

    # Check for UUIDs that might be session identifiers
    # Allow UUIDs in aggregate data, but not as identifiable keys
    # This is OK because they're anonymized

    return 0
}

# Sanitize a string by removing potential PII
# Usage: sanitized=$(sanitize_string "$raw_string")
sanitize_string() {
    local input="$1"
    local output="$input"

    # Remove file paths
    output=$(echo "$output" | sed -E 's|/[a-zA-Z0-9_/.~-]+||g')

    # Remove email-like patterns
    output=$(echo "$output" | sed -E 's/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}//g')

    # Remove IP addresses
    output=$(echo "$output" | sed -E 's/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}//g')

    # Remove URLs
    output=$(echo "$output" | sed -E 's|https?://[^ ]+||g')

    echo "$output"
}

# =============================================================================
# METRICS AGGREGATION
# =============================================================================

# Get aggregated skill usage metrics (anonymized)
# Returns JSON object with skill usage counts and success rates
get_skill_metrics() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo '{}'
        return
    fi

    # Extract only the metrics, no identifiable information
    jq '
        .skills // {} |
        to_entries |
        map({
            key: .key,
            value: {
                uses: (.value.uses // 0),
                success_rate: (
                    if (.value.uses // 0) > 0 then
                        ((.value.successes // 0) / .value.uses) | . * 100 | floor / 100
                    else 0 end
                )
            }
        }) |
        from_entries
    ' "$METRICS_FILE" 2>/dev/null || echo '{}'
}

# Get aggregated agent performance metrics (anonymized)
# Returns JSON object with agent spawn counts and success rates
get_agent_metrics() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo '{}'
        return
    fi

    jq '
        .agents // {} |
        to_entries |
        map({
            key: .key,
            value: {
                spawns: (.value.spawns // 0),
                success_rate: (
                    if (.value.spawns // 0) > 0 then
                        ((.value.successes // 0) / .value.spawns) | . * 100 | floor / 100
                    else 0 end
                )
            }
        }) |
        from_entries
    ' "$METRICS_FILE" 2>/dev/null || echo '{}'
}

# Get aggregated hook metrics (anonymized)
# Returns JSON object with hook trigger and block counts
get_hook_metrics() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo '{}'
        return
    fi

    jq '
        .hooks // {} |
        to_entries |
        map({
            key: .key,
            value: {
                triggered: (.value.triggered // 0),
                blocked: (.value.blocked // 0)
            }
        }) |
        from_entries
    ' "$METRICS_FILE" 2>/dev/null || echo '{}'
}

# =============================================================================
# SHAREABLE METRICS
# =============================================================================

# Get only safe-to-share metrics
# Returns JSON object suitable for anonymous sharing
get_shareable_metrics() {
    local timestamp
    timestamp=$(date +"%Y-%m-%d")

    local skills
    skills=$(get_skill_metrics)

    local agents
    agents=$(get_agent_metrics)

    local hooks
    hooks=$(get_hook_metrics)

    # Build the shareable report
    local report
    report=$(jq -n \
        --arg timestamp "$timestamp" \
        --arg plugin_version "$PLUGIN_VERSION" \
        --argjson skill_usage "$skills" \
        --argjson agent_performance "$agents" \
        --argjson hook_metrics "$hooks" \
        '{
            timestamp: $timestamp,
            plugin_version: $plugin_version,
            skill_usage: $skill_usage,
            agent_performance: $agent_performance,
            hook_metrics: $hook_metrics
        }')

    echo "$report"
}

# =============================================================================
# REPORT PREPARATION
# =============================================================================

# Prepare anonymous report with full validation
# Returns validated JSON or empty object if validation fails
prepare_anonymous_report() {
    local report
    report=$(get_shareable_metrics)

    # Validate no PII in the report
    if ! validate_no_pii "$report"; then
        echo "ERROR: PII detected in analytics report, aborting" >&2
        echo '{}'
        return 1
    fi

    # Add summary statistics
    local skill_count agent_count hook_count total_skill_uses total_agent_spawns

    skill_count=$(echo "$report" | jq '.skill_usage | length')
    agent_count=$(echo "$report" | jq '.agent_performance | length')
    hook_count=$(echo "$report" | jq '.hook_metrics | length')
    total_skill_uses=$(echo "$report" | jq '[.skill_usage[].uses] | add // 0')
    total_agent_spawns=$(echo "$report" | jq '[.agent_performance[].spawns] | add // 0')

    # Add summary to report
    report=$(echo "$report" | jq \
        --argjson skill_count "$skill_count" \
        --argjson agent_count "$agent_count" \
        --argjson hook_count "$hook_count" \
        --argjson total_skill_uses "$total_skill_uses" \
        --argjson total_agent_spawns "$total_agent_spawns" \
        '. + {
            summary: {
                unique_skills_used: $skill_count,
                unique_agents_used: $agent_count,
                hooks_configured: $hook_count,
                total_skill_invocations: $total_skill_uses,
                total_agent_spawns: $total_agent_spawns
            }
        }')

    echo "$report"
}

# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================

# Export analytics to file for user review
# Usage: export_analytics "/path/to/export.json"
# If no path provided, exports to default location with timestamp
export_analytics() {
    local export_path="${1:-}"

    # Generate default path if not provided
    if [[ -z "$export_path" ]]; then
        mkdir -p "$ANALYTICS_EXPORT_DIR"
        export_path="${ANALYTICS_EXPORT_DIR}/analytics-export-$(date +%Y%m%d-%H%M%S).json"
    fi

    # Prepare the report
    local report
    report=$(prepare_anonymous_report)

    if [[ -z "$report" || "$report" == "{}" ]]; then
        echo "ERROR: Failed to prepare analytics report" >&2
        return 1
    fi

    # Add export metadata
    report=$(echo "$report" | jq \
        --arg exported_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg export_path "$export_path" \
        '. + {
            metadata: {
                exported_at: $exported_at,
                format_version: "1.0",
                note: "This file contains anonymous, aggregated usage data. Review before sharing."
            }
        }')

    # Write to file
    echo "$report" | jq '.' > "$export_path"

    echo "Analytics exported to: $export_path"
    echo ""
    echo "Contents preview:"
    echo "─────────────────"
    echo "$report" | jq -r '
        "Date: \(.timestamp)",
        "Plugin Version: \(.plugin_version)",
        "",
        "Summary:",
        "  Skills used: \(.summary.unique_skills_used)",
        "  Skill invocations: \(.summary.total_skill_invocations)",
        "  Agents used: \(.summary.unique_agents_used)",
        "  Agent spawns: \(.summary.total_agent_spawns)",
        "  Hooks configured: \(.summary.hooks_configured)"
    '
    echo ""
    echo "Please review the exported file before sharing."

    return 0
}

# Get analytics status
# Shows current analytics configuration and data availability
get_analytics_status() {
    local sharing_enabled
    if is_sharing_enabled; then
        sharing_enabled="Enabled"
    else
        sharing_enabled="Disabled"
    fi

    local has_metrics="No"
    if [[ -f "$METRICS_FILE" ]]; then
        has_metrics="Yes"
    fi

    local skill_count=0 agent_count=0 hook_count=0
    if [[ -f "$METRICS_FILE" ]]; then
        skill_count=$(jq '.skills | length' "$METRICS_FILE" 2>/dev/null || echo "0")
        agent_count=$(jq '.agents | length' "$METRICS_FILE" 2>/dev/null || echo "0")
        hook_count=$(jq '.hooks | length' "$METRICS_FILE" 2>/dev/null || echo "0")
    fi

    cat << EOF
Analytics Status
────────────────────────────
Anonymous Sharing: $sharing_enabled
Metrics Available: $has_metrics

Data Summary:
  Skills tracked: $skill_count
  Agents tracked: $agent_count
  Hooks tracked: $hook_count

Export Directory: $ANALYTICS_EXPORT_DIR

Commands:
  Enable sharing:  /feedback opt-in
  Disable sharing: /feedback opt-out
  Export data:     Use export_analytics function
EOF
}

# =============================================================================
# OPT-IN/OPT-OUT FUNCTIONS
# =============================================================================

# Enable anonymous sharing
opt_in_analytics() {
    _source_feedback_lib

    if [[ -f "$PREFERENCES_FILE" ]]; then
        local tmp_file
        tmp_file=$(mktemp)
        jq '.shareAnonymized = true' "$PREFERENCES_FILE" > "$tmp_file" && mv "$tmp_file" "$PREFERENCES_FILE"
    else
        mkdir -p "$(dirname "$PREFERENCES_FILE")"
        cat > "$PREFERENCES_FILE" << 'EOF'
{
  "version": "1.0",
  "enabled": true,
  "learnFromEdits": true,
  "learnFromApprovals": true,
  "learnFromAgentOutcomes": true,
  "shareAnonymized": true,
  "syncGlobalPatterns": true,
  "retentionDays": 90,
  "pausedUntil": null
}
EOF
    fi

    echo "Anonymous analytics sharing enabled."
    echo ""
    echo "What we share (anonymized):"
    echo "  - Skill usage counts and success rates"
    echo "  - Agent performance metrics"
    echo "  - Hook trigger counts"
    echo ""
    echo "What we NEVER share:"
    echo "  - Your code or file contents"
    echo "  - Project names or paths"
    echo "  - Personal information"
    echo "  - mem0 memory data"
    echo ""
    echo "Disable anytime: /feedback opt-out"
}

# Disable anonymous sharing
opt_out_analytics() {
    _source_feedback_lib

    if [[ -f "$PREFERENCES_FILE" ]]; then
        local tmp_file
        tmp_file=$(mktemp)
        jq '.shareAnonymized = false' "$PREFERENCES_FILE" > "$tmp_file" && mv "$tmp_file" "$PREFERENCES_FILE"
    fi

    echo "Anonymous analytics sharing disabled."
    echo ""
    echo "Your feedback data stays completely local."
    echo "No usage data is shared."
    echo ""
    echo "Re-enable anytime: /feedback opt-in"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f is_sharing_enabled
export -f validate_no_pii
export -f sanitize_string
export -f get_skill_metrics
export -f get_agent_metrics
export -f get_hook_metrics
export -f get_shareable_metrics
export -f prepare_anonymous_report
export -f export_analytics
export -f get_analytics_status
export -f opt_in_analytics
export -f opt_out_analytics