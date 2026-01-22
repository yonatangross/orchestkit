#!/usr/bin/env bash
# antipattern-warning.sh - Proactive anti-pattern detection and warning injection
# Part of Mem0 Pro Integration - Phase 4
#
# This hook analyzes user prompts for patterns that match known anti-patterns
# and injects a warning via CC 2.1.9 additionalContext if a match is found.
# Enhanced with Mem0 semantic search hints for project/global anti-patterns.
#
# CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext for warnings
# Version: 1.2.0

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
if [[ -t 0 ]]; then
    _HOOK_INPUT=""
else
    _HOOK_INPUT=$(cat 2>/dev/null || true)
fi
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$SCRIPT_DIR")")}"

# Source mem0 library
if [[ -f "${PLUGIN_ROOT}/hooks/_lib/mem0.sh" ]]; then
    source "${PLUGIN_ROOT}/hooks/_lib/mem0.sh"
else
    echo '{"continue": true, "suppressOutput": true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/antipattern-warning.log"
PATTERNS_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/learned-patterns.json"
GLOBAL_PATTERNS="${HOME}/.claude/global-patterns.json"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [antipattern-warning] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# Keywords that indicate implementation intent
IMPLEMENTATION_KEYWORDS=(
    "implement"
    "add"
    "create"
    "build"
    "set up"
    "setup"
    "configure"
    "use"
    "write"
    "make"
    "develop"
)

# Known anti-patterns database (fallback if no mem0)
# Format: pattern|warning (using | as delimiter for bash 3.2 compatibility)
KNOWN_ANTIPATTERNS=(
    "offset pagination|Offset pagination causes performance issues on large tables. Use cursor-based pagination instead."
    "manual jwt validation|Manual JWT validation is error-prone. Use established libraries like python-jose or jsonwebtoken."
    "storing passwords in plaintext|Never store passwords in plaintext. Use bcrypt, argon2, or scrypt."
    "global state|Global mutable state causes testing and concurrency issues. Use dependency injection."
    "synchronous file operations|Synchronous file I/O blocks the event loop. Use async file operations."
    "n+1 query|N+1 queries cause performance problems. Use eager loading or batch queries."
    "polling for real-time|Polling is inefficient for real-time updates. Consider SSE or WebSocket."
)

# -----------------------------------------------------------------------------
# Pattern Matching
# -----------------------------------------------------------------------------

# Check if prompt contains implementation keywords
is_implementation_prompt() {
    local prompt="$1"
    local prompt_lower
    prompt_lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')

    for keyword in "${IMPLEMENTATION_KEYWORDS[@]}"; do
        if [[ "$prompt_lower" == *"$keyword"* ]]; then
            return 0
        fi
    done
    return 1
}

