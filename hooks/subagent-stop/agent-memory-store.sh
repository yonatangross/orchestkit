#!/bin/bash
set -euo pipefail
# Agent Memory Store - Post-Tool Hook for Task
# CC 2.1.7 Compliant: includes continue field in all outputs
# Extracts and stores successful patterns after agent completion
#
# Strategy:
# - Parse agent output for decision patterns
# - Extract key architectural choices
# - Store in mem0 with agent_id scope for future retrieval
# - Track agent performance metrics
# - Detect categories for proper organization
# - Graph memory enabled by default (v1.2.0)
#
# Version: 1.2.0
# Part of mem0 Semantic Memory Integration (#40, #45)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"
source "$SCRIPT_DIR/../_lib/mem0.sh"

# Source feedback lib for agent performance tracking
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
FEEDBACK_LIB="${PLUGIN_ROOT}/.claude/scripts/feedback-lib.sh"
if [[ -f "$FEEDBACK_LIB" ]]; then
    source "$FEEDBACK_LIB"
fi

log_hook "Agent memory store hook starting"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Pattern extraction keywords
DECISION_PATTERNS=(
    "decided to"
    "chose"
    "implemented using"
    "selected"
    "opted for"
    "will use"
    "pattern:"
    "approach:"
    "architecture:"
    "recommends"
    "best practice"
    "anti-pattern"
    "learned that"
)

# Output patterns log
PATTERNS_LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/agent-patterns.jsonl"
AGENT_TRACKING_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/session"
mkdir -p "$(dirname "$PATTERNS_LOG")" 2>/dev/null || true

# -----------------------------------------------------------------------------
# Extract Agent Info from Hook Input
# -----------------------------------------------------------------------------

AGENT_TYPE=""
AGENT_ID=""
AGENT_OUTPUT=""
SUCCESS="true"
DURATION="0"

if [[ -n "$_HOOK_INPUT" ]]; then
    # CC 2.1.7 PostToolUse format
    AGENT_TYPE=$(echo "$_HOOK_INPUT" | jq -r '.tool_input.subagent_type // .tool_input.type // ""' 2>/dev/null || echo "")
    AGENT_OUTPUT=$(echo "$_HOOK_INPUT" | jq -r '.tool_result // ""' 2>/dev/null || echo "")

    # Check for error in output
    if echo "$_HOOK_INPUT" | jq -e '.error // false' >/dev/null 2>&1; then
        SUCCESS="false"
    fi

    # Extract duration if available
    DURATION=$(echo "$_HOOK_INPUT" | jq -r '.duration_ms // 0' 2>/dev/null || echo "0")
fi

# Try to get agent_id from tracking file (set by pretool hook)
if [[ -f "$AGENT_TRACKING_DIR/current-agent-id" ]]; then
    AGENT_ID=$(cat "$AGENT_TRACKING_DIR/current-agent-id" 2>/dev/null || echo "")
fi

# If no agent type, silent success
if [[ -z "$AGENT_TYPE" ]]; then
    log_hook "No agent type in input, skipping"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Build agent_id if not set
if [[ -z "$AGENT_ID" ]]; then
    AGENT_ID="skf:$AGENT_TYPE"
fi

log_hook "Processing completion for agent: $AGENT_TYPE (agent_id: $AGENT_ID, success: $SUCCESS)"

# -----------------------------------------------------------------------------
# Track Agent Performance (Feedback System)
# -----------------------------------------------------------------------------

if type log_agent_performance &>/dev/null; then
    log_agent_performance "$AGENT_TYPE" "$SUCCESS" "$DURATION"
    log_hook "Logged agent performance: $AGENT_TYPE"
fi

# -----------------------------------------------------------------------------
# Category Detection
# -----------------------------------------------------------------------------

