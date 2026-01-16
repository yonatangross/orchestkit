#!/bin/bash
set -euo pipefail
# Memory Context - UserPromptSubmit Hook
# CC 2.1.7 Compliant: includes continue field and suppressOutput in all outputs
# Auto-searches mem0 for relevant context based on user prompt
#
# Strategy:
# - Extract key terms from user prompt
# - Search mem0 for relevant decisions/patterns
# - Inject search suggestions into context
# - Support @global prefix for cross-project search
# - Include agent context if CLAUDE_AGENT_ID is set
# - Suggest enable_graph for relationship queries
#
# Version: 1.2.0
# Part of mem0 Semantic Memory Integration (#40, #46)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || true
source "$SCRIPT_DIR/../_lib/mem0.sh" 2>/dev/null || {
    # mem0 lib not available - silent pass (CC 2.1.7)
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

log_hook "Memory context hook starting"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Keywords that suggest memory search would be valuable
MEMORY_TRIGGER_KEYWORDS=(
    "add"
    "implement"
    "create"
    "build"
    "design"
    "refactor"
    "update"
    "modify"
    "fix"
    "change"
    "continue"
    "resume"
    "remember"
    "previous"
    "last time"
    "before"
    "earlier"
    "pattern"
    "decision"
    "how did we"
    "what did we"
)

# Keywords that suggest graph search would be valuable
GRAPH_TRIGGER_KEYWORDS=(
    "relationship"
    "related"
    "connected"
    "depends"
    "uses"
    "recommends"
    "what does.*recommend"
    "how does.*work with"
)

# Minimum prompt length to trigger memory search (avoid short queries)
MIN_PROMPT_LENGTH=20

# -----------------------------------------------------------------------------
# Extract User Prompt
# -----------------------------------------------------------------------------

USER_PROMPT=""
if [[ -n "$_HOOK_INPUT" ]]; then
    USER_PROMPT=$(echo "$_HOOK_INPUT" | jq -r '.prompt // ""' 2>/dev/null || echo "")
fi

# Skip if prompt is too short
if [[ ${#USER_PROMPT} -lt $MIN_PROMPT_LENGTH ]]; then
    log_hook "Prompt too short (${#USER_PROMPT} chars), skipping memory search"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Detect Special Prefixes
# -----------------------------------------------------------------------------

USE_GLOBAL=false
USE_GRAPH=false
AGENT_CONTEXT=""

# Check for @global prefix
if [[ "$USER_PROMPT" == @global* || "$USER_PROMPT" == *"cross-project"* || "$USER_PROMPT" == *"all projects"* ]]; then
    USE_GLOBAL=true
    log_hook "Detected @global prefix - will suggest cross-project search"
fi

# Check for graph-related queries
prompt_lower=$(echo "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')
for keyword in "${GRAPH_TRIGGER_KEYWORDS[@]}"; do
    if [[ "$prompt_lower" =~ $keyword ]]; then
        USE_GRAPH=true
        log_hook "Detected graph-related query"
        break
    fi
done

# Check for agent context from environment
if [[ -n "${CLAUDE_AGENT_ID:-}" ]]; then
    AGENT_CONTEXT="$CLAUDE_AGENT_ID"
    log_hook "Agent context detected: $AGENT_CONTEXT"
fi

# Also check for agent tracking file
AGENT_TRACKING_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/session/current-agent-id"
if [[ -z "$AGENT_CONTEXT" && -f "$AGENT_TRACKING_FILE" ]]; then
    AGENT_CONTEXT=$(cat "$AGENT_TRACKING_FILE" 2>/dev/null || echo "")
fi

# -----------------------------------------------------------------------------
# Check if Memory Search Would Be Valuable
# -----------------------------------------------------------------------------

should_search_memory() {
    local prompt="$1"
    local prompt_lower
    prompt_lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')

    for keyword in "${MEMORY_TRIGGER_KEYWORDS[@]}"; do
        if [[ "$prompt_lower" == *"$keyword"* ]]; then
            return 0
        fi
    done

    return 1
}

# Check if prompt suggests memory search would be valuable
if ! should_search_memory "$USER_PROMPT"; then
    log_hook "No memory trigger keywords found, skipping"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Check mem0 Availability
# -----------------------------------------------------------------------------

if ! is_mem0_available; then
    log_hook "Mem0 not available, skipping memory search"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Build Search Suggestion
# -----------------------------------------------------------------------------

PROJECT_ID=$(mem0_get_project_id)
USER_ID_DECISIONS=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")
USER_ID_PATTERNS=$(mem0_user_id "$MEM0_SCOPE_PATTERNS")
GLOBAL_USER_ID=$(mem0_global_user_id "best-practices")

# Extract key terms for search (first 5 words, skip common words)
extract_search_terms() {
    local prompt="$1"
    echo "$prompt" | \
        tr '[:upper:]' '[:lower:]' | \
        tr -cs '[:alnum:]' ' ' | \
        tr -s ' ' | \
        sed 's/^ *//;s/ *$//' | \
        awk '{
            for(i=1; i<=NF && i<=10; i++) {
                # Skip common words
                if ($i !~ /^(the|a|an|to|for|in|on|at|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|can|may|might|must|shall|i|you|we|they|it|this|that|these|those|my|your|our|their|its|and|or|but|if|then|else|when|where|how|what|which|who|whom|with|from|into|onto|about|after|before|global)$/)
                    print $i
            }
        }' | \
        head -5 | \
        tr '\n' ' ' | \
        sed 's/ *$//'
}

SEARCH_TERMS=$(extract_search_terms "$USER_PROMPT")

if [[ -z "$SEARCH_TERMS" ]]; then
    log_hook "No search terms extracted, skipping"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

log_hook "Search terms: $SEARCH_TERMS"

# -----------------------------------------------------------------------------
# Build Context Suggestion Message
# -----------------------------------------------------------------------------

# Build filter JSON based on context
if [[ "$USE_GLOBAL" == "true" ]]; then
    PRIMARY_USER_ID="$GLOBAL_USER_ID"
    SCOPE_DESC="cross-project"
else
    PRIMARY_USER_ID="$USER_ID_DECISIONS"
    SCOPE_DESC="project"
fi

# Build main suggestion
SYSTEM_MSG="[Memory Context] For relevant past $SCOPE_DESC decisions, use mcp__mem0__search_memories with query=\"$SEARCH_TERMS\" and user_id=\"$PRIMARY_USER_ID\""

# Add graph suggestion if relevant
if [[ "$USE_GRAPH" == "true" ]]; then
    SYSTEM_MSG="$SYSTEM_MSG, enable_graph=true"
fi

# Add agent filter hint if in agent context
if [[ -n "$AGENT_CONTEXT" ]]; then
    SYSTEM_MSG="$SYSTEM_MSG | Agent context: $AGENT_CONTEXT - add agent_id filter for agent-specific memories"
fi

# Add global search hint if not already global
if [[ "$USE_GLOBAL" != "true" ]]; then
    SYSTEM_MSG="$SYSTEM_MSG | For cross-project patterns: user_id=\"$GLOBAL_USER_ID\""
fi

log_hook "Memory context available for: $SEARCH_TERMS"

# Silent operation - Claude already has access to mem0 tools
echo '{"continue": true, "suppressOutput": true}'

exit 0