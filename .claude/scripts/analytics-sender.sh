#!/usr/bin/env bash
# analytics-sender.sh - Optional network transmission for anonymous analytics
# Part of OrchestKit Claude Plugin
#
# This module handles optional transmission of anonymous analytics to a server.
# IMPORTANT: This is entirely optional and disabled by default.
#
# Usage:
#   source ".claude/scripts/analytics-sender.sh"
#   send_analytics_report
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
PREFERENCES_FILE="${PREFERENCES_FILE:-${FEEDBACK_DIR}/preferences.json}"
SENT_LOG_FILE="${FEEDBACK_DIR}/analytics-sent.json"

# Default analytics endpoint (can be overridden)
# Empty by default - no network transmission without explicit configuration
ANALYTICS_ENDPOINT="${ORCHESTKIT_ANALYTICS_ENDPOINT:-}"

# User agent string (no identifying info)
USER_AGENT="OrchestKit-Analytics/1.0"

# =============================================================================
# DEPENDENCIES
# =============================================================================

# Source consent manager
_source_consent_manager() {
    local consent_script="${SCRIPT_DIR}/consent-manager.sh"
    if [[ -f "$consent_script" ]]; then
        # shellcheck source=consent-manager.sh
        source "$consent_script"
    else
        echo "ERROR: consent-manager.sh not found" >&2
        return 1
    fi
}

# Source analytics lib
_source_analytics_lib() {
    local analytics_script="${SCRIPT_DIR}/analytics-lib.sh"
    if [[ -f "$analytics_script" ]]; then
        # shellcheck source=analytics-lib.sh
        source "$analytics_script"
    else
        echo "ERROR: analytics-lib.sh not found" >&2
        return 1
    fi
}

# =============================================================================
# TRANSMISSION CONTROL
# =============================================================================

# Check if transmission is enabled
# Returns: 0 if enabled, 1 if disabled
is_transmission_enabled() {
    # Must have consent first
    _source_consent_manager || return 1
    if ! has_consent; then
        return 1
    fi

    # Must have an endpoint configured
    if [[ -z "$ANALYTICS_ENDPOINT" ]]; then
        return 1
    fi

    # Check preferences for network transmission flag
    if [[ -f "$PREFERENCES_FILE" ]]; then
        local network_enabled
        network_enabled=$(jq -r '.enableNetworkTransmission // false' "$PREFERENCES_FILE" 2>/dev/null || echo "false")
        [[ "$network_enabled" == "true" ]] && return 0
    fi

    return 1
}

# Enable network transmission
enable_transmission() {
    _source_consent_manager || return 1

    if ! has_consent; then
        echo "ERROR: Must opt-in to analytics first (/ork:feedback opt-in)" >&2
        return 1
    fi

    if [[ -f "$PREFERENCES_FILE" ]]; then
        local tmp_file
        tmp_file=$(mktemp)
        jq '.enableNetworkTransmission = true' "$PREFERENCES_FILE" > "$tmp_file" && mv "$tmp_file" "$PREFERENCES_FILE"
    fi

    echo "Network transmission enabled."
    echo "Reports will be sent to: ${ANALYTICS_ENDPOINT:-'(not configured)'}"
}

# Disable network transmission
disable_transmission() {
    if [[ -f "$PREFERENCES_FILE" ]]; then
        local tmp_file
        tmp_file=$(mktemp)
        jq '.enableNetworkTransmission = false' "$PREFERENCES_FILE" > "$tmp_file" && mv "$tmp_file" "$PREFERENCES_FILE"
    fi

    echo "Network transmission disabled."
    echo "Analytics data will only be stored locally."
}

# =============================================================================
# SENDING LOGIC
# =============================================================================

