#!/bin/bash
# Realtime Sync Hook - Graph-First Priority-based immediate memory persistence
# Triggers on PostToolUse for Bash, Write, and Skill completions
#
# Purpose: Sync critical decisions immediately to knowledge graph
#
# Graph-First Architecture (v2.1):
# - IMMEDIATE syncs target knowledge graph (mcp__memory__*) - always works
# - mem0 cloud sync only if API key present AND critical priority
#
# Priority Classification:
# - IMMEDIATE: "decided", "chose", "architecture", "security", "blocked", "breaking"
# - BATCHED: "pattern", "convention", "preference"
# - SESSION_END: Everything else (handled by existing Stop hooks)
#
# Version: 2.1.0 - CC 2.1.9/2.1.11 compliant, Graph-First Architecture
# CC 2.1.9: Uses systemMessage for actionable sync recommendations
# CC 2.1.11: Session ID guaranteed available (direct substitution)
#
# Part of Memory Fabric v2.1 - Graph-First Architecture

set -euo pipefail

# Read stdin BEFORE sourcing libraries
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common library
source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || {
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

# Source mem0 library (optional - graceful degradation)
MEM0_LIB="$SCRIPT_DIR/../_lib/mem0.sh"
HAS_MEM0_LIB=false
if [[ -f "$MEM0_LIB" ]]; then
    source "$MEM0_LIB" 2>/dev/null && HAS_MEM0_LIB=true
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${HOOK_LOG_DIR}/realtime-sync.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Pending sync queue file (per-session)
# CC 2.1.11: CLAUDE_SESSION_ID guaranteed available (with fallback for edge cases)
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
PENDING_SYNC_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/.mem0-pending-sync-${SESSION_ID}.json"

# Memory Fabric Agent path
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(dirname "${BASH_SOURCE[0]}")")")}"
MEMORY_AGENT="${PLUGIN_ROOT}/bin/memory-fabric-agent.py"

# Priority keywords
IMMEDIATE_KEYWORDS="decided|chose|architecture|security|blocked|breaking|critical|must|cannot|deprecated|removed|migration"
BATCHED_KEYWORDS="pattern|convention|preference|style|format|naming"

# Minimum content length to consider
MIN_CONTENT_LENGTH=30

# Context pressure thresholds (CC 2.1.6)
CONTEXT_EMERGENCY_THRESHOLD=85
CONTEXT_CRITICAL_THRESHOLD=90

# Agent SDK is available when memory agent exists and python3 is present
# anthropic package is a required dependency (installed via pip install 'skillforge[memory]')
HAS_AGENT_SDK=false
if [[ -f "$MEMORY_AGENT" ]] && command -v python3 &>/dev/null; then
    HAS_AGENT_SDK=true
fi

# -----------------------------------------------------------------------------
# Context Pressure Detection (CC 2.1.6)
# -----------------------------------------------------------------------------

# Get current context usage percentage
get_context_pressure() {
    # CC 2.1.6: context_window.used_percentage available in status line
    # This is a placeholder - actual implementation depends on how CC exposes this
    local pressure="${CLAUDE_CONTEXT_USED_PERCENTAGE:-0}"

    # If not set, estimate from token counts if available
    if [[ "$pressure" == "0" && -n "${CLAUDE_CONTEXT_TOKENS_USED:-}" && -n "${CLAUDE_CONTEXT_MAX_TOKENS:-}" ]]; then
        if [[ "${CLAUDE_CONTEXT_MAX_TOKENS}" -gt 0 ]]; then
            pressure=$(( (CLAUDE_CONTEXT_TOKENS_USED * 100) / CLAUDE_CONTEXT_MAX_TOKENS ))
        fi
    fi

    echo "$pressure"
}

# Check if emergency sync is needed due to context pressure
is_emergency_sync_needed() {
    local pressure
    pressure=$(get_context_pressure)
    [[ "$pressure" -ge "$CONTEXT_EMERGENCY_THRESHOLD" ]]
}

# Check if critical sync needed (flush everything)
is_critical_sync_needed() {
    local pressure
    pressure=$(get_context_pressure)
    [[ "$pressure" -ge "$CONTEXT_CRITICAL_THRESHOLD" ]]
}

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------

