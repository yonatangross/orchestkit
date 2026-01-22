#!/bin/bash
# Memory Fabric Orchestration Library for OrchestKit Plugin
# Graph-First Architecture: mcp__memory (local graph) as PRIMARY,
# mem0 (semantic cloud) as OPTIONAL enhancement
#
# Version: 2.1.0
# Part of Memory Fabric v2.1 - Graph-First Architecture
#
# Usage: source "${CLAUDE_PLUGIN_ROOT}/hooks/_lib/memory-fabric.sh"
#
# Architecture (v2.1 Graph-First):
# - PRIMARY: mcp__memory__* (local knowledge graph) - FREE, zero-config, always works
# - OPTIONAL: mcp__mem0__* (cloud semantic search) - requires MEM0_API_KEY
#
# Key Design Principles:
# - Graph-first: Knowledge graph is PRIMARY storage (always available)
# - Optional cloud: mem0 enhances but is not required
# - Result merging: Deduplicates with >85% similarity threshold
# - Graph priority: In merge, graph results take precedence
# - Project-agnostic: Works in any repository where the plugin is installed
# - MCP-compatible: Outputs JSON suitable for MCP tool calls

set -euo pipefail

# Source mem0 library for shared functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/mem0.sh" ]]; then
    source "${SCRIPT_DIR}/mem0.sh"
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Deduplication threshold (0.0-1.0, results with similarity above this merge)
[[ -z "${FABRIC_DEDUP_THRESHOLD:-}" ]] && readonly FABRIC_DEDUP_THRESHOLD="0.85"

# Cross-reference boost factor (multiplier for results found in both systems)
[[ -z "${FABRIC_BOOST_FACTOR:-}" ]] && readonly FABRIC_BOOST_FACTOR="1.2"

# Maximum results per source before merging
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
    "pgvector"
    "postgresql"
    "fastapi"
    "sqlalchemy"
    "react"
    "typescript"
    "langgraph"
    "redis"
    "celery"
    "docker"
    "kubernetes"
    "python"
    "javascript"
    "nextjs"
    "vite"
    "prisma"
    "drizzle"
    "zod"
    "pydantic"
    "alembic"
    "pytest"
    "vitest"
    "playwright"
    "langchain"
    "openai"
    "anthropic"
    "mem0"
    "langfuse"
)

# -----------------------------------------------------------------------------
# Availability Check Functions (v2.1 Graph-First)
# -----------------------------------------------------------------------------

# Check if knowledge graph is available (always true - graph is built-in)
# Usage: is_graph_available
# Returns: 0 (always - graph requires no configuration)
is_graph_available() {
    return 0
}

# Check if memory is available (alias for is_graph_available)
# Usage: is_memory_available
# Returns: 0 (always - graph is always available)
is_memory_available() {
    return 0
}

# Check if enhanced memory (mem0) is available
# Usage: is_enhanced_available
# Returns: 0 if mem0 is configured, 1 otherwise
is_enhanced_available() {
    # Delegate to mem0.sh if available
    if type is_mem0_available &>/dev/null; then
        is_mem0_available
        return $?
    fi
    # Fallback: check for API key
    [[ -n "${MEM0_API_KEY:-}" ]]
}

# -----------------------------------------------------------------------------
# Project Context Functions
# -----------------------------------------------------------------------------

# Get project-aware user IDs for both memory systems
# Usage: fabric_get_project_context
# Output: JSON with user_ids for different scopes
fabric_get_project_context() {
    local project_id
    project_id=$(mem0_get_project_id 2>/dev/null || echo "default-project")

    jq -n \
        --arg project_id "$project_id" \
        --arg decisions "${project_id}-decisions" \
        --arg patterns "${project_id}-patterns" \
        --arg continuity "${project_id}-continuity" \
        --arg agents "${project_id}-agents" \
        --arg best_practices "${project_id}-best-practices" \
        --arg global_prefix "orchestkit-global" \
        '{
            project_id: $project_id,
            user_ids: {
                decisions: $decisions,
                patterns: $patterns,
                continuity: $continuity,
                agents: $agents,
                best_practices: $best_practices
            },
            global: {
                best_practices: ($global_prefix + "-best-practices"),
                patterns: ($global_prefix + "-patterns")
            }
        }'
}

