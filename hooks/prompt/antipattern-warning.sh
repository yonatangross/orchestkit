#!/usr/bin/env bash
# antipattern-warning.sh - Check for known anti-patterns in prompts
# Part of SkillForge Plugin - Best Practice Library (#49)
#
# This hook analyzes user prompts for patterns that match known anti-patterns
# and injects a warning into the conversation if a match is found.
#
# CC 2.1.7 Compliant: Uses suppressOutput for silent success

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$SCRIPT_DIR")")}"

# Source libraries
if [[ -f "${PLUGIN_ROOT}/hooks/_lib/mem0.sh" ]]; then
    source "${PLUGIN_ROOT}/hooks/_lib/mem0.sh"
else
    # Silent exit if mem0 library not available
    echo '{"continue": true, "suppressOutput": true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Keywords that might indicate implementing a pattern
IMPLEMENTATION_KEYWORDS=(
    "implement"
    "add"
    "create"
    "build"
    "set up"
    "configure"
    "use"
)

# -----------------------------------------------------------------------------
# Main Logic
# -----------------------------------------------------------------------------

main() {
    # Get the prompt from stdin (hook input)
    local prompt=""
    if [[ -t 0 ]]; then
        # No stdin, check for argument
        prompt="${1:-}"
    else
        prompt=$(cat)
    fi

    # If no prompt, continue silently
    if [[ -z "$prompt" ]]; then
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Check if prompt contains implementation keywords
    local prompt_lower
    prompt_lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')
    local is_implementation=false

    for keyword in "${IMPLEMENTATION_KEYWORDS[@]}"; do
        if [[ "$prompt_lower" == *"$keyword"* ]]; then
            is_implementation=true
            break
        fi
    done

    if [[ "$is_implementation" != "true" ]]; then
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Detect category from prompt
    local category
    category=$(detect_best_practice_category "$prompt")

    # Build the query for anti-patterns
    local search_query
    search_query=$(check_for_antipattern_query "$prompt")

    # Silent operation - Claude already has access to mem0 tools
    # Log the suggestion instead of showing to user
    log_hook "Antipattern check suggested for category: $category"
    echo '{"continue": true, "suppressOutput": true}'
}

main "$@"