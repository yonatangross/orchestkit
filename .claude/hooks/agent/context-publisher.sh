#!/bin/bash
# context-publisher.sh - Publishes agent decisions to context
# Hook: AgentStop
# CC 2.1.2 Compliant - Context Protocol 2.0

set -e

# Get agent name and timestamp
AGENT_NAME="${CLAUDE_AGENT_NAME:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Read stdin (the agent's output)
OUTPUT=$(cat)

# Context Protocol 2.0 paths
DECISIONS_FILE="$CLAUDE_PROJECT_DIR/.claude/context/knowledge/decisions/active.json"
SESSION_STATE="$CLAUDE_PROJECT_DIR/.claude/context/session/state.json"
DECISIONS_DIR="$CLAUDE_PROJECT_DIR/.claude/context/knowledge/decisions"

# Ensure directories exist
mkdir -p "$DECISIONS_DIR" 2>/dev/null || true
mkdir -p "$(dirname "$SESSION_STATE")" 2>/dev/null || true

# Extract summary from output (first 200 chars)
SUMMARY=$(echo "$OUTPUT" | head -c 200)
if [ ${#OUTPUT} -gt 200 ]; then
    SUMMARY="${SUMMARY}..."
fi

# Create agent key (replace hyphens with underscores for JSON)
AGENT_KEY=$(echo "$AGENT_NAME" | sed 's/-/_/g')

# === Update Decisions File (Context Protocol 2.0) ===
if [ ! -f "$DECISIONS_FILE" ]; then
    # Initialize decisions file
    jq -n '{
        schema_version: "2.0.0",
        decisions: {}
    }' > "$DECISIONS_FILE" 2>/dev/null || true
fi

# Create decision entry
DECISION_ENTRY=$(jq -n \
    --arg timestamp "$TIMESTAMP" \
    --arg summary "$SUMMARY" \
    --arg agent "$AGENT_NAME" \
    --arg status "completed" \
    '{
        timestamp: $timestamp,
        agent: $agent,
        summary: $summary,
        status: $status
    }')

# Update decisions file with agent decision
if [ -f "$DECISIONS_FILE" ]; then
    TEMP_FILE=$(mktemp)
    jq --arg key "$AGENT_KEY" \
       --argjson entry "$DECISION_ENTRY" \
       '.decisions[$key] = $entry' \
       "$DECISIONS_FILE" > "$TEMP_FILE" 2>/dev/null && \
        mv "$TEMP_FILE" "$DECISIONS_FILE" || rm -f "$TEMP_FILE"
fi

# === Update Session State (Context Protocol 2.0) ===
if [ ! -f "$SESSION_STATE" ]; then
    # Initialize session state
    jq -n --arg ts "$TIMESTAMP" '{
        schema_version: "2.0.0",
        session_id: "",
        started_at: $ts,
        last_activity: $ts,
        active_agent: null,
        tasks_pending: [],
        tasks_completed: []
    }' > "$SESSION_STATE" 2>/dev/null || true
fi

# Add task to completed list
TASK_ENTRY=$(jq -n \
    --arg agent "$AGENT_NAME" \
    --arg timestamp "$TIMESTAMP" \
    --arg summary "$SUMMARY" \
    '{
        agent: $agent,
        timestamp: $timestamp,
        summary: $summary
    }')

if [ -f "$SESSION_STATE" ]; then
    TEMP_FILE=$(mktemp)
    jq --argjson task "$TASK_ENTRY" \
       --arg ts "$TIMESTAMP" \
       '.tasks_completed += [$task] | .last_activity = $ts | .active_agent = null' \
       "$SESSION_STATE" > "$TEMP_FILE" 2>/dev/null && \
        mv "$TEMP_FILE" "$SESSION_STATE" || rm -f "$TEMP_FILE"
fi

# === Logging ===
LOG_DIR="$CLAUDE_PROJECT_DIR/.claude/logs/agent-context"
mkdir -p "$LOG_DIR" 2>/dev/null || true
LOG_FILE="$LOG_DIR/${AGENT_NAME}_$(date +%Y%m%d_%H%M%S).log"

{
    echo "=== CONTEXT PUBLICATION (Protocol 2.0) ==="
    echo "Agent: $AGENT_NAME"
    echo "Timestamp: $TIMESTAMP"
    echo "Decisions file: $DECISIONS_FILE"
    echo "Session state: $SESSION_STATE"
    echo ""
    echo "=== AGENT OUTPUT ==="
    echo "$OUTPUT"
} > "$LOG_FILE" 2>/dev/null || true

# CC 2.1.2 compliant output
echo '{"continue":true,"suppressOutput":true}'
exit 0