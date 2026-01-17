#!/bin/bash
# Mem0 Pre-Compaction Sync Hook
# Prompts Claude to save important session context to Mem0 before compaction
# Enhanced with graph memory support, pending pattern sync, and session summaries
#
# Version: 1.3.0 - Session Continuity 2.0 with richer summaries
# Part of Mem0 Pro Integration - Phase 5

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source mem0 library for user_id helpers
source "$SCRIPT_DIR/../_lib/mem0.sh" 2>/dev/null || {
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

DECISION_LOG="$PLUGIN_ROOT/.claude/coordination/decision-log.json"
PATTERNS_LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/agent-patterns.jsonl"
BLOCKERS_LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/blockers.jsonl"
SESSION_STATE="${CLAUDE_PROJECT_DIR:-.}/.claude/context/session/state.json"

# -----------------------------------------------------------------------------
# Count Pending Items (only unsynced decisions, not total)
# -----------------------------------------------------------------------------

DECISION_COUNT=0
PATTERN_COUNT=0
PENDING_PATTERNS=""

SYNC_STATE="$PLUGIN_ROOT/.claude/coordination/.decision-sync-state.json"

# Count PENDING decisions (not total) by comparing against sync state
if [[ -f "$DECISION_LOG" ]]; then
    if [[ -f "$SYNC_STATE" ]]; then
        # Get synced decision IDs (use -c for compact single-line output)
        SYNCED_IDS=$(jq -c '.synced_decisions // []' "$SYNC_STATE" 2>/dev/null || echo '[]')
        # Count decisions NOT in synced list
        DECISION_COUNT=$(jq --argjson synced "$SYNCED_IDS" '
            [.decisions[]? | select(.decision_id as $id | $synced | index($id) | not)] | length
        ' "$DECISION_LOG" 2>/dev/null | tr -d '[:space:]' || echo "0")
    else
        # No sync state = all are pending
        DECISION_COUNT=$(jq '.decisions | length // 0' "$DECISION_LOG" 2>/dev/null | tr -d '[:space:]' || echo "0")
    fi
    # Ensure it's a valid integer
    [[ "$DECISION_COUNT" =~ ^[0-9]+$ ]] || DECISION_COUNT=0
fi

# Count and read pending patterns
# Note: PATTERNS_LOG can be either JSONL (one object per line) or a single JSON object
if [[ -f "$PATTERNS_LOG" ]]; then
    # Try to count pending patterns using jq (handles both formats)
    # For JSONL: count lines with pending_sync:true
    # For single JSON: check if pending_sync is true (returns 1 or 0)
    PATTERN_COUNT=$(jq -s '[.[] | select(.pending_sync == true)] | length' "$PATTERNS_LOG" 2>/dev/null | tr -d '[:space:]' || echo "0")
    # Ensure it's a valid integer
    [[ "$PATTERN_COUNT" =~ ^[0-9]+$ ]] || PATTERN_COUNT=0

    # Read pending patterns (for extracting agent info)
    if [[ $PATTERN_COUNT -gt 0 ]]; then
        # Get agent IDs from pending patterns
        PENDING_PATTERNS=$(jq -s '[.[] | select(.pending_sync == true)]' "$PATTERNS_LOG" 2>/dev/null || echo "[]")
    fi
fi

# -----------------------------------------------------------------------------
# Extract Session State and Blockers (v1.3.0)
# -----------------------------------------------------------------------------

CURRENT_TASK=""
BLOCKERS=""
NEXT_STEPS=""

# Try to extract current task from session state
if [[ -f "$SESSION_STATE" ]]; then
    CURRENT_TASK=$(jq -r '.current_task // .task // ""' "$SESSION_STATE" 2>/dev/null || echo "")
fi

# Try to extract blockers from blockers log
if [[ -f "$BLOCKERS_LOG" ]]; then
    # Get recent blockers (last 5)
    BLOCKERS=$(jq -rs 'map(select(.resolved != true)) | .[-5:] | .[].description // empty' "$BLOCKERS_LOG" 2>/dev/null | tr '\n' '; ' | sed 's/; $//' || echo "")
fi

# Check if any patterns indicate next steps or todos
if [[ -n "$PENDING_PATTERNS" && "$PENDING_PATTERNS" != "[]" ]]; then
    # Extract any patterns that look like next steps
    NEXT_STEPS=$(echo "$PENDING_PATTERNS" | jq -r '.[] | select(.type == "next_step" or .pattern_type == "todo") | .text // .description // empty' 2>/dev/null | head -3 | tr '\n' '; ' | sed 's/; $//' || echo "")
fi

# Build session summary JSON for Claude to save
SESSION_SUMMARY_JSON=""
if [[ -n "$CURRENT_TASK" || "$DECISION_COUNT" -gt 0 || "$PATTERN_COUNT" -gt 0 ]]; then
    SUMMARY_TEXT="${CURRENT_TASK:-Session work}"
    SESSION_STATUS="in_progress"
    if [[ "$DECISION_COUNT" -gt 0 ]]; then
        SUMMARY_TEXT="${SUMMARY_TEXT} (${DECISION_COUNT} decisions made)"
    fi
    if [[ "$PATTERN_COUNT" -gt 0 ]]; then
        SUMMARY_TEXT="${SUMMARY_TEXT} (${PATTERN_COUNT} patterns learned)"
    fi
    SESSION_SUMMARY_JSON=$(build_session_summary_json "$SUMMARY_TEXT" "$SESSION_STATUS" "$BLOCKERS" "$NEXT_STEPS" 2>/dev/null || echo "")
fi

# If nothing to sync, silent exit
if [[ "$DECISION_COUNT" == "0" && "$PATTERN_COUNT" == "0" && -z "$SESSION_SUMMARY_JSON" ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Build User IDs
# -----------------------------------------------------------------------------

PROJECT_ID=$(mem0_get_project_id)
DECISIONS_USER_ID=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")
GLOBAL_USER_ID=$(mem0_global_user_id "best-practices")

# -----------------------------------------------------------------------------
# Build Sync Recommendation
# -----------------------------------------------------------------------------

MSG_PARTS=()

# Add decision sync recommendation
if [[ "$DECISION_COUNT" -gt 0 ]]; then
    MSG_PARTS+=("$DECISION_COUNT decisions to sync")
fi

# Add pattern sync recommendation with details
if [[ "$PATTERN_COUNT" -gt 0 ]]; then
    MSG_PARTS+=("$PATTERN_COUNT agent patterns pending")

    # Extract unique agents from pending patterns (PENDING_PATTERNS is now a JSON array)
    if [[ -n "$PENDING_PATTERNS" && "$PENDING_PATTERNS" != "[]" ]]; then
        UNIQUE_AGENTS=$(echo "$PENDING_PATTERNS" | jq -r '.[] | .agent_id // .agent' 2>/dev/null | sort -u | head -5 | tr '\n' ', ' | sed 's/,$//')
        if [[ -n "$UNIQUE_AGENTS" ]]; then
            MSG_PARTS+=("agents: $UNIQUE_AGENTS")
        fi
    fi
fi

# Build the summary (handle empty array for set -u)
if [[ ${#MSG_PARTS[@]} -gt 0 ]]; then
    SUMMARY=$(IFS='; '; echo "${MSG_PARTS[*]}")
else
    SUMMARY="No pending items"
fi

# Build continuity user ID for session summary
CONTINUITY_USER_ID=$(mem0_user_id "$MEM0_SCOPE_CONTINUITY")

# Build detailed sync message with session summary (v1.3.0)
MSG=$(cat <<EOF
[Session Sync] $SUMMARY

Before session ends, consider saving important context to Mem0 (graph memory enabled by default):

1. Session Summary (for continuity):
   mcp__mem0__add_memory with:
   - user_id="$CONTINUITY_USER_ID"
   - text="Session Summary: ${SUMMARY_TEXT:-Session work}"${BLOCKERS:+
   - Blockers: $BLOCKERS}${NEXT_STEPS:+
   - Next steps: $NEXT_STEPS}

2. Project Decisions:
   mcp__mem0__add_memory with:
   - user_id="$DECISIONS_USER_ID"
   - text=<decision content>

3. Agent Patterns (if valuable for future sessions):
   mcp__mem0__add_memory with:
   - user_id="$DECISIONS_USER_ID"
   - agent_id=<agent_id from pattern>

4. Cross-Project Best Practices (if pattern is generalizable):
   mcp__mem0__add_memory with:
   - user_id="$GLOBAL_USER_ID"
   - metadata={"project": "$PROJECT_ID", "outcome": "success"}
EOF
)

# Add session summary JSON hint if available
if [[ -n "$SESSION_SUMMARY_JSON" ]]; then
    MSG="${MSG}

5. Ready-to-use Session Summary JSON:
   $SESSION_SUMMARY_JSON"
fi

# Output valid JSON with sync recommendation
jq -n \
    --arg msg "$MSG" \
    '{
        continue: true,
        systemMessage: $msg
    }'