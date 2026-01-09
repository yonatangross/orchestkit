#!/bin/bash
# Context Compressor - Session End Hook
# Compresses and archives context at end of session
#
# Actions:
# 1. Archive current session state
# 2. Compress decisions older than 30 days
# 3. Update knowledge index timestamps
# 4. Clean up temporary files
#
# Version: 2.0.0
# Part of Context Engineering 2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTEXT_DIR="$PROJECT_ROOT/context"
LOG_FILE="$PROJECT_ROOT/logs/context-compressor.log"

# Configuration
DECISION_ARCHIVE_DAYS=30
MAX_ACTIVE_DECISIONS=10
MAX_SESSION_HISTORY=7

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Archive current session
archive_session() {
    local session_file="$CONTEXT_DIR/session/state.json"

    if [ ! -f "$session_file" ]; then
        log "No session state to archive"
        return
    fi

    local session_id=$(jq -r '.session_id // "unknown"' "$session_file")
    local archive_dir="$CONTEXT_DIR/archive/sessions"
    mkdir -p "$archive_dir"

    # Add end timestamp and archive
    local archive_file="$archive_dir/${session_id}.json"
    jq '. + {
        ended: (now | todate),
        archived: true
    }' "$session_file" > "$archive_file"

    log "Archived session to $archive_file"

    # Reset session state for next session
    cat > "$session_file" << 'EOF'
{
  "$schema": "context://session/v1",
  "_meta": {
    "position": "END",
    "token_budget": 500,
    "auto_load": "always",
    "compress_trigger": 0.70,
    "compress_target": 0.50,
    "preserve_fields": ["current_task", "next_steps", "blockers"]
  },
  "session_id": null,
  "started": null,
  "current_task": null,
  "files_touched": [],
  "decisions_this_session": [],
  "blockers": [],
  "next_steps": [],
  "scratchpad": {"notes": []}
}
EOF

    log "Reset session state for next session"
}

# Compress old decisions
compress_old_decisions() {
    local decisions_file="$CONTEXT_DIR/knowledge/decisions/active.json"

    if [ ! -f "$decisions_file" ]; then
        return
    fi

    local count=$(jq '.decisions | length' "$decisions_file")
    log "Processing $count active decisions..."

    if [ "$count" -gt "$MAX_ACTIVE_DECISIONS" ]; then
        local archive_dir="$CONTEXT_DIR/archive/decisions"
        mkdir -p "$archive_dir"

        # Archive older decisions
        local archive_file="$archive_dir/$(date +%Y-%m).json"

        # If archive exists, merge; otherwise create
        if [ -f "$archive_file" ]; then
            local existing=$(cat "$archive_file")
            jq --argjson existing "$existing" \
                '.decisions[:-'"$MAX_ACTIVE_DECISIONS"'] + $existing' \
                "$decisions_file" > "$archive_file.tmp" && mv "$archive_file.tmp" "$archive_file"
        else
            jq '.decisions[:-'"$MAX_ACTIVE_DECISIONS"']' "$decisions_file" > "$archive_file"
        fi

        # Keep only recent decisions
        jq '.decisions = .decisions[-'"$MAX_ACTIVE_DECISIONS"':]' "$decisions_file" \
            > "$decisions_file.tmp" && mv "$decisions_file.tmp" "$decisions_file"

        log "Archived $((count - MAX_ACTIVE_DECISIONS)) old decisions"
    fi
}

# Clean up old session archives
cleanup_old_archives() {
    local archive_dir="$CONTEXT_DIR/archive/sessions"

    if [ ! -d "$archive_dir" ]; then
        return
    fi

    # Count session archives
    local count=$(find "$archive_dir" -name "*.json" -type f | wc -l | tr -d ' ')

    if [ "$count" -gt "$MAX_SESSION_HISTORY" ]; then
        log "Cleaning up old session archives (keeping $MAX_SESSION_HISTORY)..."

        # Remove oldest archives
        find "$archive_dir" -name "*.json" -type f -printf '%T@ %p\n' \
            | sort -n \
            | head -n "$((count - MAX_SESSION_HISTORY))" \
            | cut -d' ' -f2- \
            | xargs rm -f

        log "Removed $((count - MAX_SESSION_HISTORY)) old session archives"
    fi
}

# Update knowledge index timestamps
update_index() {
    local index_file="$CONTEXT_DIR/knowledge/index.json"

    if [ ! -f "$index_file" ]; then
        return
    fi

    # Update entry counts and timestamps
    local decisions_count=0
    local patterns_count=0
    local blockers_count=0

    if [ -f "$CONTEXT_DIR/knowledge/decisions/active.json" ]; then
        decisions_count=$(jq '.decisions | length' "$CONTEXT_DIR/knowledge/decisions/active.json")
    fi

    if [ -f "$CONTEXT_DIR/knowledge/patterns/established.json" ]; then
        patterns_count=$(jq '[.patterns | to_entries[] | .value | length] | add' "$CONTEXT_DIR/knowledge/patterns/established.json")
    fi

    if [ -f "$CONTEXT_DIR/knowledge/blockers/current.json" ]; then
        blockers_count=$(jq '.blockers | length' "$CONTEXT_DIR/knowledge/blockers/current.json")
    fi

    jq --arg date "$(date +%Y-%m-%d)" \
       --argjson dc "$decisions_count" \
       --argjson pc "$patterns_count" \
       --argjson bc "$blockers_count" \
       '.available_knowledge.decisions.last_updated = $date |
        .available_knowledge.decisions.entry_count = $dc |
        .available_knowledge.patterns.entry_count = $pc |
        .available_knowledge.blockers.entry_count = $bc |
        .available_knowledge.blockers.last_updated = $date' \
       "$index_file" > "$index_file.tmp" && mv "$index_file.tmp" "$index_file"

    log "Updated knowledge index"
}

# Main compression function
compress_context() {
    log "Starting end-of-session compression..."

    # Archive current session
    archive_session

    # Compress old decisions
    compress_old_decisions

    # Clean up old archives
    cleanup_old_archives

    # Update knowledge index
    update_index

    log "End-of-session compression complete"

    # Output status
    echo '{"status": "compressed", "timestamp": "'$(date -Iseconds)'"}'
}

# Execute
# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
compress_context
