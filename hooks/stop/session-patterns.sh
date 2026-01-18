#!/usr/bin/env bash
# session-patterns.sh - Flush queued patterns to mem0 on session end
# Part of SkillForge Plugin - Cross-Project Patterns (#48) + Best Practices (#49)
#
# This hook processes the patterns queue built during the session and:
# 1. Stores patterns in mem0 for cross-project learning
# 2. Updates local patterns file for fast lookup
# 3. Syncs high-confidence patterns to global storage
#
# CC 2.1.7 Compliant: Uses suppressOutput for silent operation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$SCRIPT_DIR")")}"

# Source libraries
if [[ -f "${PLUGIN_ROOT}/hooks/_lib/mem0.sh" ]]; then
    source "${PLUGIN_ROOT}/hooks/_lib/mem0.sh"
fi

if [[ -f "${PLUGIN_ROOT}/.claude/scripts/pattern-sync.sh" ]]; then
    source "${PLUGIN_ROOT}/.claude/scripts/pattern-sync.sh"
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/session-patterns.log"
PATTERNS_QUEUE="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/patterns-queue.json"
PATTERNS_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/learned-patterns.json"

# Ensure directories exist
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
mkdir -p "$(dirname "$PATTERNS_FILE")" 2>/dev/null || true

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [session-patterns] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Pattern Processing
# -----------------------------------------------------------------------------

# Initialize patterns file if needed
init_patterns_file() {
    if [[ ! -f "$PATTERNS_FILE" ]]; then
        cat > "$PATTERNS_FILE" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "patterns": [],
  "categories": {},
  "stats": {
    "total": 0,
    "successes": 0,
    "failures": 0
  }
}
EOF
    fi
}

# Merge queued patterns into learned patterns file
merge_patterns() {
    if [[ ! -f "$PATTERNS_QUEUE" ]]; then
        log "No patterns queue found"
        return 0
    fi

    local queue_count
    queue_count=$(jq '.patterns | length' "$PATTERNS_QUEUE" 2>/dev/null) || queue_count=0

    if [[ "$queue_count" == "0" ]]; then
        log "Patterns queue is empty"
        return 0
    fi

    log "Processing $queue_count queued patterns..."

    init_patterns_file

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local tmp_file
    tmp_file=$(mktemp)

    # Merge patterns and update stats
    jq -s --arg now "$now" '
        .[0] as $existing |
        .[1] as $queue |
        ($queue.patterns // []) as $new_patterns |

        # Deduplicate by text (keep most recent)
        (($existing.patterns // []) + $new_patterns) |
        group_by(.text) |
        map(sort_by(.timestamp) | last) as $all_patterns |

        # Calculate stats
        ($all_patterns | map(select(.outcome == "success")) | length) as $successes |
        ($all_patterns | map(select(.outcome == "failed")) | length) as $failures |

        # Group by category
        ($all_patterns | group_by(.category) | map({(.[0].category): length}) | add // {}) as $categories |

        $existing |
        .updated = $now |
        .patterns = $all_patterns |
        .categories = $categories |
        .stats.total = ($all_patterns | length) |
        .stats.successes = $successes |
        .stats.failures = $failures
    ' "$PATTERNS_FILE" "$PATTERNS_QUEUE" > "$tmp_file" 2>/dev/null

    if jq empty "$tmp_file" 2>/dev/null; then
        mv "$tmp_file" "$PATTERNS_FILE"
        log "Merged patterns successfully"

        # Clear the queue
        echo '{"patterns": []}' > "$PATTERNS_QUEUE"
    else
        rm -f "$tmp_file"
        log "Error merging patterns"
        return 1
    fi
}

# Generate mem0 storage instructions for Claude
generate_mem0_instructions() {
    if [[ ! -f "$PATTERNS_FILE" ]]; then
        return 0
    fi

    local new_patterns
    new_patterns=$(jq -r '
        .patterns // [] |
        sort_by(.timestamp) |
        reverse |
        .[0:5] |
        .[] |
        "\(.outcome): \(.text) (category: \(.category))"
    ' "$PATTERNS_FILE" 2>/dev/null) || return 0

    if [[ -n "$new_patterns" ]]; then
        log "Recent patterns for mem0 storage:"
        log "$new_patterns"

        # Output instruction for Claude to store in mem0
        cat << EOF

## Session Patterns Summary

The following patterns were observed this session:

$new_patterns

These will be automatically available for cross-project pattern matching.
EOF
    fi
}

# Sync patterns to global storage
sync_to_global() {
    if type push_project_patterns &>/dev/null; then
        log "Syncing patterns to global storage..."
        push_project_patterns >> "$LOG_FILE" 2>&1 || log "Global sync failed"
    else
        log "Global sync not available (pattern-sync.sh not loaded)"
    fi
}

# Extract session summary patterns
extract_session_summary() {
    local session_id="${CLAUDE_SESSION_ID:-unknown}"
    local project_id
    project_id=$(mem0_get_project_id 2>/dev/null) || project_id="unknown"

    # Check if there were any significant activities this session
    local patterns_count
    patterns_count=$(jq '.patterns | length' "$PATTERNS_FILE" 2>/dev/null) || patterns_count=0

    if [[ "$patterns_count" -gt 0 ]]; then
        log "Session $session_id completed with $patterns_count patterns recorded"
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    log "Session ending, processing patterns..."

    # 1. Merge queued patterns into learned patterns file
    merge_patterns

    # 2. Sync to global storage
    sync_to_global

    # 3. Extract session summary
    extract_session_summary

    log "Pattern processing complete"

    # Silent success
    echo '{"continue": true, "suppressOutput": true}'
}

main "$@"
