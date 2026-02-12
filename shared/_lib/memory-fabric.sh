#!/bin/bash
# Memory Fabric Orchestration Library for OrchestKit Plugin
# Graph-Only Architecture (v3.0): mcp__memory (local graph) as sole memory tier
#
# Version: 3.0.0
#
# Usage: source "${CLAUDE_PLUGIN_ROOT}/hooks/_lib/memory-fabric.sh"
#
# Architecture (v3.0 Graph-Only):
# - PRIMARY: mcp__memory__* (local knowledge graph) - zero-config, always works
# - PERSISTENCE: CC Native MEMORY.md - auto-injected, survives plugin removal

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Maximum results per search
[[ -z "${FABRIC_MAX_RESULTS:-}" ]] && readonly FABRIC_MAX_RESULTS="20"

# Ranking weights
[[ -z "${FABRIC_WEIGHT_RECENCY:-}" ]] && readonly FABRIC_WEIGHT_RECENCY="0.3"
[[ -z "${FABRIC_WEIGHT_RELEVANCE:-}" ]] && readonly FABRIC_WEIGHT_RELEVANCE="0.5"
[[ -z "${FABRIC_WEIGHT_AUTHORITY:-}" ]] && readonly FABRIC_WEIGHT_AUTHORITY="0.2"

# Known entity types for extraction
readonly FABRIC_ENTITY_TYPES=("agent" "technology" "pattern" "decision" "blocker")

# Known OrchestKit agents
readonly FABRIC_KNOWN_AGENTS=(
    "database-engineer"
    "backend-system-architect"
    "frontend-ui-developer"
    "security-auditor"
    "test-generator"
    "workflow-architect"
    "llm-integrator"
    "data-pipeline-engineer"
    "system-design-reviewer"
    "metrics-architect"
    "debug-investigator"
    "security-layer-auditor"
    "ux-researcher"
    "product-strategist"
    "code-quality-reviewer"
    "requirements-translator"
    "prioritization-analyst"
    "rapid-ui-designer"
    "market-intelligence"
    "business-case-builder"
    "infrastructure-architect"
    "ci-cd-engineer"
    "deployment-manager"
    "accessibility-specialist"
)

# Known technologies for entity extraction
readonly FABRIC_KNOWN_TECHNOLOGIES=(
    "pgvector" "postgresql" "fastapi" "sqlalchemy" "react" "typescript"
    "langgraph" "redis" "celery" "docker" "kubernetes" "python"
    "javascript" "nextjs" "vite" "prisma" "drizzle" "zod" "pydantic"
    "alembic" "pytest" "vitest" "playwright" "langchain" "openai"
    "anthropic" "langfuse"
)

# -----------------------------------------------------------------------------
# Availability Check Functions
# -----------------------------------------------------------------------------

# Graph is always available (built-in MCP)
is_graph_available() { return 0; }
is_memory_available() { return 0; }

# -----------------------------------------------------------------------------
# Project Context Functions
# -----------------------------------------------------------------------------

fabric_get_project_context() {
    local project_id
    project_id=$(basename "${CLAUDE_PROJECT_DIR:-.}")

    jq -n \
        --arg project_id "$project_id" \
        --arg decisions "${project_id}-decisions" \
        --arg patterns "${project_id}-patterns" \
        --arg continuity "${project_id}-continuity" \
        --arg agents "${project_id}-agents" \
        --arg best_practices "${project_id}-best-practices" \
        '{
            project_id: $project_id,
            user_ids: {
                decisions: $decisions,
                patterns: $patterns,
                continuity: $continuity,
                agents: $agents,
                best_practices: $best_practices
            }
        }'
}

# -----------------------------------------------------------------------------
# Graph Search Functions
# -----------------------------------------------------------------------------

# Build JSON for graph search
# Usage: fabric_graph_search "query" ["limit"]
fabric_graph_search() {
    local query="$1"
    local limit="${2:-$FABRIC_MAX_RESULTS}"

    jq -n \
        --arg query "$query" \
        --argjson limit "$limit" \
        '{
            query: $query,
            tool: "mcp__memory__search_nodes",
            limit: $limit
        }'
}

# Build graph search with agent filter
# Usage: fabric_graph_search_agent "query" "agent_id" ["limit"]
fabric_graph_search_agent() {
    local query="$1"
    local agent_id="$2"
    local limit="${3:-$FABRIC_MAX_RESULTS}"

    jq -n \
        --arg query "$query $agent_id" \
        --argjson limit "$limit" \
        '{
            query: $query,
            tool: "mcp__memory__search_nodes",
            limit: $limit
        }'
}

