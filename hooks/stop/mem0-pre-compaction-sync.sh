#!/bin/bash
# Mem0 Pre-Compaction Sync Hook
# Prompts Claude to save important session context to Mem0 before compaction
# Enhanced with graph memory support and pending pattern sync
#
# Version: 1.2.0 - Added graph memory and agent pattern sync

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
        # Get synced decision IDs
        SYNCED_IDS=$(jq -r '.synced_decisions // []' "$SYNC_STATE" 2>/dev/null || echo '[]')
        # Count decisions NOT in synced list
        DECISION_COUNT=$(jq --argjson synced "$SYNCED_IDS" '
            [.decisions[]? | select(.decision_id as $id | $synced | index($id) | not)] | length
        ' "$DECISION_LOG" 2>/dev/null || echo "0")
    else
        # No sync state = all are pending
        DECISION_COUNT=$(jq '.decisions | length // 0' "$DECISION_LOG" 2>/dev/null || echo "0")
    fi
    if [[ "$DECISION_COUNT" == "null" ]]; then
        DECISION_COUNT=0
    fi
fi

# Count and read pending patterns
if [[ -f "$PATTERNS_LOG" ]]; then
    # Count patterns marked as pending_sync
    PATTERN_COUNT=$(grep -c '"pending_sync":true' "$PATTERNS_LOG" 2>/dev/null || echo "0")

    # Read pending patterns (last 10)
    if [[ "$PATTERN_COUNT" -gt 0 ]]; then
        PENDING_PATTERNS=$(grep '"pending_sync":true' "$PATTERNS_LOG" 2>/dev/null | tail -10)
    fi
fi

# If nothing to sync, silent exit
if [[ "$DECISION_COUNT" == "0" && "$PATTERN_COUNT" == "0" ]]; then
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

    # Extract unique agents from pending patterns
    if [[ -n "$PENDING_PATTERNS" ]]; then
        UNIQUE_AGENTS=$(echo "$PENDING_PATTERNS" | jq -r '.agent_id // .agent' 2>/dev/null | sort -u | head -5 | tr '\n' ', ' | sed 's/,$//')
        if [[ -n "$UNIQUE_AGENTS" ]]; then
            MSG_PARTS+=("agents: $UNIQUE_AGENTS")
        fi
    fi
fi

# Build the summary
SUMMARY=$(IFS='; '; echo "${MSG_PARTS[*]}")

# Build detailed sync message
MSG=$(cat <<EOF
[Session Sync] $SUMMARY

Before session ends, consider saving important context to Mem0:

1. Project Decisions:
   mcp__mem0__add_memory with:
   - user_id="$DECISIONS_USER_ID"
   - enable_graph=true (preserves entity relationships)

2. Agent Patterns (if valuable for future sessions):
   mcp__mem0__add_memory with:
   - user_id="$DECISIONS_USER_ID"
   - agent_id=<agent_id from pattern>
   - enable_graph=true

3. Cross-Project Best Practices (if pattern is generalizable):
   mcp__mem0__add_memory with:
   - user_id="$GLOBAL_USER_ID"
   - enable_graph=true
   - metadata={"project": "$PROJECT_ID", "outcome": "success"}
EOF
)

# Output valid JSON with sync recommendation
jq -n \
    --arg msg "$MSG" \
    '{
        continue: true,
        systemMessage: $msg
    }'