# Search local patterns file for anti-patterns
search_local_antipatterns() {
    local prompt="$1"
    local prompt_lower
    prompt_lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')

    local warnings=()

    # Check known anti-patterns (bash 3.2 compatible)
    for entry in "${KNOWN_ANTIPATTERNS[@]}"; do
        local pattern="${entry%%|*}"
        local warning="${entry#*|}"
        if [[ "$prompt_lower" == *"$pattern"* ]]; then
            warnings+=("$warning")
        fi
    done

    # Check learned patterns file
    if [[ -f "$PATTERNS_FILE" ]]; then
        local failed_patterns
        failed_patterns=$(jq -r '
            .patterns // [] |
            map(select(.outcome == "failed")) |
            .[].text // empty
        ' "$PATTERNS_FILE" 2>/dev/null) || true

        while IFS= read -r pattern; do
            if [[ -n "$pattern" ]]; then
                local pattern_lower
                pattern_lower=$(echo "$pattern" | tr '[:upper:]' '[:lower:]')
                # Check if prompt mentions similar concepts
                local first_word="${pattern_lower%% *}"
                if [[ "$prompt_lower" == *"$first_word"* ]]; then
                    warnings+=("Previously failed: $pattern")
                fi
            fi
        done <<< "$failed_patterns"
    fi

    # Check global patterns
    if [[ -f "$GLOBAL_PATTERNS" ]]; then
        local global_warnings
        global_warnings=$(jq -r '
            .antipatterns // [] |
            .[] |
            "\(.pattern): \(.warning)"
        ' "$GLOBAL_PATTERNS" 2>/dev/null) || true

        while IFS= read -r warning; do
            if [[ -n "$warning" ]]; then
                local pattern="${warning%%:*}"
                local pattern_lower
                pattern_lower=$(echo "$pattern" | tr '[:upper:]' '[:lower:]')
                if [[ "$prompt_lower" == *"$pattern_lower"* ]]; then
                    warnings+=("$warning")
                fi
            fi
        done <<< "$global_warnings"
    fi

    # Return warnings as newline-separated string
    if [[ ${#warnings[@]} -gt 0 ]]; then
        printf '%s\n' "${warnings[@]}"
    fi
}

# Build mem0 search instruction for Claude (enhanced for v1.2.0)
build_mem0_search_hint() {
    local prompt="$1"
    local category
    category=$(detect_best_practice_category "$prompt")

    # Build Mem0 search JSON for anti-patterns
    local antipattern_search
    antipattern_search=$(mem0_search_antipatterns_json "$prompt" "$category" 5)

    # Build Mem0 search JSON for best practices
    local best_practice_search
    best_practice_search=$(mem0_search_best_practices_json "$prompt" "$category" 3)

    # Build global search
    local global_search
    global_search=$(mem0_search_global_by_outcome_json "$prompt" "failed" 3)

    cat << EOF
Before implementing, search Mem0 for relevant patterns (graph memory enabled):

1. Project anti-patterns (category: $category):
   mcp__mem0__search_memories with:
   $antipattern_search

2. Project best practices:
   mcp__mem0__search_memories with:
   $best_practice_search

3. Cross-project failures:
   mcp__mem0__search_memories with:
   $global_search
EOF
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    # Read prompt from stdin
    local prompt=""
    if [[ ! -t 0 ]]; then
        prompt=$(cat)
    fi

    if [[ -z "$prompt" ]]; then
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Only check implementation prompts
    if ! is_implementation_prompt "$prompt"; then
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    log "Checking prompt for anti-patterns..."

    # Search for matching anti-patterns
    local warnings
    warnings=$(search_local_antipatterns "$prompt")

    # Build Mem0 search hints
    local mem0_search_hints=""
    if is_mem0_available; then
        mem0_search_hints=$(build_mem0_search_hint "$prompt")
    fi

    if [[ -n "$warnings" ]]; then
        log "Found anti-pattern warnings: $warnings"

        # Build warning message with Mem0 search hints
        local warning_message
        if [[ -n "$mem0_search_hints" ]]; then
            warning_message=$(cat << EOF
## Anti-Pattern Warning

The following patterns have previously caused issues:

$(echo "$warnings" | sed 's/^/- /')

Consider alternative approaches before proceeding.

$mem0_search_hints
EOF
)
        else
            warning_message=$(cat << EOF
## Anti-Pattern Warning

The following patterns have previously caused issues:

$(echo "$warnings" | sed 's/^/- /')

Consider alternative approaches before proceeding.
EOF
)
        fi

        # Inject warning via additionalContext (CC 2.1.9)
        jq -n \
            --arg warning "$warning_message" \
            '{
                "continue": true,
                "hookSpecificOutput": {
                    "additionalContext": $warning
                }
            }'
    else
        # No local warnings - provide Mem0 search hints for semantic search
        local category
        category=$(detect_best_practice_category "$prompt")

        # Only add hint for significant implementation tasks
        if [[ "$prompt" =~ (implement|build|create|develop) ]]; then
            local hint
            if [[ -n "$mem0_search_hints" ]]; then
                hint="$mem0_search_hints"
            else
                hint="Consider checking mem0 for past patterns related to \"$category\" before implementing."
            fi
            jq -n \
                --arg hint "$hint" \
                '{
                    "continue": true,
                    "hookSpecificOutput": {
                        "additionalContext": $hint
                    }
                }'
        else
            echo '{"continue": true, "suppressOutput": true}'
        fi
    fi
}

main "$@"