# -----------------------------------------------------------------------------
# Unified Search Functions
# -----------------------------------------------------------------------------

# Build JSON for unified search across both memory systems
# Usage: fabric_unified_search "query" ["scope"] ["limit"]
# Output: JSON with queries for both mem0 and graph search
fabric_unified_search() {
    local query="$1"
    local scope="${2:-decisions}"
    local limit="${3:-$FABRIC_MAX_RESULTS}"

    local project_id
    project_id=$(mem0_get_project_id 2>/dev/null || echo "default-project")

    local user_id="${project_id}-${scope}"

    # Build mem0 search query
    local mem0_query
    mem0_query=$(jq -n \
        --arg query "$query" \
        --arg user_id "$user_id" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: {
                AND: [
                    { user_id: $user_id }
                ]
            },
            limit: $limit,
            enable_graph: true
        }')

    # Build graph search query (simpler - just the query text)
    local graph_query
    graph_query=$(jq -n \
        --arg query "$query" \
        '{
            query: $query
        }')

    # Combine into unified search structure
    jq -n \
        --arg original_query "$query" \
        --arg scope "$scope" \
        --argjson mem0_search "$mem0_query" \
        --argjson graph_search "$graph_query" \
        --argjson limit "$limit" \
        '{
            original_query: $original_query,
            scope: $scope,
            limit: $limit,
            mem0: {
                tool: "mcp__mem0__search_memories",
                args: $mem0_search
            },
            graph: {
                tool: "mcp__memory__search_nodes",
                args: $graph_search
            }
        }'
}

# Build unified search with agent filter
# Usage: fabric_unified_search_agent "query" "agent_id" ["limit"]
# Output: JSON with queries filtered by agent
fabric_unified_search_agent() {
    local query="$1"
    local agent_id="$2"
    local limit="${3:-$FABRIC_MAX_RESULTS}"

    local project_id
    project_id=$(mem0_get_project_id 2>/dev/null || echo "default-project")

    local user_id="${project_id}-agents"
    local formatted_agent_id="ork:${agent_id#ork:}"

    # Build mem0 search with agent filter
    local mem0_query
    mem0_query=$(jq -n \
        --arg query "$query" \
        --arg user_id "$user_id" \
        --arg agent_id "$formatted_agent_id" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: {
                AND: [
                    { user_id: $user_id },
                    { agent_id: $agent_id }
                ]
            },
            limit: $limit,
            enable_graph: true
        }')

    # Graph search includes agent name in query
    local graph_query
    graph_query=$(jq -n \
        --arg query "$query $agent_id" \
        '{
            query: $query
        }')

    jq -n \
        --arg original_query "$query" \
        --arg agent_id "$agent_id" \
        --argjson mem0_search "$mem0_query" \
        --argjson graph_search "$graph_query" \
        --argjson limit "$limit" \
        '{
            original_query: $original_query,
            agent_id: $agent_id,
            limit: $limit,
            mem0: {
                tool: "mcp__mem0__search_memories",
                args: $mem0_search
            },
            graph: {
                tool: "mcp__memory__search_nodes",
                args: $graph_search
            }
        }'
}

# -----------------------------------------------------------------------------
# Result Merging Functions
# -----------------------------------------------------------------------------

