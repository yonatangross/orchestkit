#!/bin/bash
set -euo pipefail
# Antipattern Detector - UserPromptSubmit Hook
# CC 2.1.7 Compliant: Suggests checking mem0 for known failed patterns
#
# Purpose:
# - Suggest checking mem0 for previously failed approaches
# - Warn before repeating past mistakes
#
# Version: 1.0.0
# Part of mem0 Semantic Memory Integration (#49)

# Read stdin BEFORE sourcing to avoid subshell issues
if [[ -t 0 ]]; then
    _HOOK_INPUT=""
else
    _HOOK_INPUT=$(cat 2>/dev/null || true)
fi
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities
if [[ -f "$SCRIPT_DIR/../_lib/common.sh" ]]; then
    source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || true
fi

# Source mem0 library
MEM0_AVAILABLE=false
if [[ -f "$SCRIPT_DIR/../_lib/mem0.sh" ]]; then
    source "$SCRIPT_DIR/../_lib/mem0.sh" 2>/dev/null || true
    if type is_mem0_available &>/dev/null && is_mem0_available 2>/dev/null; then
        MEM0_AVAILABLE=true
    fi
fi

# Log function (fallback)
log_hook() {
    local msg="$1"
    local log_file="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/prompt-hooks.log"
    mkdir -p "$(dirname "$log_file")" 2>/dev/null || true
    echo "[$(date -Iseconds)] [antipattern] $msg" >> "$log_file" 2>/dev/null || true
}

# Skip if mem0 not available
if [[ "$MEM0_AVAILABLE" != "true" ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Extract user prompt
USER_PROMPT=""
if [[ -n "$_HOOK_INPUT" ]]; then
    USER_PROMPT=$(echo "$_HOOK_INPUT" | jq -r '.prompt // ""' 2>/dev/null || echo "")
fi

# Skip if prompt too short
if [[ ${#USER_PROMPT} -lt 30 ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Keywords that suggest implementation work where antipatterns matter
IMPLEMENTATION_KEYWORDS=(
    "implement"
    "add"
    "create"
    "build"
    "set up"
    "configure"
    "pagination"
    "authentication"
    "caching"
    "database"
    "api"
    "endpoint"
)

# Check if prompt suggests implementation work
prompt_lower=$(echo "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')
should_check=false
matched_keyword=""

for keyword in "${IMPLEMENTATION_KEYWORDS[@]}"; do
    if [[ "$prompt_lower" == *"$keyword"* ]]; then
        should_check=true
        matched_keyword="$keyword"
        break
    fi
done

if [[ "$should_check" != "true" ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

log_hook "Implementation keyword detected: $matched_keyword"

# Get category for the prompt
CATEGORY=""
if type detect_best_practice_category &>/dev/null; then
    CATEGORY=$(detect_best_practice_category "$USER_PROMPT")
fi

# Get user_id for failed patterns
GLOBAL_USER_ID=""
if type mem0_global_user_id &>/dev/null; then
    GLOBAL_USER_ID=$(mem0_global_user_id "best-practices")
fi

PROJECT_USER_ID=""
if type mem0_user_id &>/dev/null; then
    PROJECT_USER_ID=$(mem0_user_id "best-practices")
fi

# Build search suggestion
SYSTEM_MSG="[Antipattern Check] Before implementing ${matched_keyword}, check for known failures:
\`mcp__mem0__search_memories\` with query=\"${matched_keyword} failed\" and filters={\"AND\":[{\"user_id\":\"${PROJECT_USER_ID}\"},{\"metadata.outcome\":\"failed\"}]}
Or check global: user_id=\"${GLOBAL_USER_ID}\""

log_hook "Suggesting antipattern check for: $matched_keyword (category: $CATEGORY)"

# Output CC 2.1.7 compliant JSON
jq -n \
    --arg msg "$SYSTEM_MSG" \
    '{
        continue: true,
        systemMessage: $msg
    }'

output_silent_success
exit 0