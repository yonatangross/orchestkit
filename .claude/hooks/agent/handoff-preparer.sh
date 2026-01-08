#!/bin/bash
# handoff-preparer.sh - Prepares context for handoff to next agent in pipeline

set -e

# Get agent name and timestamp
AGENT_NAME="${CLAUDE_AGENT_NAME:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Read stdin (the agent's output)
OUTPUT=$(cat)

# Get next agent in pipeline using case statement (Bash 3.2 compatible)
get_next_agent() {
    case "$1" in
        "market-intelligence") echo "product-strategist" ;;
        "product-strategist") echo "prioritization-analyst" ;;
        "prioritization-analyst") echo "requirements-translator" ;;
        "requirements-translator") echo "backend-system-architect" ;;
        "backend-system-architect") echo "database-engineer" ;;
        "database-engineer") echo "frontend-ui-developer" ;;
        "frontend-ui-developer") echo "test-generator" ;;
        "test-generator") echo "code-quality-reviewer" ;;
        "code-quality-reviewer") echo "security-auditor" ;;
        *) echo "none" ;;
    esac
}

NEXT=$(get_next_agent "$AGENT_NAME")

# Extract key information from output
OUTPUT_LENGTH=${#OUTPUT}
SUMMARY=$(echo "$OUTPUT" | head -c 300)
if [ ${#OUTPUT} -gt 300 ]; then
    SUMMARY="${SUMMARY}..."
fi

# Generate handoff suggestions based on agent type
SUGGESTIONS=""
case "$AGENT_NAME" in
    "market-intelligence")
        SUGGESTIONS="Next: product-strategist should define product vision based on market analysis"
        ;;
    "product-strategist")
        SUGGESTIONS="Next: prioritization-analyst should rank features from strategy"
        ;;
    "prioritization-analyst")
        SUGGESTIONS="Next: requirements-translator should convert priorities to technical specs"
        ;;
    "requirements-translator")
        SUGGESTIONS="Next: backend-system-architect should design API endpoints"
        ;;
    "backend-system-architect")
        SUGGESTIONS="Next: database-engineer should create schema migrations"
        ;;
    "database-engineer")
        SUGGESTIONS="Next: frontend-ui-developer should build UI components"
        ;;
    "frontend-ui-developer")
        SUGGESTIONS="Next: test-generator should create test coverage"
        ;;
    "test-generator")
        SUGGESTIONS="Next: code-quality-reviewer should validate implementation"
        ;;
    "code-quality-reviewer")
        SUGGESTIONS="Next: security-auditor should perform security scan"
        ;;
    *)
        SUGGESTIONS="Pipeline complete or agent not in standard pipeline"
        ;;
esac

# Create handoff context file
HANDOFF_DIR="$CLAUDE_PROJECT_DIR/.claude/context/handoffs"
mkdir -p "$HANDOFF_DIR"
HANDOFF_FILE="$HANDOFF_DIR/${AGENT_NAME}_to_${NEXT}_$(date +%Y%m%d_%H%M%S).json"

jq -n \
    --arg from "$AGENT_NAME" \
    --arg to "$NEXT" \
    --arg timestamp "$TIMESTAMP" \
    --arg summary "$SUMMARY" \
    --arg suggestions "$SUGGESTIONS" \
    --arg output "$OUTPUT" \
    '{
        from_agent: $from,
        to_agent: $to,
        timestamp: $timestamp,
        summary: $summary,
        suggestions: $suggestions,
        full_output: $output,
        status: "ready_for_handoff"
    }' > "$HANDOFF_FILE"

# Create system message
SYSTEM_MESSAGE="Handoff Prepared
From: $AGENT_NAME
To: $NEXT
Timestamp: $TIMESTAMP
Handoff file: $HANDOFF_FILE

Summary:
$SUMMARY

Next Steps:
$SUGGESTIONS"

# Log to file
LOG_DIR="$CLAUDE_PROJECT_DIR/.claude/logs/agent-handoffs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${AGENT_NAME}_$(date +%Y%m%d_%H%M%S).log"

{
    echo "=== HANDOFF PREPARATION ==="
    echo "$SYSTEM_MESSAGE"
} > "$LOG_FILE"

# Return system message
echo "$SYSTEM_MESSAGE"

# Output systemMessage for user visibility
echo '{"systemMessage":"Handoff prepared"}'
exit 0
