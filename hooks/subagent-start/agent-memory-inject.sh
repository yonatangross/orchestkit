#!/bin/bash
set -euo pipefail
# Agent Memory Inject - Pre-Tool Hook for Task
# CC 2.1.7 Compliant: includes continue field in all outputs
# Injects relevant memories before agent spawn
#
# Strategy:
# - Query mem0 for agent-specific memories using agent_id scope
# - Query for project decisions relevant to agent's domain
# - Inject as system message for agent context
# - Support enable_graph for relationship queries
# - Support cross-project best practices lookup
#
# Version: 1.1.0
# Part of mem0 Semantic Memory Integration (#40, #44)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"
source "$SCRIPT_DIR/../_lib/mem0.sh"

log_hook "Agent memory inject hook starting"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Max memories to inject (prevent context bloat)
MAX_MEMORIES=5

# Tracking file for agent_id chain propagation
AGENT_TRACKING_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/session"
mkdir -p "$AGENT_TRACKING_DIR" 2>/dev/null || true

# Agent type to domain mapping - bash 3.2 compatible (no associative arrays)
get_agent_domain() {
    local agent_type="$1"
    case "$agent_type" in
        database-engineer) echo "database schema SQL PostgreSQL migration pgvector" ;;
        backend-system-architect) echo "API REST architecture backend FastAPI microservice" ;;
        frontend-ui-developer) echo "React frontend UI component TypeScript Tailwind" ;;
        security-auditor) echo "security OWASP vulnerability audit authentication" ;;
        test-generator) echo "testing unit integration coverage pytest MSW" ;;
        workflow-architect) echo "LangGraph workflow agent orchestration state" ;;
        llm-integrator) echo "LLM API OpenAI Anthropic embeddings RAG function-calling" ;;
        data-pipeline-engineer) echo "data pipeline embeddings vector ETL chunking" ;;
        metrics-architect) echo "metrics OKR KPI analytics instrumentation" ;;
        ux-researcher) echo "UX user research persona journey accessibility" ;;
        code-quality-reviewer) echo "code quality review linting type-check patterns" ;;
        *) echo "$agent_type" ;;
    esac
}

# -----------------------------------------------------------------------------
# Extract Agent Type from Hook Input
# -----------------------------------------------------------------------------

# Parse the Task tool input to get subagent_type
AGENT_TYPE=""
AGENT_ID=""

# Try to extract subagent_type from the hook input
if [[ -n "$_HOOK_INPUT" ]]; then
    # Try multiple fields for agent identification
    AGENT_TYPE=$(echo "$_HOOK_INPUT" | jq -r '.subagent_type // .type // ""' 2>/dev/null || echo "")

    # Also check for explicit agent_id in input
    AGENT_ID=$(echo "$_HOOK_INPUT" | jq -r '.agent_id // ""' 2>/dev/null || echo "")

    # Fallback: try to extract from prompt if it mentions an agent
    if [[ -z "$AGENT_TYPE" ]]; then
        PROMPT=$(echo "$_HOOK_INPUT" | jq -r '.prompt // ""' 2>/dev/null || echo "")
        # Check if prompt mentions a specific agent type
        for agent in database-engineer backend-system-architect frontend-ui-developer security-auditor test-generator workflow-architect llm-integrator data-pipeline-engineer metrics-architect ux-researcher code-quality-reviewer; do
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
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Build agent_id in skf format if not already set
if [[ -z "$AGENT_ID" ]]; then
    AGENT_ID="skf:$AGENT_TYPE"
fi

log_hook "Detected agent type: $AGENT_TYPE (agent_id: $AGENT_ID)"

# Store agent_id for chain propagation (posttool hooks can read this)
echo "$AGENT_ID" > "$AGENT_TRACKING_DIR/current-agent-id" 2>/dev/null || true

# -----------------------------------------------------------------------------
# Check if mem0 is available
# -----------------------------------------------------------------------------

if ! is_mem0_available; then
    log_hook "Mem0 not available, skipping memory injection"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Build Memory Query
# -----------------------------------------------------------------------------

PROJECT_ID=$(mem0_get_project_id)
AGENT_USER_ID=$(mem0_user_id "$MEM0_SCOPE_AGENTS")
DECISIONS_USER_ID=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")
GLOBAL_USER_ID=$(mem0_global_user_id "best-practices")

# Get domain keywords for this agent type
DOMAIN_KEYWORDS=$(get_agent_domain "$AGENT_TYPE")

# Build search query combining agent scope and domain
SEARCH_QUERY="$AGENT_TYPE patterns decisions $DOMAIN_KEYWORDS"

log_hook "Memory search: agent_id=$AGENT_ID, project=$PROJECT_ID"

# -----------------------------------------------------------------------------
# Build Memory Injection Message
# -----------------------------------------------------------------------------

# Generate the mem0 search parameters for Claude to use
# We output a suggestion for Claude to search, not the results directly
# (since hooks can't call MCP tools, only Claude can)

MEMORY_HINT=$(cat <<EOF
Before proceeding with this $AGENT_TYPE task, consider retrieving relevant context:

1. Agent-specific patterns (with relationships):
   mcp__mem0__search_memories with:
   - query="$SEARCH_QUERY"
   - filters={"AND": [{"user_id": "$AGENT_USER_ID"}, {"agent_id": "$AGENT_ID"}]}
   - enable_graph=true

2. Project decisions:
   mcp__mem0__search_memories with:
   - query="$DOMAIN_KEYWORDS"
   - filters={"AND": [{"user_id": "$DECISIONS_USER_ID"}]}

3. Cross-project best practices:
   mcp__mem0__search_memories with:
   - query="$DOMAIN_KEYWORDS best practices"
   - filters={"AND": [{"user_id": "$GLOBAL_USER_ID"}]}
   - enable_graph=true
EOF
)

# Build compact message for system context
SYSTEM_MSG="[Memory Context] Agent: $AGENT_TYPE | ID: $AGENT_ID | Domain: $DOMAIN_KEYWORDS | Search user_id: $DECISIONS_USER_ID (project), $GLOBAL_USER_ID (global)"

log_hook "Outputting memory injection hint for $AGENT_TYPE"

# Output CC 2.1.7 compliant JSON
jq -n \
    --arg msg "$SYSTEM_MSG" \
    '{
        continue: true,
        systemMessage: $msg
    }'

exit 0