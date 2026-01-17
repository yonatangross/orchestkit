#!/bin/bash
# Mem0 Decision Saver Hook
# Extracts and suggests saving design decisions after skill completion
# Enhanced with graph memory support and category detection
#
# Version: 1.2.1 - Uses mem0.sh v1.2.0 with graph-first defaults

set -euo pipefail

# Read stdin BEFORE sourcing libraries
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source mem0 library
source "$SCRIPT_DIR/../_lib/mem0.sh" 2>/dev/null || {
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || true

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Decision indicators in skill output
DECISION_INDICATORS=(
    "decided"
    "chose"
    "selected"
    "will use"
    "implemented"
    "architecture:"
    "pattern:"
    "approach:"
    "recommendation:"
    "best practice:"
    "conclusion:"
)

# Minimum output length to process
MIN_OUTPUT_LENGTH=100

# -----------------------------------------------------------------------------
# Extract Skill Info from Hook Input
# -----------------------------------------------------------------------------

SKILL_NAME=""
SKILL_OUTPUT=""

if [[ -n "$_HOOK_INPUT" ]]; then
    # Extract skill name and output from hook input
    SKILL_NAME=$(echo "$_HOOK_INPUT" | jq -r '.skill_name // .tool_input.skill // ""' 2>/dev/null || echo "")
    SKILL_OUTPUT=$(echo "$_HOOK_INPUT" | jq -r '.tool_result // .output // ""' 2>/dev/null || echo "")
fi

# Skip if no skill output or too short
if [[ -z "$SKILL_OUTPUT" || ${#SKILL_OUTPUT} -lt $MIN_OUTPUT_LENGTH ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Category Detection
# -----------------------------------------------------------------------------

detect_decision_category() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    if [[ "$text_lower" == *"pagination"* || "$text_lower" == *"cursor"* || "$text_lower" == *"offset"* ]]; then
        echo "pagination"
    elif [[ "$text_lower" == *"database"* || "$text_lower" == *"sql"* || "$text_lower" == *"postgres"* || "$text_lower" == *"schema"* || "$text_lower" == *"migration"* ]]; then
        echo "database"
    elif [[ "$text_lower" == *"api"* || "$text_lower" == *"endpoint"* || "$text_lower" == *"rest"* || "$text_lower" == *"graphql"* ]]; then
        echo "api"
    elif [[ "$text_lower" == *"auth"* || "$text_lower" == *"login"* || "$text_lower" == *"jwt"* || "$text_lower" == *"oauth"* || "$text_lower" == *"security"* ]]; then
        echo "authentication"
    elif [[ "$text_lower" == *"react"* || "$text_lower" == *"component"* || "$text_lower" == *"frontend"* || "$text_lower" == *"ui"* || "$text_lower" == *"tailwind"* ]]; then
        echo "frontend"
    elif [[ "$text_lower" == *"performance"* || "$text_lower" == *"optimization"* || "$text_lower" == *"cache"* || "$text_lower" == *"index"* ]]; then
        echo "performance"
    elif [[ "$text_lower" == *"architecture"* || "$text_lower" == *"design"* || "$text_lower" == *"structure"* || "$text_lower" == *"pattern"* ]]; then
        echo "architecture"
    else
        echo "decision"
    fi
}

# -----------------------------------------------------------------------------
# Check for Decision Content
# -----------------------------------------------------------------------------

has_decision_content() {
    local output="$1"
    local output_lower
    output_lower=$(echo "$output" | tr '[:upper:]' '[:lower:]')

    for indicator in "${DECISION_INDICATORS[@]}"; do
        if [[ "$output_lower" == *"$indicator"* ]]; then
            return 0
        fi
    done

    return 1
}

# Check if output contains decision-worthy content
if ! has_decision_content "$SKILL_OUTPUT"; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Extract Decisions
# -----------------------------------------------------------------------------

extract_decisions() {
    local output="$1"
    local decisions=()

    for indicator in "${DECISION_INDICATORS[@]}"; do
        while IFS= read -r line; do
            # Clean and truncate
            line=$(echo "$line" | sed 's/^[[:space:]]*//' | cut -c1-300)
            if [[ -n "$line" && ${#line} -gt 30 ]]; then
                decisions+=("$line")
            fi
        done < <(echo "$output" | grep -i "$indicator" 2>/dev/null | head -3 || true)
    done

    # Deduplicate and return top 5
    printf '%s\n' "${decisions[@]}" | sort -u | head -5
}

EXTRACTED_DECISIONS=$(extract_decisions "$SKILL_OUTPUT")

if [[ -z "$EXTRACTED_DECISIONS" ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Build Storage Recommendation
# -----------------------------------------------------------------------------

PROJECT_ID=$(mem0_get_project_id)
DECISIONS_USER_ID=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")

# Detect primary category from first decision
FIRST_DECISION=$(echo "$EXTRACTED_DECISIONS" | head -1)
CATEGORY=$(detect_decision_category "$FIRST_DECISION")

DECISION_COUNT=$(echo "$EXTRACTED_DECISIONS" | grep -c . || echo "0")

# Build entity hints for graph memory
ENTITY_HINTS=$(mem0_extract_entities_hint "$FIRST_DECISION")

# Build system message with storage recommendation
MSG=$(cat <<EOF
[Decision Extraction] Found $DECISION_COUNT decisions from ${SKILL_NAME:-skill} (category: $CATEGORY)

To persist these decisions, use mcp__mem0__add_memory with:
- user_id="$DECISIONS_USER_ID"
- text=<decision content>
- metadata={"category": "$CATEGORY", "source": "skillforge-plugin", "skill": "${SKILL_NAME:-unknown}"}

Note: Graph memory enabled by default (v1.2.0) - entities extracted: $ENTITY_HINTS

Example decision: "${FIRST_DECISION:0:100}..."
EOF
)

# Output CC 2.1.7 compliant JSON
jq -n \
    --arg msg "$MSG" \
    '{
        continue: true,
        systemMessage: $msg
    }'