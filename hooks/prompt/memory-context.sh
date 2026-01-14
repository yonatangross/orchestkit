#!/bin/bash
set -euo pipefail
# Memory Context - UserPromptSubmit Hook
# CC 2.1.6 Compliant: includes continue field in all outputs
# Auto-searches mem0 for relevant context based on user prompt
#
# Strategy:
# - Extract key terms from user prompt
# - Search mem0 for relevant decisions/patterns
# - Inject search suggestions into context
#
# Version: 1.0.0
# Part of mem0 Semantic Memory Integration (#40, #46)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || true
source "$SCRIPT_DIR/../_lib/mem0.sh" 2>/dev/null || {
    # mem0 lib not available - silent pass
    echo '{"continue": true}'
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
    echo '{"continue": true}'
    exit 0
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
    echo '{"continue": true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Check mem0 Availability
# -----------------------------------------------------------------------------

if ! is_mem0_available; then
    log_hook "Mem0 not available, skipping memory search"
    echo '{"continue": true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Build Search Suggestion
# -----------------------------------------------------------------------------

PROJECT_ID=$(mem0_get_project_id)
USER_ID_DECISIONS=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")
USER_ID_PATTERNS=$(mem0_user_id "$MEM0_SCOPE_PATTERNS")

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
                if ($i !~ /^(the|a|an|to|for|in|on|at|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|can|may|might|must|shall|i|you|we|they|it|this|that|these|those|my|your|our|their|its|and|or|but|if|then|else|when|where|how|what|which|who|whom|with|from|into|onto|about|after|before)$/)
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
    echo '{"continue": true}'
    exit 0
fi

log_hook "Search terms: $SEARCH_TERMS"

# Build context suggestion message
SYSTEM_MSG="[Memory Context] For relevant past decisions, use mcp__mem0__search_memories with query=\"$SEARCH_TERMS\" and user_id=\"$USER_ID_DECISIONS\""

log_hook "Outputting memory search suggestion for: $SEARCH_TERMS"

# Output CC 2.1.6 compliant JSON
jq -n \
    --arg msg "$SYSTEM_MSG" \
    '{
        continue: true,
        systemMessage: $msg
    }'

exit 0