# Send analytics report to server
# Returns: 0 on success, 1 on failure
send_analytics_report() {
    # Source dependencies
    _source_consent_manager || return 1
    _source_analytics_lib || return 1

    # Check consent
    if ! has_consent; then
        echo "ERROR: No consent for analytics sharing" >&2
        return 1
    fi

    # Check transmission enabled
    if ! is_transmission_enabled; then
        echo "INFO: Network transmission not enabled. Use local export instead." >&2
        echo "      Run: /ork:feedback export" >&2
        return 1
    fi

    # Check endpoint configured
    if [[ -z "$ANALYTICS_ENDPOINT" ]]; then
        echo "ERROR: No analytics endpoint configured" >&2
        echo "       Set ORCHESTKIT_ANALYTICS_ENDPOINT environment variable" >&2
        return 1
    fi

    # Prepare report
    local report
    report=$(prepare_anonymous_report)

    if [[ -z "$report" || "$report" == "{}" ]]; then
        echo "ERROR: Failed to prepare analytics report" >&2
        return 1
    fi

    # Final PII validation before sending
    if ! validate_no_pii "$report"; then
        echo "ERROR: PII detected in report, aborting transmission" >&2
        return 1
    fi

    # Get plugin version for header
    local plugin_version
    plugin_version=$(echo "$report" | jq -r '.plugin_version // "unknown"')

    # Send via curl (best effort, no retries)
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "User-Agent: $USER_AGENT" \
        -H "X-Plugin-Version: $plugin_version" \
        -d "$report" \
        --max-time 10 \
        "$ANALYTICS_ENDPOINT" 2>/dev/null || echo "000")

    # Log the attempt
    _log_send_attempt "$http_code" "$report"

    # Check response
    if [[ "$http_code" == "200" || "$http_code" == "201" || "$http_code" == "204" ]]; then
        echo "Analytics report sent successfully."
        return 0
    else
        echo "INFO: Could not send analytics (HTTP $http_code). Data saved locally." >&2
        return 1
    fi
}

# Log send attempt for audit
_log_send_attempt() {
    local http_code="$1"
    local report="$2"

    mkdir -p "$FEEDBACK_DIR"

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local success="false"
    if [[ "$http_code" == "200" || "$http_code" == "201" || "$http_code" == "204" ]]; then
        success="true"
    fi

    # Extract summary for logging (not full report)
    local summary
    summary=$(echo "$report" | jq '{
        timestamp: .timestamp,
        plugin_version: .plugin_version,
        summary: .summary
    }')

    if [[ ! -f "$SENT_LOG_FILE" ]]; then
        echo '{"sends": []}' > "$SENT_LOG_FILE"
    fi

    local tmp_file
    tmp_file=$(mktemp)

    jq --arg now "$now" \
       --arg code "$http_code" \
       --argjson success "$success" \
       --argjson summary "$summary" '
        .sends += [{
            "timestamp": $now,
            "httpCode": $code,
            "success": $success,
            "summary": $summary
        }] |
        .sends = .sends[-20:]
    ' "$SENT_LOG_FILE" > "$tmp_file" && mv "$tmp_file" "$SENT_LOG_FILE"
}

# =============================================================================
# STATUS & HISTORY
# =============================================================================

# Show transmission status
show_transmission_status() {
    _source_consent_manager 2>/dev/null || true

    local consent_status="No"
    if has_consent 2>/dev/null; then
        consent_status="Yes"
    fi

    local transmission_status="Disabled"
    if is_transmission_enabled 2>/dev/null; then
        transmission_status="Enabled"
    fi

    local endpoint_status="Not configured"
    if [[ -n "$ANALYTICS_ENDPOINT" ]]; then
        endpoint_status="$ANALYTICS_ENDPOINT"
    fi

    local last_send="Never"
    local last_success="N/A"
    if [[ -f "$SENT_LOG_FILE" ]]; then
        last_send=$(jq -r '.sends[-1].timestamp // "Never"' "$SENT_LOG_FILE" 2>/dev/null || echo "Never")
        last_success=$(jq -r '.sends[-1].success // "N/A"' "$SENT_LOG_FILE" 2>/dev/null || echo "N/A")
    fi

    cat << EOF

Analytics Transmission Status
────────────────────────────────
Consent given: $consent_status
Network transmission: $transmission_status
Endpoint: $endpoint_status

Last send attempt: $last_send
Last send success: $last_success

Commands:
  Enable network:  Set enableNetworkTransmission in preferences
  Local export:    /ork:feedback export

EOF
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f is_transmission_enabled
export -f enable_transmission
export -f disable_transmission
export -f send_analytics_report
export -f show_transmission_status