#!/bin/bash
set -euo pipefail
# Agent Memory Inject - Pre-Tool Hook for Task
# CC 2.1.7 Compliant: includes continue field in all outputs
# Injects actionable memory load instructions before agent spawn with cross-agent federation
#
# Strategy:
# - Query mem0 for agent-specific memories using agent_id scope
# - Query for project decisions relevant to agent's domain
# - Query related agents for cross-agent knowledge sharing (v1.2.0)
# - Query graph memory for entity relationships
# - Output actionable MCP call instructions for memory loading
# - Graph memory enabled by default (v1.2.0)
# - Support cross-project best practices lookup
#
# Version: 1.3.0
# Part of Mem0 Pro Integration - Memory Fabric
# Schema: memory-fabric.schema.json

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"
source "$SCRIPT_DIR/../_lib/mem0.sh"

log_hook "Agent memory inject hook starting (v1.3.0 - Memory Fabric)"

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
        infrastructure-architect) echo "infrastructure cloud Docker Kubernetes deployment" ;;
        ci-cd-engineer) echo "CI CD pipeline GitHub Actions deployment automation" ;;
        accessibility-specialist) echo "accessibility WCAG ARIA screen-reader a11y" ;;
        product-strategist) echo "product strategy roadmap features prioritization" ;;
        *) echo "$agent_type" ;;
    esac
}

