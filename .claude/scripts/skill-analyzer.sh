#!/bin/bash
set -euo pipefail
# Skill Usage Analyzer
# Analyzes skill usage patterns for context efficiency optimization
#
# Usage:
#   skill-analyzer.sh summary   - Overall usage summary
#   skill-analyzer.sh top       - Most used skills
#   skill-analyzer.sh recent    - Recently used skills
#   skill-analyzer.sh suggest   - Suggest optimizations
#
# Version: 1.0.0
# Part of Auto-Feedback Self-Improvement Loop (#50, #56)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Source feedback lib if available
FEEDBACK_LIB="$SCRIPT_DIR/feedback-lib.sh"
if [[ -f "$FEEDBACK_LIB" ]]; then
    source "$FEEDBACK_LIB"
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

METRICS_FILE="${PROJECT_ROOT}/.claude/feedback/metrics.json"
SKILL_ANALYTICS="${PROJECT_ROOT}/.claude/logs/skill-analytics.jsonl"
SKILL_USAGE_LOG="${PROJECT_ROOT}/.claude/logs/skill-usage.log"

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

# Get skill metrics from feedback system
get_skill_metrics() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo '{}'
        return
    fi
    jq '.skills // {}' "$METRICS_FILE" 2>/dev/null || echo '{}'
}

# Get recent skill invocations
get_recent_skills() {
    local limit="${1:-10}"

    if [[ -f "$SKILL_ANALYTICS" ]]; then
        tail -n "$limit" "$SKILL_ANALYTICS" 2>/dev/null | jq -s '.' || echo '[]'
    elif [[ -f "$SKILL_USAGE_LOG" ]]; then
        tail -n "$limit" "$SKILL_USAGE_LOG" 2>/dev/null || echo ""
    else
        echo '[]'
    fi
}

# Count total skill invocations
count_total_invocations() {
    local total=0

    if [[ -f "$METRICS_FILE" ]]; then
        total=$(jq '[.skills // {} | to_entries[] | .value.uses] | add // 0' "$METRICS_FILE" 2>/dev/null || echo "0")
    fi

    echo "$total"
}

# Get top skills by usage
get_top_skills() {
    local limit="${1:-10}"

    if [[ ! -f "$METRICS_FILE" ]]; then
        echo "No metrics data available."
        return
    fi

    echo "Top $limit Skills by Usage"
    echo "========================="
    echo ""

    jq -r --argjson limit "$limit" '
        .skills // {} |
        to_entries |
        sort_by(-.value.uses) |
        .[:$limit] |
        .[] |
        "\(.value.uses | tostring | ("     " + .)[-5:]) uses | \(.key) | success: \((.value.successes / .value.uses * 100 | floor))% | last: \(.value.lastUsed // "unknown")"
    ' "$METRICS_FILE" 2>/dev/null || echo "No skill data available."
}

# Calculate context efficiency metrics
calc_efficiency() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo "No metrics data for efficiency calculation."
        return
    fi

    local total_uses
    local total_edits
    local avg_edits

    total_uses=$(jq '[.skills // {} | to_entries[] | .value.uses] | add // 0' "$METRICS_FILE" 2>/dev/null || echo "0")
    total_edits=$(jq '[.skills // {} | to_entries[] | .value.totalEdits] | add // 0' "$METRICS_FILE" 2>/dev/null || echo "0")

    if [[ "$total_uses" -gt 0 ]]; then
        # Use awk for cross-platform compatibility (no bc dependency)
        avg_edits=$(awk -v e="$total_edits" -v u="$total_uses" 'BEGIN { printf "%.2f", e / u }')
    else
        avg_edits="N/A"
    fi

    echo "Context Efficiency Metrics"
    echo "=========================="
    echo ""
    echo "Total skill invocations: $total_uses"
    echo "Total file edits: $total_edits"
    echo "Average edits per skill: $avg_edits"
}