log_sync() {
    local msg="$1"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [realtime-sync] $msg" >> "$LOG_FILE" 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Priority Classification
# -----------------------------------------------------------------------------

classify_priority() {
    local content="$1"
    local content_lower
    content_lower=$(echo "$content" | tr '[:upper:]' '[:lower:]')

    # Check for IMMEDIATE priority keywords
    if echo "$content_lower" | grep -qE "$IMMEDIATE_KEYWORDS" 2>/dev/null; then
        echo "IMMEDIATE"
        return
    fi

    # Check for BATCHED priority keywords
    if echo "$content_lower" | grep -qE "$BATCHED_KEYWORDS" 2>/dev/null; then
        echo "BATCHED"
        return
    fi

    # Default: let session end hooks handle it
    echo "SESSION_END"
}

# Extract the decision/insight from content
extract_decision() {
    local content="$1"

    # Try to extract a meaningful decision statement
    # Look for sentences containing decision indicators
    local decision=""

    # Try multiple extraction patterns
    decision=$(echo "$content" | grep -oiE "[^.]*\b(decided|chose|selected|will use|must|cannot|blocked|breaking)[^.]*\." 2>/dev/null | head -1)

    if [[ -z "$decision" ]]; then
        # Fallback: extract sentences with architecture/security keywords
        decision=$(echo "$content" | grep -oiE "[^.]*\b(architecture|security|migration|deprecated)[^.]*\." 2>/dev/null | head -1)
    fi

    if [[ -z "$decision" ]]; then
        # Final fallback: take first meaningful sentence
        decision=$(echo "$content" | grep -oE "^[^.]{$MIN_CONTENT_LENGTH,200}\." 2>/dev/null | head -1)
    fi

    # Clean up and truncate
    decision=$(echo "$decision" | sed 's/^[[:space:]]*//' | head -c 300)

    echo "$decision"
}

# Detect category from content
detect_category() {
    local content="$1"
    local content_lower
    content_lower=$(echo "$content" | tr '[:upper:]' '[:lower:]')

    if [[ "$content_lower" =~ security|auth|jwt|oauth|cors|xss ]]; then
        echo "security"
    elif [[ "$content_lower" =~ architecture|design|structure|system ]]; then
        echo "architecture"
    elif [[ "$content_lower" =~ database|schema|migration|postgres|sql ]]; then
        echo "database"
    elif [[ "$content_lower" =~ blocked|issue|bug|problem|cannot ]]; then
        echo "blocker"
    elif [[ "$content_lower" =~ breaking|deprecated|removed|migration ]]; then
        echo "breaking-change"
    elif [[ "$content_lower" =~ api|endpoint|route|rest ]]; then
        echo "api"
    elif [[ "$content_lower" =~ decided|chose|selected ]]; then
        echo "decision"
    else
        echo "general"
    fi
}

# -----------------------------------------------------------------------------
# Pending Sync Queue Management
# -----------------------------------------------------------------------------

init_pending_queue() {
    if [[ ! -f "$PENDING_SYNC_FILE" ]]; then
        mkdir -p "$(dirname "$PENDING_SYNC_FILE")" 2>/dev/null || true
        echo '{"pending": [], "created_at": "'"$(date -Iseconds)"'"}' > "$PENDING_SYNC_FILE" 2>/dev/null || true
    fi
}

add_to_pending_queue() {
    local content="$1"
    local category="$2"

    init_pending_queue

    local timestamp
    timestamp=$(date -Iseconds)

    # Add to pending queue
    if [[ -f "$PENDING_SYNC_FILE" ]]; then
        jq --arg content "$content" \
           --arg category "$category" \
           --arg timestamp "$timestamp" \
           '.pending += [{"content": $content, "category": $category, "queued_at": $timestamp}]' \
           "$PENDING_SYNC_FILE" > "${PENDING_SYNC_FILE}.tmp" 2>/dev/null && \
        mv "${PENDING_SYNC_FILE}.tmp" "$PENDING_SYNC_FILE" 2>/dev/null || true
    fi

    log_sync "Added to pending queue: category=$category, length=${#content}"
}

get_pending_count() {
    if [[ -f "$PENDING_SYNC_FILE" ]]; then
        jq '.pending | length' "$PENDING_SYNC_FILE" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# -----------------------------------------------------------------------------
# Main Processing
# -----------------------------------------------------------------------------

TOOL_NAME=$(get_tool_name)

# Self-guard: Only process relevant tools
case "$TOOL_NAME" in
    Bash|Write|Edit|Skill|Task)
        # Process these tools
        ;;
    *)
        # Skip other tools silently
        output_silent_success
        exit 0
        ;;