detect_pattern_category() {
    local text="$1"
    
    # Security: Limit input length to prevent ReDoS (max 10KB)
    local max_length=10240
    if [[ ${#text} -gt $max_length ]]; then
        text="${text:0:$max_length}"
    fi
    
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    # Check for category keywords
    if [[ "$text_lower" == *"pagination"* || "$text_lower" == *"cursor"* || "$text_lower" == *"offset"* ]]; then
        echo "pagination"
    elif [[ "$text_lower" == *"security"* || "$text_lower" == *"vulnerability"* || "$text_lower" == *"exploit"* || "$text_lower" == *"injection"* || "$text_lower" == *"xss"* || "$text_lower" == *"csrf"* || "$text_lower" == *"owasp"* || "$text_lower" == *"safety"* || "$text_lower" == *"guardrail"* ]]; then
        echo "security"
    elif [[ "$text_lower" == *"database"* || "$text_lower" == *"sql"* || "$text_lower" == *"postgres"* || "$text_lower" == *"schema"* ]]; then
        echo "database"
    elif [[ "$text_lower" == *"api"* || "$text_lower" == *"endpoint"* || "$text_lower" == *"rest"* || "$text_lower" == *"graphql"* ]]; then
        echo "api"
    elif [[ "$text_lower" == *"auth"* || "$text_lower" == *"login"* || "$text_lower" == *"jwt"* || "$text_lower" == *"oauth"* ]]; then
        echo "authentication"
    elif [[ "$text_lower" == *"test"* || "$text_lower" == *"testing"* || "$text_lower" == *"pytest"* || "$text_lower" == *"jest"* || "$text_lower" == *"vitest"* || "$text_lower" == *"coverage"* || "$text_lower" == *"mock"* || "$text_lower" == *"fixture"* || "$text_lower" == *"spec"* ]]; then
        echo "testing"
    elif [[ "$text_lower" == *"deploy"* || "$text_lower" == *"ci"* || "$text_lower" == *"cd"* || "$text_lower" == *"pipeline"* || "$text_lower" == *"docker"* || "$text_lower" == *"kubernetes"* || "$text_lower" == *"helm"* || "$text_lower" == *"terraform"* ]]; then
        echo "deployment"
    elif [[ "$text_lower" == *"observability"* || "$text_lower" == *"monitoring"* || "$text_lower" == *"logging"* || "$text_lower" == *"tracing"* || "$text_lower" == *"metrics"* || "$text_lower" == *"prometheus"* || "$text_lower" == *"grafana"* || "$text_lower" == *"langfuse"* ]]; then
        echo "observability"
    elif [[ "$text_lower" == *"react"* || "$text_lower" == *"component"* || "$text_lower" == *"frontend"* || "$text_lower" == *"ui"* ]]; then
        echo "frontend"
    elif [[ "$text_lower" == *"performance"* || "$text_lower" == *"optimization"* || "$text_lower" == *"cache"* || "$text_lower" == *"index"* ]]; then
        echo "performance"
    elif [[ "$text_lower" == *"llm"* || "$text_lower" == *"rag"* || "$text_lower" == *"embedding"* || "$text_lower" == *"vector"* || "$text_lower" == *"semantic"* || "$text_lower" == *"ai"* || "$text_lower" == *"ml"* || "$text_lower" == *"langchain"* || "$text_lower" == *"langgraph"* || "$text_lower" == *"mem0"* || "$text_lower" == *"openai"* || "$text_lower" == *"anthropic"* ]]; then
        echo "ai-ml"
    elif [[ "$text_lower" == *"etl"* || "$text_lower" == *"data"*"pipeline"* || "$text_lower" == *"streaming"* || "$text_lower" == *"batch"*"processing"* || "$text_lower" == *"dataflow"* || "$text_lower" == *"spark"* ]]; then
        echo "data-pipeline"
    elif [[ "$text_lower" == *"architecture"* || "$text_lower" == *"design"* || "$text_lower" == *"structure"* ]]; then
        echo "architecture"
    elif [[ "$text_lower" == *"decided"* || "$text_lower" == *"chose"* || "$text_lower" == *"selected"* ]]; then
        echo "decision"
    else
        echo "pattern"
    fi
}

# -----------------------------------------------------------------------------
# Extract Patterns from Output
# -----------------------------------------------------------------------------

extract_patterns() {
    local output="$1"
    local patterns=()

    # Skip if output is too short or empty
    if [[ ${#output} -lt 50 ]]; then
        return
    fi

    # Extract sentences containing decision patterns
    for pattern in "${DECISION_PATTERNS[@]}"; do
        # Extract lines containing the pattern (case-insensitive)
        while IFS= read -r line; do
            # Clean and truncate the line
            line=$(echo "$line" | sed 's/^[[:space:]]*//' | cut -c1-200)
            if [[ -n "$line" && ${#line} -gt 20 ]]; then
                patterns+=("$line")
            fi
        done < <(echo "$output" | grep -i "$pattern" 2>/dev/null || true)
    done

    # Deduplicate and return
    printf '%s\n' "${patterns[@]}" | sort -u | head -5
}

# Extract patterns (only if successful)
EXTRACTED_PATTERNS=""
if [[ "$SUCCESS" == "true" && -n "$AGENT_OUTPUT" ]]; then
    EXTRACTED_PATTERNS=$(extract_patterns "$AGENT_OUTPUT")
fi

# -----------------------------------------------------------------------------
# Log Patterns for Storage
# -----------------------------------------------------------------------------

if [[ -n "$EXTRACTED_PATTERNS" ]]; then
    PROJECT_ID=$(mem0_get_project_id)
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    AGENT_USER_ID=$(mem0_user_id "$MEM0_SCOPE_AGENTS")
    DECISIONS_USER_ID=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")

    # Log each pattern with category detection
    while IFS= read -r pattern; do
        if [[ -n "$pattern" ]]; then
            # Detect category for this pattern
            CATEGORY=$(detect_pattern_category "$pattern")

            # Log to patterns file with full metadata
            jq -n \
                --arg agent "$AGENT_TYPE" \
                --arg agent_id "$AGENT_ID" \
                --arg pattern "$pattern" \
                --arg project "$PROJECT_ID" \
                --arg timestamp "$TIMESTAMP" \
                --arg user_id "$DECISIONS_USER_ID" \
                --arg category "$CATEGORY" \
                '{
                    agent: $agent,
                    agent_id: $agent_id,
                    pattern: $pattern,
                    project: $project,
                    timestamp: $timestamp,
                    suggested_user_id: $user_id,
                    category: $category,
                    enable_graph: true,
                    pending_sync: true
                }' >> "$PATTERNS_LOG"

            log_hook "Extracted pattern ($CATEGORY): ${pattern:0:50}..."
        fi
    done <<< "$EXTRACTED_PATTERNS"

    PATTERN_COUNT=$(echo "$EXTRACTED_PATTERNS" | grep -c . || echo "0")
    log_hook "Extracted $PATTERN_COUNT patterns from $AGENT_TYPE output"

    # Build suggestion for Claude to store memories (graph memory enabled by default in v1.2.0)
    SYSTEM_MSG="[Pattern Extraction] $PATTERN_COUNT patterns extracted from $AGENT_TYPE. Use mcp__mem0__add_memory with user_id='$DECISIONS_USER_ID', agent_id='$AGENT_ID' to persist (graph memory auto-enabled)."

    jq -n \
        --arg msg "$SYSTEM_MSG" \
        '{
            continue: true,
            systemMessage: $msg
        }'
else
    log_hook "No patterns extracted from $AGENT_TYPE output"
    echo '{"continue":true,"suppressOutput":true}'
fi

# Clean up tracking file
rm -f "$AGENT_TRACKING_DIR/current-agent-id" 2>/dev/null || true

exit 0