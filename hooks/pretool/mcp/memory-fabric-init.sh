#!/bin/bash
# Memory Fabric Lazy Initialization Hook
# Triggered once on first memory MCP call (CC 2.1.0 once:true)
#
# Graph-First Architecture (v2.1):
# - Knowledge graph is ALWAYS ready (no configuration needed)
# - Mem0 is optional enhancement (only if MEM0_API_KEY set)
# - No warnings for missing mem0 - it's an enhancement, not a requirement
#
# Purpose: Perform one-time setup when memory is first used, rather than at session start.
# This avoids overhead for sessions that never use memory operations.
#
# Version: 2.1.0 - Graph-First Architecture
# CC 2.1.0: Uses once:true to fire only on first memory MCP call
# CC 2.1.9: Uses additionalContext for initialization message
#
# Part of Memory Fabric v2.1 - Graph-First Architecture

set -euo pipefail

# Read stdin BEFORE sourcing libraries
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common library
source "$SCRIPT_DIR/../../_lib/common.sh" 2>/dev/null || {
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

# Source mem0 library (optional)
MEM0_LIB="$SCRIPT_DIR/../../_lib/mem0.sh"
if [[ -f "$MEM0_LIB" ]]; then
    source "$MEM0_LIB" 2>/dev/null || true
fi

# Source memory-fabric library (optional)
FABRIC_LIB="$SCRIPT_DIR/../../_lib/memory-fabric.sh"
if [[ -f "$FABRIC_LIB" ]]; then
    source "$FABRIC_LIB" 2>/dev/null || true
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${HOOK_LOG_DIR}/memory-fabric-init.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

# State file to track orphaned sessions
ORPHAN_CHECK_FILE="${PROJECT_DIR}/.claude/logs/.memory-fabric-sessions.json"

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------

log_init() {
    local msg="$1"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [memory-fabric-init] $msg" >> "$LOG_FILE" 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Initialization Tasks
# -----------------------------------------------------------------------------

# Check for orphaned sessions that might have pending syncs
check_orphaned_sessions() {
    local orphaned_count=0

    # Look for pending sync files without corresponding active sessions
    if [[ -d "${PROJECT_DIR}/.claude/logs" ]]; then
        while IFS= read -r syncfile; do
            # Extract session ID from filename
            local file_session
            file_session=$(basename "$syncfile" | sed 's/.mem0-pending-sync-//' | sed 's/.json//')

            # If not current session, it might be orphaned
            if [[ "$file_session" != "$SESSION_ID" && "$file_session" != "unknown" ]]; then
                ((orphaned_count++))
                log_init "Found orphaned pending sync: $syncfile"
            fi
        done < <(find "${PROJECT_DIR}/.claude/logs" -name ".mem0-pending-sync-*.json" -type f 2>/dev/null)
    fi

    echo "$orphaned_count"
}

# Initialize memory directories if needed
init_directories() {
    mkdir -p "${PROJECT_DIR}/.claude/logs/mem0-processed" 2>/dev/null || true
    mkdir -p "${PROJECT_DIR}/.claude/context/session" 2>/dev/null || true
}

# Validate MCP connectivity (Graph-First)
validate_mcp_health() {
    local tool_name
    tool_name=$(get_tool_name)

    # Graph-First: graph is always ready, mem0 is optional enhancement
    local graph_ready="true"
    local mem0_ready="false"

    # Check for mem0 API key (optional enhancement)
    if [[ -n "${MEM0_API_KEY:-}" ]]; then
        mem0_ready="true"
    fi

    # Return combined status
    if [[ "$mem0_ready" == "true" ]]; then
        echo "enhanced"  # Both graph and mem0 available
    else
        echo "ready"     # Graph-only mode (default, fully functional)
    fi
}

# Register this session as active
register_session() {
    local now
    now=$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')

    mkdir -p "$(dirname "$ORPHAN_CHECK_FILE")" 2>/dev/null || true

    # Update session registry
    if [[ -f "$ORPHAN_CHECK_FILE" ]]; then
        jq --arg sid "$SESSION_ID" --arg ts "$now" \
            '.sessions[$sid] = {active: true, last_seen: $ts}' \
            "$ORPHAN_CHECK_FILE" > "${ORPHAN_CHECK_FILE}.tmp" 2>/dev/null && \
            mv "${ORPHAN_CHECK_FILE}.tmp" "$ORPHAN_CHECK_FILE" 2>/dev/null || true
    else
        echo "{\"sessions\":{\"$SESSION_ID\":{\"active\":true,\"last_seen\":\"$now\"}}}" > "$ORPHAN_CHECK_FILE" 2>/dev/null || true
    fi
}

# -----------------------------------------------------------------------------
# Main Initialization
# -----------------------------------------------------------------------------

log_init "Memory Fabric lazy initialization triggered"

# Run initialization tasks
init_directories
register_session

# Check for orphaned sessions
ORPHANED=$(check_orphaned_sessions)

# Validate MCP health
HEALTH=$(validate_mcp_health)

# Get project context
PROJECT_ID=""
if type mem0_get_project_id &>/dev/null; then
    PROJECT_ID=$(mem0_get_project_id)
fi

log_init "Initialization complete: project=$PROJECT_ID, health=$HEALTH, orphaned=$ORPHANED"

# Build initialization message (Graph-First - positive messaging)
MSG=""

# Only warn about orphaned sessions (actual issue that needs attention)
if [[ "$ORPHANED" -gt 0 ]]; then
    MSG="[Memory Fabric] Detected $ORPHANED orphaned session(s) with pending syncs.
Consider running maintenance: claude --maintenance

"
fi

# Graph-First: Show positive status, no warnings for missing mem0
if [[ "$HEALTH" == "enhanced" ]]; then
    # Both graph and mem0 available
    log_init "Memory Fabric ready (enhanced mode with mem0)"
elif [[ "$HEALTH" == "ready" ]]; then
    # Graph-only mode - fully functional, no warning needed
    log_init "Memory Fabric ready (graph mode)"
fi

# If there's something to report (only orphaned sessions), output it
if [[ -n "$MSG" ]]; then
    # Use additionalContext (CC 2.1.9) for context injection
    jq -nc --arg ctx "$MSG" \
        '{continue:true,hookSpecificOutput:{additionalContext:$ctx}}'
else
    # Silent success - Memory Fabric ready (no issues to report)
    echo '{"continue":true,"suppressOutput":true}'
fi

exit 0