# Suggest optimizations based on usage patterns
suggest_optimizations() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo "No data available for optimization suggestions."
        return
    fi

    echo "Optimization Suggestions"
    echo "========================"
    echo ""

    # Find rarely used skills
    local rarely_used
    rarely_used=$(jq -r '
        .skills // {} |
        to_entries |
        map(select(.value.uses < 3)) |
        .[].key
    ' "$METRICS_FILE" 2>/dev/null || echo "")

    if [[ -n "$rarely_used" ]]; then
        echo "Rarely Used Skills (consider loading only when needed):"
        echo "$rarely_used" | while read -r skill; do
            echo "  - $skill"
        done
        echo ""
    fi

    # Find skills with low success rate
    local low_success
    low_success=$(jq -r '
        .skills // {} |
        to_entries |
        map(select(.value.uses >= 3 and (.value.successes / .value.uses) < 0.8)) |
        .[].key
    ' "$METRICS_FILE" 2>/dev/null || echo "")

    if [[ -n "$low_success" ]]; then
        echo "Skills with Low Success Rate (may need improvement):"
        echo "$low_success" | while read -r skill; do
            echo "  - $skill"
        done
        echo ""
    fi

    # Find frequently used skills
    local frequent
    frequent=$(jq -r '
        .skills // {} |
        to_entries |
        sort_by(-.value.uses) |
        .[:5] |
        .[].key
    ' "$METRICS_FILE" 2>/dev/null || echo "")

    if [[ -n "$frequent" ]]; then
        echo "Frequently Used Skills (prioritize for context loading):"
        echo "$frequent" | while read -r skill; do
            echo "  - $skill"
        done
    fi
}

# -----------------------------------------------------------------------------
# Commands
# -----------------------------------------------------------------------------

cmd_summary() {
    echo "Skill Usage Summary"
    echo "==================="
    echo ""

    local total
    total=$(count_total_invocations)
    echo "Total invocations: $total"

    if [[ -f "$METRICS_FILE" ]]; then
        local skill_count
        skill_count=$(jq '.skills // {} | length' "$METRICS_FILE" 2>/dev/null || echo "0")
        echo "Unique skills used: $skill_count"

        local last_updated
        last_updated=$(jq -r '.updated // "unknown"' "$METRICS_FILE" 2>/dev/null || echo "unknown")
        echo "Last updated: $last_updated"
    fi

    echo ""
    echo "Files:"
    echo "  Metrics: $METRICS_FILE"
    echo "  Analytics: $SKILL_ANALYTICS"
    echo "  Usage log: $SKILL_USAGE_LOG"
}

cmd_top() {
    get_top_skills "${1:-10}"
}

cmd_recent() {
    echo "Recent Skill Invocations"
    echo "========================"
    echo ""

    if [[ -f "$SKILL_ANALYTICS" ]]; then
        tail -n "${1:-10}" "$SKILL_ANALYTICS" 2>/dev/null | jq -r '
            "\(.timestamp | .[0:19]) | \(.skill) | \(.args // "no args")"
        ' || echo "No recent data."
    elif [[ -f "$SKILL_USAGE_LOG" ]]; then
        tail -n "${1:-10}" "$SKILL_USAGE_LOG" 2>/dev/null || echo "No recent data."
    else
        echo "No skill usage data found."
    fi
}

cmd_suggest() {
    suggest_optimizations
}

cmd_efficiency() {
    calc_efficiency
}

cmd_help() {
    echo "Skill Usage Analyzer - Analyze skill usage patterns"
    echo ""
    echo "Usage: skill-analyzer.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  summary      Overall usage summary"
    echo "  top [N]      Top N most used skills (default: 10)"
    echo "  recent [N]   Last N skill invocations (default: 10)"
    echo "  efficiency   Context efficiency metrics"
    echo "  suggest      Optimization suggestions"
    echo "  help         Show this help"
    echo ""
    echo "Files:"
    echo "  Metrics: .claude/feedback/metrics.json"
    echo "  Analytics: .claude/logs/skill-analytics.jsonl"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

COMMAND="${1:-help}"
ARG="${2:-}"

case "$COMMAND" in
    summary)
        cmd_summary
        ;;
    top)
        cmd_top "$ARG"
        ;;
    recent)
        cmd_recent "$ARG"
        ;;
    efficiency)
        cmd_efficiency
        ;;
    suggest)
        cmd_suggest
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        echo "Unknown command: $COMMAND"
        echo "Run 'skill-analyzer.sh help' for usage."
        exit 1
        ;;
esac