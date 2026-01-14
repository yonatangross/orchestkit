#!/bin/bash
set -euo pipefail
# Agent Memory Inject - Pre-Tool Hook for Task
# CC 2.1.6 Compliant: includes continue field in all outputs
# Injects relevant memories before agent spawn
#
# Strategy:
# - Query mem0 for agent-specific memories using agent_id scope
# - Query for project decisions relevant to agent's domain
# - Inject as system message for agent context
#
# Version: 1.0.0
# Part of mem0 Semantic Memory Integration (#40, #44)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/common.sh"
source "$SCRIPT_DIR/../../_lib/mem0.sh"

log_hook "Agent memory inject hook starting"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Max memories to inject (prevent context bloat)
MAX_MEMORIES=5

# Agent type to domain mapping - bash 3.2 compatible (no associative arrays)
get_agent_domain() {
    local agent_type="$1"
    case "$agent_type" in
        database-engineer) echo "database schema SQL PostgreSQL migration" ;;
        backend-system-architect) echo "API REST architecture backend FastAPI" ;;
        frontend-ui-developer) echo "React frontend UI component TypeScript" ;;
        security-auditor) echo "security OWASP vulnerability audit" ;;
        test-generator) echo "testing unit integration coverage pytest" ;;
        workflow-architect) echo "LangGraph workflow agent orchestration" ;;
        llm-integrator) echo "LLM API OpenAI Anthropic embeddings RAG" ;;
        data-pipeline-engineer) echo "data pipeline embeddings vector ETL" ;;
        *) echo "$agent_type" ;;
    esac
}

# -----------------------------------------------------------------------------
# Extract Agent Type from Hook Input
# -----------------------------------------------------------------------------

# Parse the Task tool input to get subagent_type
AGENT_TYPE=""

# Try to extract subagent_type from the hook input
if [[ -n "$_HOOK_INPUT" ]]; then
    AGENT_TYPE=$(echo "$_HOOK_INPUT" | jq -r '.subagent_type // .type // ""' 2>/dev/null || echo "")

    # Fallback: try to extract from prompt if it mentions an agent
    if [[ -z "$AGENT_TYPE" ]]; then
        PROMPT=$(echo "$_HOOK_INPUT" | jq -r '.prompt // ""' 2>/dev/null || echo "")
        # Check if prompt mentions a specific agent type
        for agent in database-engineer backend-system-architect frontend-ui-developer security-auditor test-generator workflow-architect llm-integrator data-pipeline-engineer; do
            if echo "$PROMPT" | grep -qi "$agent"; then
                AGENT_TYPE="$agent"
                break
            fi
        done
    fi
fi

# If no agent type detected, silent success
if [[ -z "$AGENT_TYPE" ]]; then
    log_hook "No agent type detected, passing through"
    echo '{"continue": true}'
    exit 0
fi

log_hook "Detected agent type: $AGENT_TYPE"

# -----------------------------------------------------------------------------
# Check if mem0 is available
# -----------------------------------------------------------------------------

if ! is_mem0_available; then
    log_hook "Mem0 not available, skipping memory injection"
    echo '{"continue": true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Build Memory Query
# -----------------------------------------------------------------------------

PROJECT_ID=$(mem0_get_project_id)
AGENT_USER_ID=$(mem0_user_id "$MEM0_SCOPE_AGENTS")

# Get domain keywords for this agent type
DOMAIN_KEYWORDS=$(get_agent_domain "$AGENT_TYPE")

# Build search query combining agent scope and domain
SEARCH_QUERY="$AGENT_TYPE patterns decisions $DOMAIN_KEYWORDS"

log_hook "Memory search: agent_id=skf:$AGENT_TYPE, project=$PROJECT_ID"

# -----------------------------------------------------------------------------
# Build Memory Injection Message
# -----------------------------------------------------------------------------

# Generate the mem0 search parameters for Claude to use
# We output a suggestion for Claude to search, not the results directly
# (since hooks can't call MCP tools, only Claude can)

MEMORY_HINT=$(cat <<EOF
Before proceeding with this $AGENT_TYPE task, consider retrieving relevant context:
- Use mcp__mem0__search_memories with query="$SEARCH_QUERY" and user_id="$AGENT_USER_ID" to find agent-specific patterns
- Use mcp__mem0__search_memories with query="decisions $DOMAIN_KEYWORDS" and user_id="${PROJECT_ID}-decisions" to find relevant architectural decisions
EOF
)

# Build compact message
SYSTEM_MSG="[Memory Context] Agent: $AGENT_TYPE | Project: $PROJECT_ID"

# Only add hint if we have domain info
if [[ -n "$(get_agent_domain "$AGENT_TYPE")" && "$(get_agent_domain "$AGENT_TYPE")" != "$AGENT_TYPE" ]]; then
    SYSTEM_MSG="$SYSTEM_MSG | Domain: $DOMAIN_KEYWORDS"
fi

log_hook "Outputting memory injection hint for $AGENT_TYPE"

# Output CC 2.1.6 compliant JSON
jq -n \
    --arg msg "$SYSTEM_MSG" \
    '{
        continue: true,
        systemMessage: $msg
    }'

exit 0