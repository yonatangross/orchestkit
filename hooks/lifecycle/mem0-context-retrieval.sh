#!/bin/bash
# Memory Context Retrieval - Auto-loads memories at session start (Graph-First Architecture)
# Hook: SessionStart
# CC 2.1.7 Compliant - Works across any repository
# CC 2.1.9 Compatible - Uses additionalContext for context injection
#
# Graph-First Architecture (v2.1):
# - Knowledge graph (mcp__memory__*) is PRIMARY - always available, zero-config
# - Mem0 cloud (mcp__mem0__*) is OPTIONAL enhancement for semantic search
#
# Version: 2.1.0 - Graph-first architecture
# Part of Memory Fabric v2.1
#
# Features:
# - Checks for .mem0-pending-sync.json from previous session
# - Triggers /recall skill for memory loading (graph-first)
# - Provides MCP tool hints for manual memory retrieval
# - Checks for memory-fabric skill availability
# - Time-filtered search for recent sessions (last 7 days by default)
# - Blocker detection and pending work search
# - Project-agnostic: uses project-scoped user_ids
# - ALWAYS works - graph is always available (zero-config)

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
if [[ -t 0 ]]; then
    _HOOK_INPUT=""
else
    _HOOK_INPUT=$(cat 2>/dev/null || true)
fi
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# Build concise system message for pending sync (v2.1.0 - Graph-first architecture)
build_pending_sync_message() {
    local file="$1"
    local project_id
    project_id=$(mem0_get_project_id)

    # Extract summary from pending sync file
    local memory_count
    memory_count=$(jq -r '.memories | length // 0' "$file" 2>/dev/null || echo "0")
    local scope
    scope=$(jq -r '.scope // "continuity"' "$file" 2>/dev/null || echo "continuity")

    # Build user_id for this project/scope (used if mem0 enhancement available)
    local user_id
    user_id=$(mem0_user_id "$scope")

    # Check for any blockers or pending work in the sync file
    local has_blockers
    has_blockers=$(jq -r '.memories[]? | select(.metadata.has_blockers == true) | .text' "$file" 2>/dev/null | head -1 || echo "")
    local has_next_steps
    has_next_steps=$(jq -r '.memories[]? | select(.metadata.has_next_steps == true) | .text' "$file" 2>/dev/null | head -1 || echo "")

    # Build context message with graph-first architecture
    local msg
    msg="[Memory Fabric v2.1] Pending session sync detected (${memory_count} items for ${project_id}).

"

    if [[ -n "$has_blockers" ]]; then
        msg="${msg}⚠️ Previous session had UNRESOLVED BLOCKERS - prioritize loading this context.
"
    fi
    if [[ -n "$has_next_steps" ]]; then
        msg="${msg}📋 Previous session had PENDING NEXT STEPS to continue.
"
    fi

    # Add action instructions (graph-first)
    msg="${msg}
Actions to take:
1. Load from knowledge graph (PRIMARY): mcp__memory__search_nodes({query: 'recent decisions blockers'})
2. Execute /recall for comprehensive search

Quick load commands (graph-first):
• mcp__memory__search_nodes({query: 'recent decisions'})
• mcp__memory__search_nodes({query: 'blockers pending'})"

    # Add mem0 commands only if available
    if is_mem0_available; then
        local script_path="${CLAUDE_PLUGIN_ROOT:-${SCRIPT_DIR}/../..}/skills/mem0-memory/scripts"
        msg="${msg}
• [mem0 enhancement] mcp__mem0__search_memories({query: 'session blockers', filters: {AND: [{user_id: '${user_id}'}]}, limit: 5, enable_graph: true})
• [graph relationships] bash $script_path/get-related-memories.py --memory-id <memory_id> --depth 2
• [graph traversal] bash $script_path/traverse-graph.py --memory-id <memory_id> --depth 2"
    fi

    echo "$msg"
}

# Build tip message for memory search (v2.1.0 - Graph-first architecture)
build_search_tip_message() {
    local project_id
    project_id=$(mem0_get_project_id)

    local msg
    msg="[Memory Fabric v2.1] Auto-loading session context for ${project_id}...

"

    # Check if memory-fabric skill is available
    if has_memory_fabric_skill; then
        msg="${msg}Graph-First Memory Available:
Execute /recall to load memories from knowledge graph (and mem0 if configured with --mem0 flag).

"
    fi

    # Add quick load commands (graph-first)
    msg="${msg}Quick load commands (graph PRIMARY):
• mcp__memory__search_nodes({query: 'recent decisions'})
• mcp__memory__search_nodes({query: 'patterns architecture'})
• mcp__memory__read_graph() - Load full knowledge graph"

    # Add mem0 commands only if available (optional enhancement)
    if is_mem0_available; then
        local user_id_decisions
        user_id_decisions=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")
        local user_id_continuity
        user_id_continuity=$(mem0_user_id "$MEM0_SCOPE_CONTINUITY")
        
        local script_path="${CLAUDE_PLUGIN_ROOT:-${SCRIPT_DIR}/../..}/skills/mem0-memory/scripts"

        msg="${msg}

Optional mem0 cloud enhancement:
• bash $script_path/search-memories.py --query 'recent session' --user-id '${user_id_continuity}' --limit 5 --enable-graph
• bash $script_path/search-memories.py --query 'architecture decisions' --user-id '${user_id_decisions}' --limit 5 --enable-graph
• [graph relationships] bash $script_path/get-related-memories.py --memory-id <id> --depth 2
• [graph traversal] bash $script_path/traverse-graph.py --memory-id <id> --depth 2 --relation-type 'recommends'"
    fi

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
# Output CC 2.1.7 Compliant JSON for SessionStart
# Note: SessionStart hooks don't support hookSpecificOutput.additionalContext
# Context injection happens via session-context-loader.sh instead
# -----------------------------------------------------------------------------

if [[ -n "$PENDING_FILE" ]]; then
    # Pending sync exists - archive it and log
    log_hook "Found pending sync, archiving for processing"

    # Archive the file after reading (move to .processed)
    archive_pending_sync "$PENDING_FILE"

    log_hook "Pending sync archived - will be processed on next memory operation"
fi

# SessionStart hooks must use simple success output (no hookSpecificOutput.additionalContext)
if is_mem0_available; then
    log_hook "Graph + mem0 available for this session"
else
    log_hook "Graph available (mem0 not configured) for this session"
fi

echo '{"continue":true,"suppressOutput":true}'

exit 0