# Normalize mem0 result to unified format
# Usage: fabric_normalize_mem0_result "mem0_result_json"
# Output: Normalized result JSON
fabric_normalize_mem0_result() {
    local result_json="$1"

    echo "$result_json" | jq '
        {
            id: ("mem0:" + (.id // .memory_id // "unknown")),
            text: (.memory // .text // ""),
            source: "mem0",
            timestamp: (.created_at // .metadata.stored_at // null),
            relevance: ((.score // 100) / 100),
            entities: [],
            metadata: (.metadata // {}),
            cross_validated: false
        }
    '
}

# Normalize graph result to unified format
# Usage: fabric_normalize_graph_result "graph_result_json"
# Output: Normalized result JSON
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
            },
            cross_validated: false
        }
    '
}

# Merge two results when similarity > threshold
# Usage: fabric_merge_results "result_a_json" "result_b_json"
# Output: Merged result JSON (graph-first: graph results take priority)
fabric_merge_results() {
    local result_a="$1"
    local result_b="$2"

    # Graph-First: Determine source types
    local source_a source_b
    source_a=$(echo "$result_a" | jq -r '.source // "unknown"')
    source_b=$(echo "$result_b" | jq -r '.source // "unknown"')

    local primary secondary

    # Graph-First Priority: graph > mem0 > other
    if [[ "$source_a" == "graph" ]]; then
        primary="$result_a"
        secondary="$result_b"
    elif [[ "$source_b" == "graph" ]]; then
        primary="$result_b"
        secondary="$result_a"
    else
        # Neither is graph - fall back to relevance
        local relevance_a relevance_b
        relevance_a=$(echo "$result_a" | jq -r '.relevance // 0')
        relevance_b=$(echo "$result_b" | jq -r '.relevance // 0')

        if (( $(echo "$relevance_a >= $relevance_b" | bc -l) )); then
            primary="$result_a"
            secondary="$result_b"
        else
            primary="$result_b"
            secondary="$result_a"
        fi
    fi

    # Merge: keep primary (graph) text, combine entities, merge metadata
    jq -n \
        --argjson primary "$primary" \
        --argjson secondary "$secondary" \
        '{
            id: ($primary.id + "+merged"),
            text: $primary.text,
            source: "merged",
            primary_source: $primary.source,
            timestamp: ($primary.timestamp // $secondary.timestamp),
            relevance: ([$primary.relevance, $secondary.relevance] | max),
            entities: (($primary.entities + $secondary.entities) | unique),
            metadata: {
                source_primary: $primary.source,
                source_secondary: $secondary.source,
                primary_metadata: $primary.metadata,
                secondary_metadata: $secondary.metadata
            },
            cross_validated: true
        }'
}

# Calculate text similarity (Jaccard-like for bash)
# Usage: fabric_text_similarity "text_a" "text_b"
# Output: Similarity score 0.0-1.0
fabric_text_similarity() {
    local text_a="$1"
    local text_b="$2"

    # Normalize: lowercase, extract words
    local words_a words_b
    words_a=$(echo "$text_a" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '\n' | sort -u)
    words_b=$(echo "$text_b" | tr '[:upper:]' '[:lower:]' | tr -cs '[:alnum:]' '\n' | sort -u)

    # Count unique words in each
    local count_a count_b count_common count_union
    count_a=$(echo "$words_a" | wc -l | tr -d ' ')
    count_b=$(echo "$words_b" | wc -l | tr -d ' ')

    # Find common words
    count_common=$(comm -12 <(echo "$words_a") <(echo "$words_b") | wc -l | tr -d ' ')

    # Union = a + b - common
    count_union=$((count_a + count_b - count_common))

    if [[ "$count_union" -eq 0 ]]; then
        echo "0.0"
        return
    fi

    # Calculate Jaccard similarity
    echo "scale=2; $count_common / $count_union" | bc
}

# -----------------------------------------------------------------------------
# Entity Extraction Functions
# -----------------------------------------------------------------------------

# Extract entities from natural language text
# Usage: fabric_extract_entities "text"
# Output: JSON with entities and relations arrays
fabric_extract_entities() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local entities='[]'
    local relations='[]'

    # Extract agents
    for agent in "${FABRIC_KNOWN_AGENTS[@]}"; do
        if [[ "$text_lower" == *"$agent"* ]]; then
            entities=$(echo "$entities" | jq --arg name "$agent" --arg type "agent" \
                '. += [{"name": $name, "entityType": $type}]')
        fi
    done

    # Extract technologies
    for tech in "${FABRIC_KNOWN_TECHNOLOGIES[@]}"; do
        if [[ "$text_lower" == *"$tech"* ]]; then
            entities=$(echo "$entities" | jq --arg name "$tech" --arg type "technology" \
                '. += [{"name": $name, "entityType": $type}]')
        fi
    done

    # Extract relations via simple patterns
    # Pattern: "X uses Y"
    if [[ "$text_lower" =~ ([a-z-]+)[[:space:]]+uses[[:space:]]+([a-z0-9-]+) ]]; then
        local from="${BASH_REMATCH[1]}"
        local to="${BASH_REMATCH[2]}"
        relations=$(echo "$relations" | jq \
            --arg from "$from" --arg to "$to" --arg rel "uses" \
            '. += [{"from": $from, "to": $to, "relationType": $rel}]')
    fi

    # Pattern: "X recommends Y"
    if [[ "$text_lower" =~ ([a-z-]+)[[:space:]]+recommends[[:space:]]+([a-z0-9-]+) ]]; then
        local from="${BASH_REMATCH[1]}"
        local to="${BASH_REMATCH[2]}"
        relations=$(echo "$relations" | jq \
            --arg from "$from" --arg to "$to" --arg rel "recommends" \
            '. += [{"from": $from, "to": $to, "relationType": $rel}]')
    fi

    # Pattern: "X requires Y"
    if [[ "$text_lower" =~ ([a-z-]+)[[:space:]]+requires[[:space:]]+([a-z0-9-]+) ]]; then
        local from="${BASH_REMATCH[1]}"
        local to="${BASH_REMATCH[2]}"
        relations=$(echo "$relations" | jq \
            --arg from "$from" --arg to "$to" --arg rel "requires" \
            '. += [{"from": $from, "to": $to, "relationType": $rel}]')
    fi

    # Pattern: "X for Y" / "X used for Y"
    if [[ "$text_lower" =~ ([a-z0-9-]+)[[:space:]]+(used[[:space:]]+)?for[[:space:]]+([a-z0-9-]+) ]]; then
        local from="${BASH_REMATCH[1]}"
        local to="${BASH_REMATCH[3]}"
        relations=$(echo "$relations" | jq \
            --arg from "$from" --arg to "$to" --arg rel "used_for" \
            '. += [{"from": $from, "to": $to, "relationType": $rel}]')
    fi

    # Output combined result
    jq -n \
        --argjson entities "$entities" \
        --argjson relations "$relations" \
        '{
            entities: $entities,
            relations: $relations
        }'
}

# Build graph entity creation JSON from extracted entities
# Usage: fabric_build_graph_entities "extracted_json" "observation_text"
# Output: JSON for mcp__memory__create_entities
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

# Build graph relation creation JSON from extracted relations
# Usage: fabric_build_graph_relations "extracted_json"
# Output: JSON for mcp__memory__create_relations
fabric_build_graph_relations() {
    local extracted="$1"

    echo "$extracted" | jq '
        {
            relations: .relations
        }
    '
}

# -----------------------------------------------------------------------------
# Cross-Reference Boosting Functions
# -----------------------------------------------------------------------------

# Check if a mem0 result mentions any graph entities
# Usage: fabric_check_cross_reference "mem0_result_json" "graph_entities_json"
# Output: JSON with boost info if cross-referenced
fabric_check_cross_reference() {
    local mem0_result="$1"
    local graph_entities="$2"

    local mem0_text
    mem0_text=$(echo "$mem0_result" | jq -r '.text // "" | ascii_downcase')

    local found_entities='[]'

    # Check each graph entity
    while IFS= read -r entity_name; do
        if [[ -n "$entity_name" && "$mem0_text" == *"$entity_name"* ]]; then
            found_entities=$(echo "$found_entities" | jq --arg name "$entity_name" '. += [$name]')
        fi
    done < <(echo "$graph_entities" | jq -r '.[] | .name // empty' 2>/dev/null)

    local found_count
    found_count=$(echo "$found_entities" | jq 'length')

    if [[ "$found_count" -gt 0 ]]; then
        jq -n \
            --argjson found "$found_entities" \
            --argjson boost "$FABRIC_BOOST_FACTOR" \
            '{
                cross_referenced: true,
                found_entities: $found,
                boost_factor: $boost
            }'
    else
        jq -n '{ cross_referenced: false }'
    fi
}

# Apply cross-reference boost to a result
# Usage: fabric_apply_boost "result_json" "boost_info_json"
# Output: Boosted result JSON
fabric_apply_boost() {
    local result="$1"
    local boost_info="$2"

    local is_cross_ref
    is_cross_ref=$(echo "$boost_info" | jq -r '.cross_referenced // false')

    if [[ "$is_cross_ref" == "true" ]]; then
        local boost_factor
        boost_factor=$(echo "$boost_info" | jq -r '.boost_factor // 1.0')

        echo "$result" | jq --argjson boost "$boost_factor" --argjson info "$boost_info" '
            .relevance = (.relevance * $boost) |
            .cross_validated = true |
            .cross_reference_info = $info
        '
    else
        echo "$result"
    fi
}

# -----------------------------------------------------------------------------
# Scoring Functions
# -----------------------------------------------------------------------------

# Calculate final score for a result
# Usage: fabric_calculate_score "result_json"
# Output: Score as decimal
fabric_calculate_score() {
    local result="$1"

    local relevance timestamp cross_validated
    relevance=$(echo "$result" | jq -r '.relevance // 0.5')
    timestamp=$(echo "$result" | jq -r '.timestamp // null')
    cross_validated=$(echo "$result" | jq -r '.cross_validated // false')

    # Calculate recency factor (decay over 30 days)
    local recency="1.0"
    if [[ "$timestamp" != "null" && -n "$timestamp" ]]; then
        local timestamp_epoch now_epoch age_days
        timestamp_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${timestamp%Z}" "+%s" 2>/dev/null || \
                         date -d "$timestamp" "+%s" 2>/dev/null || \
                         echo "0")
        now_epoch=$(date "+%s")

        if [[ "$timestamp_epoch" -gt 0 ]]; then
            age_days=$(( (now_epoch - timestamp_epoch) / 86400 ))
            recency=$(echo "scale=2; 1.0 - ($age_days / 30)" | bc)
            # Ensure minimum of 0.1
            if (( $(echo "$recency < 0.1" | bc -l) )); then
                recency="0.1"
            fi
        fi
    fi

    # Calculate authority factor
    local authority="1.0"
    if [[ "$cross_validated" == "true" ]]; then
        authority="1.3"
    fi

    # Final score = recency * weight + relevance * weight + authority * weight
    local score
    score=$(echo "scale=3; ($recency * $FABRIC_WEIGHT_RECENCY) + ($relevance * $FABRIC_WEIGHT_RELEVANCE) + ($authority * $FABRIC_WEIGHT_AUTHORITY)" | bc)

    echo "$score"
}

# -----------------------------------------------------------------------------
# Convenience Functions
# -----------------------------------------------------------------------------

# Build a complete unified search with common defaults
# Usage: fabric_quick_search "query"
# Output: Full search structure for Claude to execute
fabric_quick_search() {
    local query="$1"

    fabric_unified_search "$query" "decisions" "$FABRIC_MAX_RESULTS"
}

# Generate hint text for Claude about available fabric operations
# Usage: fabric_usage_hint
# Output: Human-readable hint text
fabric_usage_hint() {
    local project_context
    project_context=$(fabric_get_project_context)

    local project_id
    project_id=$(echo "$project_context" | jq -r '.project_id')

    local enhanced_msg=""
    if is_enhanced_available; then
        enhanced_msg=" + mem0 cloud enabled"
    fi

    cat <<EOF
Memory Fabric v2.1 (Graph-First) ready for ${project_id}${enhanced_msg}:

PRIMARY (always available):
- mcp__memory__search_nodes: Search knowledge graph
- mcp__memory__create_entities: Store entities
- mcp__memory__create_relations: Store relationships

OPTIONAL (if --mem0 flag and API key configured):
- mcp__mem0__search_memories: Cloud semantic search
- mcp__mem0__add_memory: Cloud storage

Functions:
1. Graph-First Search:
   - fabric_unified_search "query" "scope" limit
   - Scopes: decisions, patterns, continuity, agents, best-practices

2. Agent-scoped Search:
   - fabric_unified_search_agent "query" "agent-id" limit

3. Entity Extraction:
   - fabric_extract_entities "text to analyze"

4. Result Merging (graph takes priority):
   - Results with >85% similarity are merged
   - Graph results are PRIMARY in merge
   - Cross-referenced results get 1.2x boost

Graph search first, mem0 enhances if available.
EOF
}

# -----------------------------------------------------------------------------
# Export Functions
# -----------------------------------------------------------------------------

# Availability functions (v2.1)
export -f is_graph_available
export -f is_memory_available
export -f is_enhanced_available

export -f fabric_get_project_context
export -f fabric_unified_search
export -f fabric_unified_search_agent
export -f fabric_normalize_mem0_result
export -f fabric_normalize_graph_result
export -f fabric_merge_results
export -f fabric_text_similarity
export -f fabric_extract_entities
export -f fabric_build_graph_entities
export -f fabric_build_graph_relations
export -f fabric_check_cross_reference
export -f fabric_apply_boost
export -f fabric_calculate_score
export -f fabric_quick_search
export -f fabric_usage_hint

# Export configuration
export FABRIC_DEDUP_THRESHOLD
export FABRIC_BOOST_FACTOR
export FABRIC_MAX_RESULTS
export FABRIC_WEIGHT_RECENCY
export FABRIC_WEIGHT_RELEVANCE
export FABRIC_WEIGHT_AUTHORITY

# -----------------------------------------------------------------------------
# Cross-Project Learning Pattern Storage (Memory Fabric v2.1)
# -----------------------------------------------------------------------------

# Queue a learned pattern for mem0 storage during session-end sync
# This enables cross-project learning by storing patterns with metadata
# that can be retrieved from any project.
#
# Usage: store_learned_pattern "category" "pattern_text" ["outcome"] ["lesson"]
# Categories: code_style, naming_convention, workflow, architecture, etc.
# Outcomes: success, failed, neutral (default: neutral)
#
# Example:
#   store_learned_pattern "code_style" "Python uses 4-space indentation" "success"
#   store_learned_pattern "naming_convention" "Functions use snake_case" "success"
#   store_learned_pattern "workflow" "TDD workflow detected" "neutral"
#
store_learned_pattern() {
    local category="$1"
    local pattern_text="$2"
    local outcome="${3:-neutral}"
    local lesson="${4:-}"

    # Validate inputs
    if [[ -z "$category" || -z "$pattern_text" ]]; then
        return 1
    fi

    # Get project and timestamp
    local project_id
    project_id=$(mem0_get_project_id 2>/dev/null || echo "unknown")

    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Patterns queue file
    local patterns_queue="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/patterns-queue.json"

    # Ensure directory exists
    mkdir -p "$(dirname "$patterns_queue")" 2>/dev/null || true

    # Initialize queue if missing
    if [[ ! -f "$patterns_queue" ]]; then
        echo '{"patterns": []}' > "$patterns_queue"
    fi

    # Build the pattern entry
    local pattern_entry
    if [[ -n "$lesson" ]]; then
        pattern_entry=$(jq -n \
            --arg category "$category" \
            --arg text "$pattern_text" \
            --arg outcome "$outcome" \
            --arg project "$project_id" \
            --arg timestamp "$timestamp" \
            --arg lesson "$lesson" \
            '{
                category: $category,
                text: $text,
                outcome: $outcome,
                project: $project,
                timestamp: $timestamp,
                lesson: $lesson,
                source: "memory-fabric-v2.1"
            }')
    else
        pattern_entry=$(jq -n \
            --arg category "$category" \
            --arg text "$pattern_text" \
            --arg outcome "$outcome" \
            --arg project "$project_id" \
            --arg timestamp "$timestamp" \
            '{
                category: $category,
                text: $text,
                outcome: $outcome,
                project: $project,
                timestamp: $timestamp,
                source: "memory-fabric-v2.1"
            }')
    fi

    # Add to queue atomically
    local tmp_file
    tmp_file=$(mktemp)

    if jq --argjson entry "$pattern_entry" '.patterns += [$entry]' "$patterns_queue" > "$tmp_file" 2>/dev/null; then
        mv "$tmp_file" "$patterns_queue"
        return 0
    else
        rm -f "$tmp_file" 2>/dev/null || true
        return 1
    fi
}

# Export cross-project learning function
export -f store_learned_pattern
