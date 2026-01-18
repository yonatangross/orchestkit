#!/bin/bash
set -euo pipefail
# Auto-Remember Continuity - Stop Hook
# CC 2.1.7 Compliant: Prompts Claude to store session context before end
#
# Graph-First Architecture (v2.1):
# - ALWAYS works - knowledge graph requires no configuration
# - Primary: Store in knowledge graph (mcp__memory__*)
# - Optional: Also sync to mem0 cloud if configured
#
# Purpose:
# - Before session ends, suggest storing important decisions/context
# - Enables cross-session continuity via knowledge graph
# - Optional mem0 enhancement for semantic search
#
# Version: 2.1.0 - Graph-First Architecture
# Part of Memory Fabric v2.1

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities if available
if [[ -f "$SCRIPT_DIR/../_lib/common.sh" ]]; then
    source "$SCRIPT_DIR/../_lib/common.sh"
fi

# Source mem0 library if available (optional enhancement)
MEM0_AVAILABLE=false
if [[ -f "$SCRIPT_DIR/../_lib/mem0.sh" ]]; then
    source "$SCRIPT_DIR/../_lib/mem0.sh"
    if is_mem0_available 2>/dev/null; then
        MEM0_AVAILABLE=true
    fi
fi

# Log function (fallback if common.sh not available)
log_hook() {
    local msg="$1"
    local log_file="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/stop-hooks.log"
    mkdir -p "$(dirname "$log_file")" 2>/dev/null || true
    echo "[$(date -Iseconds)] [auto-remember] $msg" >> "$log_file" 2>/dev/null || true
}

log_hook "Auto-remember continuity hook triggered"

# Graph-First: ALWAYS run - knowledge graph requires no configuration
# mem0 is an optional enhancement, not a requirement

# Get project info for the prompt
PROJECT_ID=""
if type mem0_get_project_id &>/dev/null; then
    PROJECT_ID=$(mem0_get_project_id)
fi

USER_ID_CONTINUITY=""
if type mem0_user_id &>/dev/null; then
    USER_ID_CONTINUITY=$(mem0_user_id "continuity")
fi

USER_ID_DECISIONS=""
if type mem0_user_id &>/dev/null; then
    USER_ID_DECISIONS=$(mem0_user_id "decisions")
fi

# Build the prompt for Claude to consider storing context (Graph-First)
if [[ "$MEM0_AVAILABLE" == "true" ]]; then
    MEM0_HINT="
   [Optional] Also sync to mem0 cloud with \`--mem0\` flag for semantic search"
else
    MEM0_HINT=""
fi

PROMPT_MSG="Before ending this session, consider preserving important context in the knowledge graph:

1. **Session Continuity** - If there's unfinished work or next steps:
   \`mcp__memory__create_entities\` with:
   \`\`\`json
   {\"entities\": [{
     \"name\": \"session-${PROJECT_ID:-project}\",
     \"entityType\": \"Session\",
     \"observations\": [\"What was done: [...]\", \"Next steps: [...]\"]
   }]}
   \`\`\`${MEM0_HINT}

2. **Important Decisions** - If architectural/design decisions were made:
   \`mcp__memory__create_entities\` with:
   \`\`\`json
   {\"entities\": [{
     \"name\": \"decision-[topic]\",
     \"entityType\": \"Decision\",
     \"observations\": [\"Decided: [...]\", \"Rationale: [...]\"]
   }]}
   \`\`\`

3. **Patterns Learned** - If something worked well or failed:
   - Use \`/remember --success \"pattern that worked\"\`
   - Use \`/remember --failed \"pattern that caused issues\"\`

Skip if this was just a quick question/answer session."

log_hook "Outputting memory prompt for session end"

# Output CC 2.1.7 compliant JSON with stop prompt
jq -n \
    --arg prompt "$PROMPT_MSG" \
    '{
        continue: true,
        stopPrompt: $prompt
    }'

exit 0