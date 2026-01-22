#!/bin/bash
# Context Compressor - Session End Hook
# CC 2.1.7 Compliant: Outputs proper JSON format
# Compresses and archives context at end of session

set -euo pipefail

# Read stdin for CC 2.1.7 compliance (even if we don't use it)
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
CONTEXT_DIR="$PROJECT_ROOT/context"
LOG_FILE="$PROJECT_ROOT/logs/context-compressor.log"

# Configuration
DECISION_ARCHIVE_DAYS=30
MAX_ACTIVE_DECISIONS=10
MAX_SESSION_HISTORY=7

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# Archive current session
archive_session() {
    local session_file="$CONTEXT_DIR/session/state.json"
    [[ ! -f "$session_file" ]] && { log "No session state to archive"; return; }
    
    local session_id=$(jq -r '.session_id // empty' "$session_file" 2>/dev/null)
    [[ -z "$session_id" || "$session_id" == "null" ]] && session_id="session-$(date +%Y%m%d-%H%M%S)"
    
    local archive_dir="$CONTEXT_DIR/archive/sessions"
    mkdir -p "$archive_dir" 2>/dev/null || true
    
    local archive_file="$archive_dir/${session_id}.json"
    jq '. + {ended: (now | todate), archived: true}' "$session_file" > "$archive_file" 2>/dev/null || true
    log "Archived session to $archive_file"
    
    # Reset session state
    cat > "$session_file" << 'RESET'
{
  "$schema": "context://session/v1",
  "_meta": {"position": "END", "token_budget": 500, "auto_load": "always"},
  "session_id": null, "started": null, "current_task": null,
  "files_touched": [], "decisions_this_session": [],
  "blockers": [], "next_steps": [], "scratchpad": {"notes": []}
}
RESET
    log "Reset session state"
}

# Compress old decisions
compress_old_decisions() {
    local decisions_file="$CONTEXT_DIR/knowledge/decisions/active.json"
    [[ ! -f "$decisions_file" ]] && return
    
    local count=$(jq '.decisions | length' "$decisions_file" 2>/dev/null || echo "0")
    [[ "$count" -le "$MAX_ACTIVE_DECISIONS" ]] && return
    
    local archive_dir="$CONTEXT_DIR/archive/decisions"
    mkdir -p "$archive_dir" 2>/dev/null || true
    
    local archive_file="$archive_dir/$(date +%Y-%m).json"
    jq '.decisions[:-'"$MAX_ACTIVE_DECISIONS"']' "$decisions_file" > "$archive_file" 2>/dev/null || true
    jq '.decisions = .decisions[-'"$MAX_ACTIVE_DECISIONS"':]' "$decisions_file" > "$decisions_file.tmp" 2>/dev/null && \
        mv "$decisions_file.tmp" "$decisions_file" 2>/dev/null || true
    log "Archived $((count - MAX_ACTIVE_DECISIONS)) old decisions"
}

# Main compression function
compress_context() {
    log "Starting end-of-session compression..."
    archive_session
    compress_old_decisions
    log "End-of-session compression complete"
}

# Execute compression (silent, logging to file)
compress_context

# CC 2.1.7 Compliant output
output_silent_success
exit 0