# Get domain keywords as array (space-separated)
get_domain_keywords_array() {
    local agent_type="$1"
    get_agent_domain "$agent_type"
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
        for agent in database-engineer backend-system-architect frontend-ui-developer security-auditor test-generator workflow-architect llm-integrator data-pipeline-engineer metrics-architect ux-researcher code-quality-reviewer infrastructure-architect ci-cd-engineer accessibility-specialist product-strategist; do
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
# Build Memory Query Parameters
# -----------------------------------------------------------------------------

PROJECT_ID=$(mem0_get_project_id)
AGENT_USER_ID=$(mem0_user_id "$MEM0_SCOPE_AGENTS")
DECISIONS_USER_ID=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")
PATTERNS_USER_ID=$(mem0_user_id "$MEM0_SCOPE_PATTERNS")
GLOBAL_USER_ID=$(mem0_global_user_id "best-practices")

# Get domain keywords for this agent type
DOMAIN_KEYWORDS=$(get_agent_domain "$AGENT_TYPE")

# Build search query combining agent scope and domain
SEARCH_QUERY="$AGENT_TYPE patterns decisions $DOMAIN_KEYWORDS"

log_hook "Memory search: agent_id=$AGENT_ID, project=$PROJECT_ID"

# -----------------------------------------------------------------------------
# Build Actionable MCP Call Parameters (Memory Fabric v1.3.0)
# -----------------------------------------------------------------------------

# Get related agents for cross-agent knowledge sharing
RELATED_AGENTS=$(mem0_get_related_agents "$AGENT_TYPE")

# Build mem0 search JSON for agent-specific patterns
MEM0_AGENT_QUERY=$(mem0_search_memory_json "$MEM0_SCOPE_AGENTS" "$SEARCH_QUERY" "$MAX_MEMORIES" "true" "$AGENT_ID")

# Build mem0 search JSON for project decisions
MEM0_DECISIONS_QUERY=$(mem0_search_memory_json "$MEM0_SCOPE_DECISIONS" "$DOMAIN_KEYWORDS decisions" "$MAX_MEMORIES" "true")

# Build mem0 search JSON for global best practices
MEM0_GLOBAL_QUERY=$(jq -n \
    --arg query "$DOMAIN_KEYWORDS best practices" \
    --arg user_id "$GLOBAL_USER_ID" \
    --argjson limit "$MAX_MEMORIES" \
    '{
        query: $query,
        filters: {"AND": [{"user_id": $user_id}]},
        limit: $limit,
        enable_graph: true
    }')

# Build cross-agent search JSON if related agents exist
CROSS_AGENT_QUERY=""
if [[ -n "$RELATED_AGENTS" ]]; then
    CROSS_AGENT_QUERY=$(mem0_cross_agent_search_json "$AGENT_TYPE" "$DOMAIN_KEYWORDS")
fi

# Build graph memory query for entity relationships
GRAPH_QUERY="$AGENT_TYPE $DOMAIN_KEYWORDS"

# -----------------------------------------------------------------------------
# Build Actionable Memory Load Instructions
# -----------------------------------------------------------------------------

# Build the memory load instruction message
read -r -d '' MEMORY_LOAD_MSG << 'HEREDOC_END' || true
[Memory Fabric - Agent Context Load]

Execute these MCP calls to load context for AGENT_TYPE_PLACEHOLDER agent:

## 1. Agent-Specific Patterns (mem0)
```
mcp__mem0__search_memories
MEM0_AGENT_QUERY_PLACEHOLDER
```

## 2. Project Decisions (mem0)
```
mcp__mem0__search_memories
MEM0_DECISIONS_QUERY_PLACEHOLDER
```

## 3. Graph Memory Entities
```
mcp__memory__search_nodes
{"query": "GRAPH_QUERY_PLACEHOLDER"}
```

## 4. Cross-Project Best Practices (mem0)
```
mcp__mem0__search_memories
MEM0_GLOBAL_QUERY_PLACEHOLDER
```
HEREDOC_END

# Replace placeholders with actual values
MEMORY_LOAD_MSG="${MEMORY_LOAD_MSG//AGENT_TYPE_PLACEHOLDER/$AGENT_TYPE}"
MEMORY_LOAD_MSG="${MEMORY_LOAD_MSG//MEM0_AGENT_QUERY_PLACEHOLDER/$MEM0_AGENT_QUERY}"
MEMORY_LOAD_MSG="${MEMORY_LOAD_MSG//MEM0_DECISIONS_QUERY_PLACEHOLDER/$MEM0_DECISIONS_QUERY}"
MEMORY_LOAD_MSG="${MEMORY_LOAD_MSG//GRAPH_QUERY_PLACEHOLDER/$GRAPH_QUERY}"
MEMORY_LOAD_MSG="${MEMORY_LOAD_MSG//MEM0_GLOBAL_QUERY_PLACEHOLDER/$MEM0_GLOBAL_QUERY}"

# Add cross-agent section if related agents exist
if [[ -n "$RELATED_AGENTS" && -n "$CROSS_AGENT_QUERY" ]]; then
    CROSS_AGENT_SECTION="
## 5. Cross-Agent Knowledge (from: $RELATED_AGENTS)
\`\`\`
mcp__mem0__search_memories
$CROSS_AGENT_QUERY
\`\`\`"
    MEMORY_LOAD_MSG="${MEMORY_LOAD_MSG}${CROSS_AGENT_SECTION}"
fi

# Add integration instructions
MEMORY_LOAD_MSG="${MEMORY_LOAD_MSG}

## Integration Instructions
1. Execute the above MCP calls to retrieve relevant context
2. Review memories for patterns, decisions, and constraints
3. Check graph entities for relationships between concepts
4. Apply learned patterns to current task
5. Avoid known anti-patterns (outcome: failed)

Agent ID: $AGENT_ID | Domain: $DOMAIN_KEYWORDS | Related: ${RELATED_AGENTS:-none}"

# Build compact system message for quick reference
SYSTEM_MSG="[Memory Fabric] Agent: $AGENT_TYPE | ID: $AGENT_ID | Load context via MCP calls above | Related: ${RELATED_AGENTS:-none}"

log_hook "Outputting memory load instructions for $AGENT_TYPE (Memory Fabric v1.3.0)"

# -----------------------------------------------------------------------------
# Output CC 2.1.7 Compliant JSON with additionalContext (CC 2.1.9)
# -----------------------------------------------------------------------------

# Use additionalContext for the detailed memory load instructions
# This injects context BEFORE agent execution per CC 2.1.9 spec
jq -n \
    --arg msg "$SYSTEM_MSG" \
    --arg context "$MEMORY_LOAD_MSG" \
    '{
        continue: true,
        systemMessage: $msg,
        hookSpecificOutput: {
            additionalContext: $context
        }
    }'

exit 0
