#!/bin/bash
# Mem0 Context Retrieval - Auto-loads unified memories at session start
# Hook: SessionStart
# CC 2.1.7 Compliant - Works across any repository
# CC 2.1.9 Compatible - Uses additionalContext for context injection
#
# This hook checks for pending memory sync and triggers unified memory loading
# via Memory Fabric (mem0 semantic + knowledge graph).
#
# Version: 2.0.0 - Memory Fabric integration with unified search
# Part of Mem0 Pro Integration - Phase 5
#
# Features:
# - Checks for .mem0-pending-sync.json from previous session
# - Triggers /recall skill for unified memory loading (Memory Fabric)
# - Provides MCP tool hints for manual memory retrieval
# - Checks for memory-fabric skill availability
# - Time-filtered search for recent sessions (last 7 days by default)
# - Blocker detection and pending work search
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

# Check if memory-fabric skill exists
has_memory_fabric_skill() {
    local plugin_root="${CLAUDE_PLUGIN_ROOT:-$SCRIPT_DIR/../..}"
    [[ -f "$plugin_root/skills/memory-fabric/SKILL.md" ]]
}

# Build concise system message for pending sync (v2.0.0 - Memory Fabric integration)
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

    # Check for any blockers or pending work in the sync file
    local has_blockers
    has_blockers=$(jq -r '.memories[]? | select(.metadata.has_blockers == true) | .text' "$file" 2>/dev/null | head -1 || echo "")
    local has_next_steps
    has_next_steps=$(jq -r '.memories[]? | select(.metadata.has_next_steps == true) | .text' "$file" 2>/dev/null | head -1 || echo "")

    # Build context message with Memory Fabric integration
    local msg
    msg="[Memory Fabric] Pending session sync detected (${memory_count} items for ${project_id}).

"

    if [[ -n "$has_blockers" ]]; then
        msg="${msg}⚠️ Previous session had UNRESOLVED BLOCKERS - prioritize loading this context.
"
    fi
    if [[ -n "$has_next_steps" ]]; then
        msg="${msg}📋 Previous session had PENDING NEXT STEPS to continue.
"
    fi

    # Add action instructions
    msg="${msg}
Actions to take:
1. Sync pending memories: mcp__mem0__add_memory with user_id='${user_id}'
2. Load session context: Execute /recall to search unified memories

Quick load commands:
• mcp__mem0__search_memories({query: 'session blockers next steps', filters: {AND: [{user_id: '${user_id}'}]}, limit: 5})
• mcp__memory__search_nodes({query: 'recent decisions'})"

    echo "$msg"
}

# Build tip message for memory search (v2.0.0 - Memory Fabric unified search)
build_search_tip_message() {
    local project_id
    project_id=$(mem0_get_project_id)
    local user_id_decisions
    user_id_decisions=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")
    local user_id_continuity
    user_id_continuity=$(mem0_user_id "$MEM0_SCOPE_CONTINUITY")

    local msg
    msg="[Memory Fabric] Auto-loading session context for ${project_id}...

"

    # Check if memory-fabric skill is available for unified search recommendation
    if has_memory_fabric_skill; then
        msg="${msg}Unified Memory Search Available (mem0 + knowledge graph):
Execute /recall to load unified memories from both sources.

"
    fi

    # Add quick load commands
    msg="${msg}Quick load commands:
• mcp__mem0__search_memories({query: 'recent session', filters: {AND: [{user_id: '${user_id_continuity}'}]}, limit: 5})
• mcp__memory__search_nodes({query: 'recent decisions'})
• mcp__mem0__search_memories({query: 'architecture decisions', filters: {AND: [{user_id: '${user_id_decisions}'}]}, limit: 5})"

    # Add time-filtered search hint if available
    if type build_session_retrieval_hint &>/dev/null; then
        msg="${msg}

Additional context retrieval options:
$(build_session_retrieval_hint 7)"
    fi

    echo "$msg"
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
# Output CC 2.1.9 Compliant JSON with hookSpecificOutput.additionalContext
# Uses additionalContext for context injection per CC 2.1.9 specification
# -----------------------------------------------------------------------------

if [[ -n "$PENDING_FILE" ]]; then
    # Pending sync exists - inject context with Memory Fabric integration
    CTX_MSG=$(build_pending_sync_message "$PENDING_FILE")

    # Archive the file after reading (move to .processed)
    archive_pending_sync "$PENDING_FILE"

    log_hook "Outputting pending sync context with Memory Fabric instructions"
    jq -nc --arg ctx "$CTX_MSG" \
        '{"continue":true,"hookSpecificOutput":{"additionalContext":$ctx}}'
else
    # No pending sync - check if Mem0 is available and provide unified search tip
    if is_mem0_available; then
        TIP_MSG=$(build_search_tip_message)
        log_hook "Mem0 available, outputting Memory Fabric context retrieval hints"
        jq -nc --arg ctx "$TIP_MSG" \
            '{"continue":true,"hookSpecificOutput":{"additionalContext":$ctx}}'
    else
        # Mem0 not configured - graceful degradation, silent success
        log_hook "Mem0 not configured, silent success (graceful degradation)"
        echo '{"continue":true,"suppressOutput":true}'
    fi
fi

exit 0