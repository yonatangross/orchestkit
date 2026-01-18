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

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTEXT_DIR="$PROJECT_ROOT/context"
LOG_FILE="$PROJECT_ROOT/logs/context-budget.log"

# Ensure log directory exists (moved up before any function uses log)
mkdir -p "$(dirname "$LOG_FILE")"

# Log function (defined early so other functions can use it)
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Configuration
BUDGET_TOTAL=2200          # Total token budget for context layer
COMPRESS_TRIGGER=0.70      # Trigger compression at 70%
COMPRESS_TARGET=0.50       # Target 50% after compression
# CC 2.1.7: MCP deferral configuration
MCP_DEFER_TRIGGER=0.10     # Defer MCP tools when context >10% of effective window
# Assign early to avoid unbound variable with set -u
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
MCP_STATE_FILE="/tmp/claude-mcp-defer-state-${SESSION_ID}.json"

# CC 2.1.7: Get effective context window (actual usable vs static max)
get_effective_context_window() {
    local base_window="${CLAUDE_MAX_CONTEXT:-200000}"
    local overhead_percent=20  # ~20% system overhead (tools, system prompt)
    echo $((base_window * (100 - overhead_percent) / 100))
}

# CC 2.1.7: Check if MCP tools should be deferred
should_defer_mcp() {
    local current_tokens="$1"
    local effective_window
    effective_window=$(get_effective_context_window)

    # Guard against division by zero
    if [[ "$effective_window" -eq 0 ]]; then
        return 0  # Should defer if window is 0
    fi

    # Calculate usage ratio against effective window
    local usage_ratio
    usage_ratio=$(echo "scale=4; $current_tokens / $effective_window" | bc)

    if (( $(echo "$usage_ratio > $MCP_DEFER_TRIGGER" | bc -l) )); then
        return 0  # Should defer
    fi
    return 1  # Don't defer
}

# CC 2.1.7: Update MCP deferral state file
update_mcp_defer_state() {
    local should_defer="$1"
    local current_tokens="$2"
    local effective_window
    effective_window=$(get_effective_context_window)

    jq -n \
        --argjson defer "$should_defer" \
        --argjson tokens "$current_tokens" \
        --argjson window "$effective_window" \
        --arg ts "$(date -Iseconds)" \
        '{
            mcp_deferred: $defer,
            context_tokens: $tokens,
            effective_window: $window,
            updated_at: $ts,
            reason: (if $defer then "context > 10% threshold" else "context within limits" end)
        }' > "$MCP_STATE_FILE"

    log "MCP defer state updated: defer=$should_defer, tokens=$current_tokens, window=$effective_window"
}

# Token estimation (rough: ~4 chars per token)
estimate_tokens() {
    local file="$1"
    if [ -f "$file" ]; then
        local chars
        chars=$(wc -c < "$file" | tr -d ' ')
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
            local tokens
            tokens=$(estimate_tokens "$file")
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

    local count
    count=$(jq -r '.decisions | length // 0' "$decisions_file" 2>/dev/null)
    # Ensure count is a valid integer
    if ! [[ "$count" =~ ^[0-9]+$ ]]; then
        count=0
    fi

    if [[ "$count" -gt 10 ]]; then
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
    local current_tokens
    current_tokens=$(calculate_usage)

    # Guard against division by zero
    local usage_ratio
    if [[ "$BUDGET_TOTAL" -eq 0 ]]; then
        usage_ratio="1"
    else
        usage_ratio=$(echo "scale=2; $current_tokens / $BUDGET_TOTAL" | bc)
    fi

    local usage_percent
    usage_percent=$(echo "scale=0; $usage_ratio * 100" | bc)

    log "Context usage: $current_tokens / $BUDGET_TOTAL tokens ($usage_percent%)"

    # CC 2.1.7: Check and update MCP deferral state
    if should_defer_mcp "$current_tokens"; then
        update_mcp_defer_state "true" "$current_tokens"
    else
        update_mcp_defer_state "false" "$current_tokens"
    fi

    # Check if compression needed
    if (( $(echo "$usage_ratio > $COMPRESS_TRIGGER" | bc -l) )); then
        log "WARNING: Context usage ($usage_percent%) exceeds threshold ($(echo "$COMPRESS_TRIGGER * 100" | bc)%)"
        log "Triggering compression..."

        # Compress session state
        compress_session

        # Archive old decisions
        archive_old_decisions

        # Recalculate
        local new_tokens
        new_tokens=$(calculate_usage)

        local new_ratio
        if [[ "$BUDGET_TOTAL" -eq 0 ]]; then
            new_ratio="1"
        else
            new_ratio=$(echo "scale=2; $new_tokens / $BUDGET_TOTAL" | bc)
        fi

        local new_percent
        new_percent=$(echo "scale=0; $new_ratio * 100" | bc)

        log "After compression: $new_tokens / $BUDGET_TOTAL tokens ($new_percent%)"

        if (( $(echo "$new_ratio > $COMPRESS_TARGET" | bc -l) )); then
            log "WARNING: Still above target. Manual review recommended."
        else
            log "Compression successful. Target achieved."
        fi
    else
        log "Context usage within budget. No compression needed."
    fi

    # CC 2.1.7: Output valid JSON for silent success
    # (no user-visible output needed for routine monitoring)
}

# Execute
monitor_budget

# CC 2.1.7: Output valid JSON (must be last output before exit)
echo '{"continue": true, "suppressOutput": true}'
