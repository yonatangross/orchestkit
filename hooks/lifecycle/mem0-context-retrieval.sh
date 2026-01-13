#!/bin/bash
# Mem0 Context Retrieval - Loads relevant memories at session start
# Hook: SessionStart
# CC 2.1.6 Compliant - Works across any repository
#
# This hook checks for pending memory sync from previous sessions and
# provides guidance on using Mem0 for context retrieval.
#
# Features:
# - Checks for .mem0-pending-sync.json from previous session
# - Prompts Claude to sync pending memories via mcp__mem0__add_memory
# - Suggests using mcp__mem0__search_memories for context when no pending sync
# - Project-agnostic: uses project-scoped user_ids
# - Graceful if Mem0 MCP is not configured

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for HOOK_INPUT from parent dispatcher (CC 2.1.6 format)
if [[ -n "${HOOK_INPUT:-}" ]]; then
  _HOOK_INPUT="$HOOK_INPUT"
fi
export _HOOK_INPUT

# Source common utilities
source "$SCRIPT_DIR/../_lib/common.sh"

# Source mem0 library for project-scoped user_ids
source "$SCRIPT_DIR/../_lib/mem0.sh"

log_hook "Mem0 context retrieval starting"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Pending sync file location (project root or ~/.claude for global)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PENDING_SYNC_FILE="$PROJECT_DIR/.mem0-pending-sync.json"
PENDING_SYNC_GLOBAL="$HOME/.claude/.mem0-pending-sync.json"

# Processed directory for archived pending syncs
PROCESSED_DIR="$PROJECT_DIR/.claude/logs/mem0-processed"

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

# Check if a file exists and has valid JSON content
has_valid_pending_sync() {
    local file="$1"
    if [[ -f "$file" ]]; then
        if jq -e '.' "$file" >/dev/null 2>&1; then
            # Check if it has meaningful content (not empty or just {})
            local content
            content=$(jq -c '.' "$file" 2>/dev/null)
            if [[ "$content" != "{}" && "$content" != "null" && -n "$content" ]]; then
                return 0
            fi
        fi
    fi
    return 1
}

# Move pending sync to processed directory
archive_pending_sync() {
    local file="$1"
    local timestamp
    timestamp=$(date '+%Y%m%d-%H%M%S')

    mkdir -p "$PROCESSED_DIR" 2>/dev/null || true

    local basename
    basename=$(basename "$file")
    local archive_name="${basename%.json}.processed-${timestamp}.json"

    if mv "$file" "$PROCESSED_DIR/$archive_name" 2>/dev/null; then
        log_hook "Archived pending sync to $PROCESSED_DIR/$archive_name"
        return 0
    else
        log_hook "Warning: Could not archive $file"
        return 1
    fi
}

# Build concise system message for pending sync
build_pending_sync_message() {
    local file="$1"
    local project_id
    project_id=$(mem0_get_project_id)

    # Extract summary from pending sync file
    local memory_count
    memory_count=$(jq -r '.memories | length // 0' "$file" 2>/dev/null || echo "0")
    local scope
    scope=$(jq -r '.scope // "continuity"' "$file" 2>/dev/null || echo "continuity")

    # Build user_id for this project/scope
    local user_id
    user_id=$(mem0_user_id "$scope")

    echo "Pending memory sync detected (${memory_count} items for ${project_id}). Call mcp__mem0__add_memory with user_id='${user_id}' to persist previous session context."
}

# Build tip message for memory search
build_search_tip_message() {
    local project_id
    project_id=$(mem0_get_project_id)
    local user_id_decisions
    user_id_decisions=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")
    local user_id_continuity
    user_id_continuity=$(mem0_user_id "$MEM0_SCOPE_CONTINUITY")

    echo "Use mcp__mem0__search_memories with user_id='${user_id_decisions}' or '${user_id_continuity}' to retrieve relevant context for ${project_id}."
}

# -----------------------------------------------------------------------------
# Main Logic
# -----------------------------------------------------------------------------

# Determine which pending sync file to check (project-local takes priority)
PENDING_FILE=""
if has_valid_pending_sync "$PENDING_SYNC_FILE"; then
    PENDING_FILE="$PENDING_SYNC_FILE"
    log_hook "Found pending sync in project: $PENDING_SYNC_FILE"
elif has_valid_pending_sync "$PENDING_SYNC_GLOBAL"; then
    # Check if global file is for this project
    local_project_id=$(mem0_get_project_id)
    file_project_id=$(jq -r '.project_id // ""' "$PENDING_SYNC_GLOBAL" 2>/dev/null || echo "")

    if [[ "$file_project_id" == "$local_project_id" ]]; then
        PENDING_FILE="$PENDING_SYNC_GLOBAL"
        log_hook "Found pending sync in global location for this project"
    else
        log_hook "Global pending sync exists but for different project: $file_project_id"
    fi
fi

# -----------------------------------------------------------------------------
# Output CC 2.1.6 Compliant JSON
# -----------------------------------------------------------------------------

if [[ -n "$PENDING_FILE" ]]; then
    # Pending sync exists - prompt Claude to sync
    SYSTEM_MSG=$(build_pending_sync_message "$PENDING_FILE")

    # Archive the file after reading (move to .processed)
    archive_pending_sync "$PENDING_FILE"

    log_hook "Outputting pending sync prompt"
    jq -n \
        --arg msg "$SYSTEM_MSG" \
        '{
            continue: true,
            systemMessage: $msg
        }'
else
    # No pending sync - check if Mem0 is available and provide tip
    if is_mem0_available; then
        TIP_MSG=$(build_search_tip_message)
        log_hook "Mem0 available, outputting search tip"
        jq -n \
            --arg msg "$TIP_MSG" \
            '{
                continue: true,
                systemMessage: $msg
            }'
    else
        # Mem0 not configured - silent success
        log_hook "Mem0 not configured, silent success"
        echo '{"continue": true, "suppressOutput": true}'
    fi
fi

exit 0