esac

# Get tool output/result
TOOL_OUTPUT=""
case "$TOOL_NAME" in
    Bash)
        TOOL_OUTPUT=$(get_field '.tool_output // .output // ""')
        # Also check the command itself for decisions
        COMMAND=$(get_field '.tool_input.command // ""')
        if [[ -n "$COMMAND" ]]; then
            TOOL_OUTPUT="${COMMAND}\n${TOOL_OUTPUT}"
        fi
        ;;
    Write|Edit)
        # For writes, check the content being written
        TOOL_OUTPUT=$(get_field '.tool_input.new_string // .tool_input.content // ""')
        FILE_PATH=$(get_field '.tool_input.file_path // ""')
        if [[ -n "$FILE_PATH" ]]; then
            TOOL_OUTPUT="Writing to ${FILE_PATH}: ${TOOL_OUTPUT}"
        fi
        ;;
    Skill)
        TOOL_OUTPUT=$(get_field '.tool_result // .output // ""')
        ;;
    Task)
        TOOL_OUTPUT=$(get_field '.tool_result // .output // ""')
        ;;
esac

# Skip if output is too short
if [[ -z "$TOOL_OUTPUT" || ${#TOOL_OUTPUT} -lt $MIN_CONTENT_LENGTH ]]; then
    output_silent_success
    exit 0
fi

# Classify priority
PRIORITY=$(classify_priority "$TOOL_OUTPUT")
log_sync "Tool: $TOOL_NAME, Priority: $PRIORITY, Content length: ${#TOOL_OUTPUT}"

# -----------------------------------------------------------------------------
# Context Pressure Override (CC 2.1.6)
# When context is critical, upgrade BATCHED to IMMEDIATE to preserve before compaction
# -----------------------------------------------------------------------------

CONTEXT_PRESSURE=$(get_context_pressure)
EMERGENCY_TRIGGERED=false

if [[ "$PRIORITY" == "BATCHED" ]] && is_emergency_sync_needed; then
    PRIORITY="IMMEDIATE"
    EMERGENCY_TRIGGERED=true
    log_sync "EMERGENCY: Context at ${CONTEXT_PRESSURE}%, upgrading BATCHED to IMMEDIATE"
fi

# If critical (>90%), flush pending queue immediately
if is_critical_sync_needed; then
    PENDING_COUNT=$(get_pending_count)
    if [[ "$PENDING_COUNT" -gt 0 ]]; then
        log_sync "CRITICAL: Context at ${CONTEXT_PRESSURE}%, flushing $PENDING_COUNT pending items"
        # Generate urgent flush message - Graph-First
        MSG=$(cat <<EOF
[CRITICAL SYNC] Context at ${CONTEXT_PRESSURE}% - compaction imminent!

${PENDING_COUNT} items in pending queue need immediate sync to knowledge graph.
Pending sync file: ${PENDING_SYNC_FILE}

Execute mcp__memory__create_entities for each item in the pending file NOW
to preserve session context in the knowledge graph before compaction.
EOF
)
        jq -n --arg msg "$MSG" '{continue:true,systemMessage:$msg}'
        exit 0
    fi
fi

case "$PRIORITY" in
    IMMEDIATE)
        # Extract the critical decision
        DECISION=$(extract_decision "$TOOL_OUTPUT")

        if [[ -z "$DECISION" || ${#DECISION} -lt 20 ]]; then
            log_sync "Could not extract meaningful decision"
            output_silent_success
            exit 0
        fi

        CATEGORY=$(detect_category "$DECISION")

        # Get project-scoped user_id if mem0.sh is available
        USER_ID="default-user"
        SCOPE="decisions"
        if [[ "$HAS_MEM0_LIB" == "true" ]] && type mem0_user_id &>/dev/null; then
            USER_ID=$(mem0_user_id "$SCOPE")
        fi

        log_sync "IMMEDIATE sync triggered: category=$CATEGORY"

        # Try Agent SDK first for guaranteed execution
        if [[ "$HAS_AGENT_SDK" == "true" ]]; then
            log_sync "Using Memory Fabric Agent for guaranteed sync"

            PROJECT_ID=$(mem0_get_project_id 2>/dev/null || basename "${CLAUDE_PROJECT_DIR:-.}")

            # Execute via Agent SDK - returns tool_calls for Claude to execute
            AGENT_RESULT=$(python3 "$MEMORY_AGENT" write \
                "$DECISION" \
                "$PROJECT_ID" \
                --category "$CATEGORY" \
                --outcome "neutral" 2>/dev/null)

            if [[ $? -eq 0 ]] && echo "$AGENT_RESULT" | jq -e '.tool_calls' &>/dev/null; then
                # Agent returned tool calls - instruct Claude to execute them
                TOOL_CALLS=$(echo "$AGENT_RESULT" | jq -c '.tool_calls')
                log_sync "Agent SDK ready: $(echo "$TOOL_CALLS" | jq 'length') tool calls"

                MSG=$(cat <<EOF
[IMMEDIATE SYNC via Agent SDK] Critical decision ready for storage.

Execute these MCP tool calls NOW:
${TOOL_CALLS}

Decision: "${DECISION:0:150}..."
Category: ${CATEGORY}
EOF
)
                jq -n --arg msg "$MSG" '{continue:true,systemMessage:$msg}'
                exit 0
            else
                log_sync "Agent SDK failed, falling back to suggestion"
            fi
        fi

        # Fallback: Build suggestion message - Graph-First Architecture
        MSG=$(cat <<EOF
[IMMEDIATE SYNC] Critical decision detected - store in knowledge graph now.

Category: ${CATEGORY}
Decision: "${DECISION:0:200}"

Store in knowledge graph with mcp__memory__create_entities:
\`\`\`json
{
  "entities": [{
    "name": "${CATEGORY}-decision",
    "entityType": "Decision",
    "observations": ["${DECISION:0:300}"]
  }]
}
\`\`\`

This decision is critical and should be synced immediately for:
- Session continuity if interrupted
- Cross-agent knowledge sharing
- Future reference in similar contexts
EOF
)

        jq -n --arg msg "$MSG" '{continue:true,systemMessage:$msg}'
        exit 0
        ;;

    BATCHED)
        # Add to pending queue for later sync
        DECISION=$(extract_decision "$TOOL_OUTPUT")

        if [[ -n "$DECISION" && ${#DECISION} -ge 20 ]]; then
            CATEGORY=$(detect_category "$DECISION")
            add_to_pending_queue "$DECISION" "$CATEGORY"

            PENDING_COUNT=$(get_pending_count)

            # Only notify if queue is getting large (5+ items)
            if [[ "$PENDING_COUNT" -ge 5 ]]; then
                log_sync "BATCHED queue has $PENDING_COUNT items"

                MSG=$(cat <<EOF
[BATCHED SYNC] ${PENDING_COUNT} patterns/conventions queued for graph sync.

Latest: "${DECISION:0:100}..." (${CATEGORY})

These will be synced to knowledge graph at session end, or trigger batch sync now with mcp__memory__create_entities for each item in:
${PENDING_SYNC_FILE}
EOF
)
                jq -n --arg msg "$MSG" '{continue:true,systemMessage:$msg}'
                exit 0
            fi
        fi

        # Silent success for normal batched items
        output_silent_success
        exit 0
        ;;

    SESSION_END)
        # Let existing Stop hooks handle this
        output_silent_success
        exit 0
        ;;
esac

# Default: silent success
output_silent_success
exit 0