# Normalize graph result to unified format
fabric_normalize_graph_result() {
    local result_json="$1"

    echo "$result_json" | jq '
        {
            id: ("graph:" + (.name // "unknown")),
            text: ((.observations // []) | join(". ")),
            source: "graph",
            timestamp: null,
            relevance: 1.0,
            entities: [.name] + ((.relations // []) | map(.to)),
            metadata: {
                entityType: (.entityType // "unknown"),
                relations: (.relations // [])
            }
        }
    '
}

# -----------------------------------------------------------------------------
# Entity Extraction Functions
# -----------------------------------------------------------------------------

fabric_extract_entities() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local entities='[]'
    local relations='[]'

    for agent in "${FABRIC_KNOWN_AGENTS[@]}"; do
        if [[ "$text_lower" == *"$agent"* ]]; then
            entities=$(echo "$entities" | jq --arg name "$agent" --arg type "agent" \
                '. += [{"name": $name, "entityType": $type}]')
        fi
    done

    for tech in "${FABRIC_KNOWN_TECHNOLOGIES[@]}"; do
        if [[ "$text_lower" == *"$tech"* ]]; then
            entities=$(echo "$entities" | jq --arg name "$tech" --arg type "technology" \
                '. += [{"name": $name, "entityType": $type}]')
        fi
    done

    # Extract relations via simple patterns
    if [[ "$text_lower" =~ ([a-z-]+)[[:space:]]+uses[[:space:]]+([a-z0-9-]+) ]]; then
        relations=$(echo "$relations" | jq \
            --arg from "${BASH_REMATCH[1]}" --arg to "${BASH_REMATCH[2]}" --arg rel "uses" \
            '. += [{"from": $from, "to": $to, "relationType": $rel}]')
    fi
    if [[ "$text_lower" =~ ([a-z-]+)[[:space:]]+recommends[[:space:]]+([a-z0-9-]+) ]]; then
        relations=$(echo "$relations" | jq \
            --arg from "${BASH_REMATCH[1]}" --arg to "${BASH_REMATCH[2]}" --arg rel "recommends" \
            '. += [{"from": $from, "to": $to, "relationType": $rel}]')
    fi
    if [[ "$text_lower" =~ ([a-z-]+)[[:space:]]+requires[[:space:]]+([a-z0-9-]+) ]]; then
        relations=$(echo "$relations" | jq \
            --arg from "${BASH_REMATCH[1]}" --arg to "${BASH_REMATCH[2]}" --arg rel "requires" \
            '. += [{"from": $from, "to": $to, "relationType": $rel}]')
    fi

    jq -n --argjson entities "$entities" --argjson relations "$relations" \
        '{ entities: $entities, relations: $relations }'
}

fabric_build_graph_entities() {
    local extracted="$1"
    local observation="$2"

    echo "$extracted" | jq --arg obs "$observation" '
        {
            entities: [
                .entities[] | {
                    name: .name,
                    entityType: .entityType,
                    observations: [$obs]
                }
            ]
        }
    '
}

fabric_build_graph_relations() {
    local extracted="$1"
    echo "$extracted" | jq '{ relations: .relations }'
}

# -----------------------------------------------------------------------------
# Scoring Functions
# -----------------------------------------------------------------------------

fabric_calculate_score() {
    local result="$1"

    local relevance timestamp
    relevance=$(echo "$result" | jq -r '.relevance // 0.5')
    timestamp=$(echo "$result" | jq -r '.timestamp // null')

    local recency="1.0"
    if [[ "$timestamp" != "null" && -n "$timestamp" ]]; then
        local timestamp_epoch now_epoch age_days
        timestamp_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${timestamp%Z}" "+%s" 2>/dev/null || \
                         date -d "$timestamp" "+%s" 2>/dev/null || \
                         echo "0")
        now_epoch=$(date "+%s")

        if [[ "$timestamp_epoch" -gt 0 ]]; then
            age_days=$(( (now_epoch - timestamp_epoch) / 86400 ))
            recency=$(awk -v a="$age_days" 'BEGIN { printf "%.2f", 1.0 - (a / 30) }')
            if awk -v r="$recency" 'BEGIN { exit !(r < 0.1) }'; then
                recency="0.1"
            fi
        fi
    fi

    awk -v rec="$recency" -v rel="$relevance" \
        -v wr="$FABRIC_WEIGHT_RECENCY" -v wrel="$FABRIC_WEIGHT_RELEVANCE" -v wa="$FABRIC_WEIGHT_AUTHORITY" \
        'BEGIN { printf "%.3f", (rec * wr) + (rel * wrel) + (1.0 * wa) }'
}

# -----------------------------------------------------------------------------
# Convenience Functions
# -----------------------------------------------------------------------------

fabric_quick_search() {
    local query="$1"
    fabric_graph_search "$query" "$FABRIC_MAX_RESULTS"
}

fabric_usage_hint() {
    local project_id
    project_id=$(basename "${CLAUDE_PROJECT_DIR:-.}")

    cat <<EOF
Memory Fabric v3.0 (Graph-Only) ready for ${project_id}:

Available (always, zero-config):
- mcp__memory__search_nodes: Search knowledge graph
- mcp__memory__create_entities: Store entities
- mcp__memory__create_relations: Store relationships
- mcp__memory__add_observations: Add observations to entities

Persistence:
- CC Native MEMORY.md: High-confidence decisions auto-persisted

Functions:
1. Graph Search:
   - fabric_graph_search "query" limit
2. Agent-scoped Search:
   - fabric_graph_search_agent "query" "agent-id" limit
3. Entity Extraction:
   - fabric_extract_entities "text to analyze"
EOF
}

# -----------------------------------------------------------------------------
# Exports
# -----------------------------------------------------------------------------

export -f is_graph_available
export -f is_memory_available
export -f fabric_get_project_context
export -f fabric_graph_search
export -f fabric_graph_search_agent
export -f fabric_normalize_graph_result
export -f fabric_extract_entities
export -f fabric_build_graph_entities
export -f fabric_build_graph_relations
export -f fabric_calculate_score
export -f fabric_quick_search
export -f fabric_usage_hint

export FABRIC_MAX_RESULTS
export FABRIC_WEIGHT_RECENCY
export FABRIC_WEIGHT_RELEVANCE
export FABRIC_WEIGHT_AUTHORITY
