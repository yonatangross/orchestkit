#!/usr/bin/env bash
# memory-lib.sh - Helper functions for mem0 semantic memory integration
# Part of OrchestKit Claude Plugin
#
# NOTE: This extends hooks/_lib/mem0.sh with additional utilities.
# For low-level mem0 operations, use hooks/_lib/mem0.sh directly.

set -euo pipefail

# =============================================================================
# CONSTANTS
# =============================================================================

# Memory categories (extends mem0.sh scopes with more granular types)
readonly MEMORY_CATEGORIES=("decision" "architecture" "pattern" "blocker" "preference" "constraint")

# Default limits
readonly DEFAULT_SEARCH_LIMIT=10
readonly DEFAULT_RECENT_LIMIT=5

# =============================================================================
# USER ID HELPERS (Compatible with hooks/_lib/mem0.sh)
# =============================================================================

# Get the project name from directory (same as mem0_get_project_id)
get_project_name() {
    local project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
    local project_name
    project_name=$(basename "$project_dir")
    # Sanitize: lowercase, replace spaces and special chars with dashes
    project_name=$(echo "$project_name" | \
        tr '[:upper:]' '[:lower:]' | \
        tr ' ' '-' | \
        tr -c '[:alnum:]-' '-' | \
        sed -e 's/^-*//' -e 's/-*$//' -e 's/--*/-/g')
    if [[ -z "$project_name" ]]; then
        project_name="default-project"
    fi
    echo "$project_name"
}

# Generate user_id for project decisions
# Pattern: {project-name}-decisions (compatible with hooks/_lib/mem0.sh)
get_decisions_user_id() {
    local project_name
    project_name=$(get_project_name)
    echo "${project_name}-decisions"
}

# Generate user_id for project continuity
# Pattern: {project-name}-continuity (compatible with hooks/_lib/mem0.sh)
get_continuity_user_id() {
    local project_name
    project_name=$(get_project_name)
    echo "${project_name}-continuity"
}

# Generate agent_id for agent memories
# Pattern: ork:{agent-name}
get_agent_id() {
    local agent_name="$1"
    echo "ork:${agent_name}"
}

# =============================================================================
# CATEGORY DETECTION
# =============================================================================

# Auto-detect memory category from text
detect_category() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    # Architecture patterns
    if echo "$text_lower" | grep -qE "(architecture|design|structure|pattern|approach|system)"; then
        echo "architecture"
        return
    fi

    # Decision patterns
    if echo "$text_lower" | grep -qE "(chose|decided|selected|picked|went with|prefer|instead of)"; then
        echo "decision"
        return
    fi

    # Blocker patterns
    if echo "$text_lower" | grep -qE "(blocked|issue|problem|bug|error|fails|broken|workaround)"; then
        echo "blocker"
        return
    fi

    # Constraint patterns
    if echo "$text_lower" | grep -qE "(must|cannot|required|constraint|limitation|restricted)"; then
        echo "constraint"
        return
    fi

    # Pattern patterns
    if echo "$text_lower" | grep -qE "(pattern|convention|style|format|naming|standard)"; then
        echo "pattern"
        return
    fi

    # Default to decision
    echo "decision"
}

# =============================================================================
# FORMATTING HELPERS
# =============================================================================

# Format timestamp for display
format_timestamp() {
    local timestamp="$1"
    local now
    now=$(date +%s)

    # Try to parse the timestamp
    local ts_epoch
    if [[ "$timestamp" =~ ^[0-9]+$ ]]; then
        ts_epoch="$timestamp"
    else
        ts_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${timestamp%%.*}" +%s 2>/dev/null || echo "$now")
    fi

    local diff=$((now - ts_epoch))

    if [[ $diff -lt 86400 ]]; then
        echo "today"
    elif [[ $diff -lt 172800 ]]; then
        echo "yesterday"
    elif [[ $diff -lt 604800 ]]; then
        echo "$((diff / 86400)) days ago"
    elif [[ $diff -lt 2592000 ]]; then
        echo "$((diff / 604800)) weeks ago"
    else
        echo "$((diff / 2592000)) months ago"
    fi
}

# Format memory for display
format_memory() {
    local text="$1"
    local category="${2:-decision}"
    local timestamp="${3:-}"

    local time_display=""
    if [[ -n "$timestamp" ]]; then
        time_display="[$(format_timestamp "$timestamp")] "
    fi

    echo "${time_display}(${category}) ${text}"
}

# =============================================================================
# VALIDATION
# =============================================================================

# Validate category
validate_category() {
    local category="$1"
    for valid in "${MEMORY_CATEGORIES[@]}"; do
        if [[ "$category" == "$valid" ]]; then
            return 0
        fi
    done
    return 1
}

# Truncate text to max length
truncate_text() {
    local text="$1"
    local max_length="${2:-2000}"

    if [[ ${#text} -gt $max_length ]]; then
        echo "${text:0:$((max_length - 3))}..."
    else
        echo "$text"
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

# Export functions for use in other scripts
export -f get_project_name
export -f get_decisions_user_id
export -f get_continuity_user_id
export -f get_agent_id
export -f detect_category
export -f format_timestamp
export -f format_memory
export -f validate_category
export -f truncate_text