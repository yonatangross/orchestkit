#!/bin/bash
# Context Budget Monitor - After Tool Use Hook
# Monitors context usage and triggers compression when threshold exceeded
#
# Triggers compression at 70% budget utilization
# Target after compression: 50%
#
# Version: 2.0.0
# Part of Context Engineering 2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTEXT_DIR="$PROJECT_ROOT/context"
LOG_FILE="$PROJECT_ROOT/logs/context-budget.log"

# Configuration
BUDGET_TOTAL=2200          # Total token budget for context layer
COMPRESS_TRIGGER=0.70      # Trigger compression at 70%
COMPRESS_TARGET=0.50       # Target 50% after compression

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Token estimation (rough: ~4 chars per token)
estimate_tokens() {
    local file=$1
    if [ -f "$file" ]; then
        local chars=$(wc -c < "$file" | tr -d ' ')
        echo $((chars / 4))
    else
        echo 0
    fi
}

# Calculate total loaded context
calculate_usage() {
    local total=0

    # Always loaded files
    for file in "$CONTEXT_DIR/identity.json" \
                "$CONTEXT_DIR/session/state.json" \
                "$CONTEXT_DIR/knowledge/index.json" \
                "$CONTEXT_DIR/knowledge/blockers/current.json"; do
        if [ -f "$file" ]; then
            local tokens=$(estimate_tokens "$file")
            total=$((total + tokens))
        fi
    done

    echo $total
}

# Compress session state
compress_session() {
    local session_file="$CONTEXT_DIR/session/state.json"

    if [ ! -f "$session_file" ]; then
        return
    fi

    log "Compressing session state..."

    # Keep only essential fields, truncate arrays
    jq '{
        session_id: .session_id,
        started: .started,
        current_task: .current_task,
        next_steps: .next_steps[-3:],
        blockers: .blockers,
        _compressed: true,
        _compressed_at: now | todate,
        _original_files_touched: (.files_touched | length),
        _original_decisions: (.decisions_this_session | length)
    }' "$session_file" > "$session_file.tmp" && mv "$session_file.tmp" "$session_file"

    log "Session state compressed"
}

# Archive old decisions
archive_old_decisions() {
    local decisions_file="$CONTEXT_DIR/knowledge/decisions/active.json"

    if [ ! -f "$decisions_file" ]; then
        return
    fi

    local count=$(jq '.decisions | length' "$decisions_file")

    if [ "$count" -gt 10 ]; then
        log "Archiving old decisions (keeping latest 5)..."

        # Create archive directory
        local archive_dir="$CONTEXT_DIR/archive/decisions"
        mkdir -p "$archive_dir"

        # Archive older decisions
        local archive_file="$archive_dir/$(date +%Y-%m).json"
        jq '.decisions[:-5]' "$decisions_file" > "$archive_file"

        # Keep only latest 5
        jq '.decisions = .decisions[-5:]' "$decisions_file" > "$decisions_file.tmp" \
            && mv "$decisions_file.tmp" "$decisions_file"

        log "Archived $((count - 5)) decisions to $archive_file"
    fi
}

# Main monitoring function
monitor_budget() {
    local current_tokens=$(calculate_usage)
    local usage_ratio=$(echo "scale=2; $current_tokens / $BUDGET_TOTAL" | bc)
    local usage_percent=$(echo "scale=0; $usage_ratio * 100" | bc)

    log "Context usage: $current_tokens / $BUDGET_TOTAL tokens ($usage_percent%)"

    # Check if compression needed
    if (( $(echo "$usage_ratio > $COMPRESS_TRIGGER" | bc -l) )); then
        log "WARNING: Context usage ($usage_percent%) exceeds threshold ($(echo "$COMPRESS_TRIGGER * 100" | bc)%)"
        log "Triggering compression..."

        # Compress session state
        compress_session

        # Archive old decisions
        archive_old_decisions

        # Recalculate
        local new_tokens=$(calculate_usage)
        local new_ratio=$(echo "scale=2; $new_tokens / $BUDGET_TOTAL" | bc)
        local new_percent=$(echo "scale=0; $new_ratio * 100" | bc)

        log "After compression: $new_tokens / $BUDGET_TOTAL tokens ($new_percent%)"

        if (( $(echo "$new_ratio > $COMPRESS_TARGET" | bc -l) )); then
            log "WARNING: Still above target. Manual review recommended."
        else
            log "Compression successful. Target achieved."
        fi
    else
        log "Context usage within budget. No compression needed."
    fi

    # Output status with systemMessage for user visibility
    # No output - dispatcher handles all JSON output for posttool hooks
}

# Execute
monitor_budget
