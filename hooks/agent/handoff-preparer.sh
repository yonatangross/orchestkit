#!/bin/bash
# handoff-preparer.sh - Prepares context for handoff to next agent in pipeline
# CC 2.1.6 Compliant: includes continue field in all outputs

set -euo pipefail

# Read stdin (the hook input JSON)
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Extract agent name from stdin JSON (subagent_type field from SubagentStop hook)
AGENT_NAME=$(echo "$_HOOK_INPUT" | jq -r '.subagent_type // .agent_type // "unknown"' 2>/dev/null || echo "unknown")

# List of valid pipeline agent names
VALID_AGENTS=(
  "market-intelligence"
  "product-strategist"
  "prioritization-analyst"
  "business-case-builder"
  "requirements-translator"
  "metrics-architect"
  "backend-system-architect"
  "code-quality-reviewer"
  "data-pipeline-engineer"
  "database-engineer"
  "debug-investigator"
  "frontend-ui-developer"
  "llm-integrator"
  "rapid-ui-designer"
  "security-auditor"
  "security-layer-auditor"
  "system-design-reviewer"
  "test-generator"
  "ux-researcher"
  "workflow-architect"
)

# Check if agent name is in valid list
is_valid_agent() {
  local name="$1"
  for valid in "${VALID_AGENTS[@]}"; do
    if [[ "$valid" == "$name" ]]; then
      return 0
    fi
  done
  return 1
}

# Skip if not a valid pipeline agent
if ! is_valid_agent "$AGENT_NAME"; then
  # Silent exit for non-pipeline agents (general-purpose, Explore, etc.)
  echo '{"continue":true}'
  exit 0
fi

# Get next agent in pipeline using case statement (Bash 3.2 compatible)
get_next_agent() {
    case "$1" in
        # Product thinking pipeline
        "market-intelligence") echo "product-strategist" ;;
        "product-strategist") echo "prioritization-analyst" ;;
        "prioritization-analyst") echo "business-case-builder" ;;
        "business-case-builder") echo "requirements-translator" ;;
        "requirements-translator") echo "metrics-architect" ;;
        "metrics-architect") echo "backend-system-architect" ;;
        # Full-stack pipeline
        "backend-system-architect") echo "frontend-ui-developer" ;;
        "frontend-ui-developer") echo "test-generator" ;;
        "test-generator") echo "code-quality-reviewer" ;;
        "code-quality-reviewer") echo "security-auditor" ;;
        # AI integration pipeline
        "workflow-architect") echo "llm-integrator" ;;
        "llm-integrator") echo "data-pipeline-engineer" ;;
        "data-pipeline-engineer") echo "code-quality-reviewer" ;;
        # Database pipeline
        "database-engineer") echo "backend-system-architect" ;;
        # UI pipeline
        "rapid-ui-designer") echo "frontend-ui-developer" ;;
        "ux-researcher") echo "rapid-ui-designer" ;;
        # Terminal agents
        "security-auditor") echo "none" ;;
        "security-layer-auditor") echo "none" ;;
        "debug-investigator") echo "none" ;;
        "system-design-reviewer") echo "none" ;;
        *) echo "none" ;;
    esac
}

NEXT=$(get_next_agent "$AGENT_NAME")

# Extract agent output if available
AGENT_OUTPUT=$(echo "$_HOOK_INPUT" | jq -r '.agent_output // .output // ""' 2>/dev/null || echo "")

# Generate handoff summary
OUTPUT_LENGTH=${#AGENT_OUTPUT}
if [[ $OUTPUT_LENGTH -gt 0 ]]; then
  SUMMARY=$(echo "$AGENT_OUTPUT" | head -c 300)
  if [[ $OUTPUT_LENGTH -gt 300 ]]; then
    SUMMARY="${SUMMARY}..."
  fi
else
  SUMMARY="Agent $AGENT_NAME completed"
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
        SUGGESTIONS="Next: business-case-builder should create ROI justification"
        ;;
    "business-case-builder")
        SUGGESTIONS="Next: requirements-translator should convert to technical specs"
        ;;
    "requirements-translator")
        SUGGESTIONS="Next: metrics-architect should define success criteria"
        ;;
    "metrics-architect")
        SUGGESTIONS="Next: backend-system-architect should design API endpoints"
        ;;
    "backend-system-architect")
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
    "workflow-architect")
        SUGGESTIONS="Next: llm-integrator should configure LLM providers"
        ;;
    "llm-integrator")
        SUGGESTIONS="Next: data-pipeline-engineer should set up embeddings"
        ;;
    "data-pipeline-engineer")
        SUGGESTIONS="Next: code-quality-reviewer should validate data pipeline"
        ;;
    "database-engineer")
        SUGGESTIONS="Next: backend-system-architect should integrate schema"
        ;;
    "rapid-ui-designer")
        SUGGESTIONS="Next: frontend-ui-developer should implement designs"
        ;;
    "ux-researcher")
        SUGGESTIONS="Next: rapid-ui-designer should create mockups"
        ;;
    *)
        SUGGESTIONS="Pipeline complete"
        ;;
esac

# Create handoff context file
HANDOFF_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/context/handoffs"
mkdir -p "$HANDOFF_DIR"
HANDOFF_FILE="$HANDOFF_DIR/${AGENT_NAME}_to_${NEXT}_$(date +%Y%m%d_%H%M%S).json"

jq -n \
    --arg from "$AGENT_NAME" \
    --arg to "$NEXT" \
    --arg timestamp "$TIMESTAMP" \
    --arg summary "$SUMMARY" \
    --arg suggestions "$SUGGESTIONS" \
    '{
        from_agent: $from,
        to_agent: $to,
        timestamp: $timestamp,
        summary: $summary,
        suggestions: $suggestions,
        status: "ready_for_handoff"
    }' > "$HANDOFF_FILE" 2>/dev/null || true

# Log to file
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/agent-handoffs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
LOG_FILE="$LOG_DIR/${AGENT_NAME}_$(date +%Y%m%d_%H%M%S).log"

{
    echo "=== HANDOFF PREPARATION ==="
    echo "From: $AGENT_NAME"
    echo "To: $NEXT"
    echo "Timestamp: $TIMESTAMP"
    echo "Handoff file: $HANDOFF_FILE"
    echo ""
    echo "Summary: $SUMMARY"
    echo ""
    echo "Next Steps: $SUGGESTIONS"
} > "$LOG_FILE" 2>/dev/null || true

# Output CC 2.1.6 compliant JSON
echo '{"continue":true}'
exit 0