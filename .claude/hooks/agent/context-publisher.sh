#!/bin/bash
# context-publisher.sh - Publishes agent decisions to shared context

set -e

# Get agent name and timestamp
AGENT_NAME="${CLAUDE_AGENT_NAME:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Read stdin (the agent's output)
OUTPUT=$(cat)

# Path to shared context
CONTEXT_FILE="$CLAUDE_PROJECT_DIR/.claude/context/shared-context.json"

# Ensure context file exists
if [ ! -f "$CONTEXT_FILE" ]; then
    echo '{"agent_decisions": {}, "tasks_completed": [], "tasks_pending": []}' > "$CONTEXT_FILE"
fi

# Extract summary from output (first 200 chars)
SUMMARY=$(echo "$OUTPUT" | head -c 200)
if [ ${#OUTPUT} -gt 200 ]; then
    SUMMARY="${SUMMARY}..."
fi

# Create agent decision entry
AGENT_KEY=$(echo "$AGENT_NAME" | sed 's/-/_/g')
DECISION_ENTRY=$(jq -n \
    --arg timestamp "$TIMESTAMP" \
    --arg summary "$SUMMARY" \
    --arg status "completed" \
    '{
        timestamp: $timestamp,
        summary: $summary,
        status: $status
    }')

# Update shared context with agent decision
TEMP_FILE=$(mktemp)
jq --arg key "$AGENT_KEY" \
   --argjson entry "$DECISION_ENTRY" \
   '.agent_decisions[$key] = $entry' \
   "$CONTEXT_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$CONTEXT_FILE"

# Add to tasks_completed
TASK_ENTRY=$(jq -n \
    --arg agent "$AGENT_NAME" \
    --arg timestamp "$TIMESTAMP" \
    --arg summary "$SUMMARY" \
    '{
        agent: $agent,
        timestamp: $timestamp,
        summary: $summary
    }')

TEMP_FILE=$(mktemp)
jq --argjson task "$TASK_ENTRY" \
   '.tasks_completed += [$task]' \
   "$CONTEXT_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$CONTEXT_FILE"

# Create system message
SYSTEM_MESSAGE="📝 Context Published
Agent: $AGENT_NAME
Timestamp: $TIMESTAMP
Context updated: $CONTEXT_FILE
Decision logged under: agent_decisions.$AGENT_KEY"

# Log to file
LOG_DIR="$CLAUDE_PROJECT_DIR/.claude/logs/agent-context"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${AGENT_NAME}_$(date +%Y%m%d_%H%M%S).log"

{
    echo "=== CONTEXT PUBLICATION ==="
    echo "$SYSTEM_MESSAGE"
    echo ""
    echo "=== AGENT OUTPUT ==="
    echo "$OUTPUT"
} > "$LOG_FILE"

# Return system message
echo "$SYSTEM_MESSAGE"

# Output systemMessage for user visibility
echo '{"systemMessage":"Context published"}'
exit 0
