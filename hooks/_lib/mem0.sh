#!/bin/bash
# Memory Operations Library for SkillForge Plugin
# Provides helper functions for both Knowledge Graph (primary) and Mem0 (optional)
#
# Graph-First Architecture (v2.1):
# - Knowledge graph (mcp__memory__*) is ALWAYS available - zero config
# - Mem0 (mcp__mem0__*) is an optional enhancement for semantic search
# - Use is_graph_available() for primary check (always true)
# - Use is_enhanced_available() to check if mem0 is configured
#
# Version: 2.1.0 - Graph-First Architecture
# Part of Memory Fabric v2.1 - Graph-First Architecture
#
# Usage: source "${CLAUDE_PLUGIN_ROOT}/hooks/_lib/mem0.sh"
#
# Key Design Principles:
# - Graph-first: Knowledge graph is always available, mem0 is optional
# - Project-agnostic: Works in any repository where the plugin is installed
# - Graceful degradation: Works even if project has no .claude/context structure
# - Scoped memory: Uses {project-name}-{scope} format for user_id
# - MCP-compatible: Outputs JSON suitable for mcp__memory__* and mcp__mem0__* tool calls
# - Agent-aware: Supports agent_id for agent-scoped memories
# - Cross-agent: Federation support for multi-agent knowledge sharing

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Memory scopes for organizing different types of context
[[ -z "${MEM0_SCOPE_DECISIONS:-}" ]] && readonly MEM0_SCOPE_DECISIONS="decisions"    # Architecture/design decisions
[[ -z "${MEM0_SCOPE_PATTERNS:-}" ]] && readonly MEM0_SCOPE_PATTERNS="patterns"      # Code patterns and conventions
[[ -z "${MEM0_SCOPE_CONTINUITY:-}" ]] && readonly MEM0_SCOPE_CONTINUITY="continuity"  # Session continuity/handoff
[[ -z "${MEM0_SCOPE_AGENTS:-}" ]] && readonly MEM0_SCOPE_AGENTS="agents"          # Agent-specific context
[[ -z "${MEM0_SCOPE_BEST_PRACTICES:-}" ]] && readonly MEM0_SCOPE_BEST_PRACTICES="best-practices"  # Success/failure patterns (#49)

# Global scope prefix for cross-project memories
[[ -z "${MEM0_GLOBAL_PREFIX:-}" ]] && readonly MEM0_GLOBAL_PREFIX="skillforge-global"

# Valid scopes array for validation
[[ -z "${MEM0_VALID_SCOPES:-}" ]] && readonly MEM0_VALID_SCOPES=("$MEM0_SCOPE_DECISIONS" "$MEM0_SCOPE_PATTERNS" "$MEM0_SCOPE_CONTINUITY" "$MEM0_SCOPE_AGENTS" "$MEM0_SCOPE_BEST_PRACTICES")

# Graph memory default (v1.2.0 - enabled by default for relationship extraction)
# Override with MEM0_ENABLE_GRAPH_DEFAULT=false if needed
[[ -z "${MEM0_ENABLE_GRAPH_DEFAULT:-}" ]] && readonly MEM0_ENABLE_GRAPH_DEFAULT="true"

# -----------------------------------------------------------------------------
# Project Identification Functions
# -----------------------------------------------------------------------------

# Get sanitized project name from CLAUDE_PROJECT_DIR
# Output: lowercase project name with special chars replaced by dashes
# Example: /Users/john/My Project 123 -> my-project-123
mem0_get_project_id() {
    local project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
    local project_name

    # Extract folder name from path
    project_name=$(basename "$project_dir")

    # Sanitize: lowercase, replace spaces and special chars with dashes
    # Remove leading/trailing dashes, collapse multiple dashes
    project_name=$(echo "$project_name" | \
        tr '[:upper:]' '[:lower:]' | \
        tr ' ' '-' | \
        tr -c '[:alnum:]-' '-' | \
        sed -e 's/^-*//' -e 's/-*$//' -e 's/--*/-/g')

    # Fallback if empty after sanitization
    if [[ -z "$project_name" ]]; then
        project_name="default-project"
    fi

    echo "$project_name"
}

# Generate scoped user_id for Mem0
# Usage: mem0_user_id "decisions"
# Output: myproject-decisions
mem0_user_id() {
    local scope="${1:-continuity}"
    local project_id
    project_id=$(mem0_get_project_id)

    # Define valid scopes inline to avoid readonly array export issues
    local valid_scopes=("decisions" "patterns" "continuity" "agents" "best-practices")
    local valid=false
    for valid_scope in "${valid_scopes[@]}"; do
        if [[ "$scope" == "$valid_scope" ]]; then
            valid=true
            break
        fi
    done

    if [[ "$valid" != "true" ]]; then
        echo "Warning: Invalid scope '$scope', using 'continuity'" >&2
        scope="continuity"
    fi

    echo "${project_id}-${scope}"
}

# Generate global user_id for cross-project memories
# Usage: mem0_global_user_id "best-practices"
# Output: skillforge-global-best-practices
mem0_global_user_id() {
    local scope="${1:-best-practices}"
    echo "${MEM0_GLOBAL_PREFIX}-${scope}"
}

# Format agent_id with skf: prefix
# Usage: mem0_format_agent_id "database-engineer"
# Output: skf:database-engineer
mem0_format_agent_id() {
    local agent_id="$1"
    # Remove skf: prefix if already present, then add it
    agent_id="${agent_id#skf:}"
    echo "skf:${agent_id}"
}

# -----------------------------------------------------------------------------
# Context Directory Detection
# -----------------------------------------------------------------------------

# Check if project has .claude/context/ structure
# Returns 0 (true) if exists, 1 (false) if not
has_context_dir() {
    local project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
    local context_dir="$project_dir/.claude/context"

    [[ -d "$context_dir" ]]
}

# Get context directory path (or empty if doesn't exist)
get_context_dir() {
    local project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
    local context_dir="$project_dir/.claude/context"

    if [[ -d "$context_dir" ]]; then
        echo "$context_dir"
    fi
}

# -----------------------------------------------------------------------------
# Session State Extraction Functions
# -----------------------------------------------------------------------------

# Extract decisions from session state (if exists)
# Output: JSON array of recent decisions, or empty array
extract_session_decisions() {
    local context_dir
    context_dir=$(get_context_dir)

    # Check multiple possible locations for decisions
    local decisions_file=""

    if [[ -n "$context_dir" ]]; then
        if [[ -f "$context_dir/knowledge/decisions/active.json" ]]; then
            decisions_file="$context_dir/knowledge/decisions/active.json"
        elif [[ -f "$context_dir/session/state.json" ]]; then
            # Fallback: check session state for embedded decisions
            local state_file="$context_dir/session/state.json"
            if [[ -f "$state_file" ]]; then
                local decisions
                decisions=$(jq -r '.decisions // empty' "$state_file" 2>/dev/null)
                if [[ -n "$decisions" && "$decisions" != "null" ]]; then
                    echo "$decisions"
                    return 0
                fi
            fi
        fi
    fi

    # Extract decisions from active.json
    if [[ -n "$decisions_file" && -f "$decisions_file" ]]; then
        # Get recent decisions (last 5, implemented or in-progress)
        jq '[.decisions // [] | .[] | select(.status == "implemented" or .status == "in-progress") | {
            id: .id,
            date: .date,
            summary: .summary,
            status: .status,
            impact: .impact
        }] | .[-5:]' "$decisions_file" 2>/dev/null || echo '[]'
    else
        echo '[]'
    fi
}

# Extract current task from session state (if exists)
# Output: JSON object with task info, or null
extract_current_task() {
    local context_dir
    context_dir=$(get_context_dir)

    if [[ -z "$context_dir" ]]; then
        echo 'null'
        return 0
    fi

    local state_file="$context_dir/session/state.json"

    if [[ ! -f "$state_file" ]]; then
        echo 'null'
        return 0
    fi

    # Extract current task and related fields
    jq '{
        current_task: .current_task,
        active_agent: .active_agent,
        next_steps: (.next_steps // [])[:3],
        blockers: (.blockers // [])[:3]
    } | if .current_task == null and .active_agent == null then null else . end' "$state_file" 2>/dev/null || echo 'null'
}

# Extract recent tasks completed from session state
# Output: JSON array of recent completed tasks
extract_recent_tasks() {
    local limit="${1:-5}"
    local context_dir
    context_dir=$(get_context_dir)

    if [[ -z "$context_dir" ]]; then
        echo '[]'
        return 0
    fi

    local state_file="$context_dir/session/state.json"

    if [[ ! -f "$state_file" ]]; then
        echo '[]'
        return 0
    fi

    jq --argjson limit "$limit" '[.tasks_completed // [] | .[-$limit:] | .[] | {
        agent: .agent,
        timestamp: .timestamp,
        summary: (.summary | if length > 100 then .[:100] + "..." else . end)
    }]' "$state_file" 2>/dev/null || echo '[]'
}

# -----------------------------------------------------------------------------
# Mem0 MCP Tool JSON Generators (Enhanced with graph/agent support)
# -----------------------------------------------------------------------------

# Output JSON for MCP tool call to add memory
# Usage: mem0_add_memory_json "scope" "content" ["metadata_json"] ["enable_graph"] ["agent_id"] ["global"]
# Output: JSON suitable for mcp__mem0__add_memory arguments
# Note: enable_graph defaults to MEM0_ENABLE_GRAPH_DEFAULT (true in v1.2.0)
mem0_add_memory_json() {
    local scope="$1"
    local content="$2"
    local metadata="${3:-{\}}"
    local enable_graph="${4:-$MEM0_ENABLE_GRAPH_DEFAULT}"
    local agent_id="${5:-}"
    local global="${6:-false}"

    local user_id
    if [[ "$global" == "true" ]]; then
        user_id=$(mem0_global_user_id "$scope")
    else
        user_id=$(mem0_user_id "$scope")
    fi

    local project_id
    project_id=$(mem0_get_project_id)
    local timestamp
    timestamp=$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S%z)

    # Validate metadata is valid JSON, fallback to empty object
    if ! echo "$metadata" | jq -e '.' >/dev/null 2>&1; then
        metadata='{}'
    fi

    # Build metadata with project info
    local full_metadata
    full_metadata=$(echo "$metadata" | jq \
        --arg project "$project_id" \
        --arg scope "$scope" \
        --arg timestamp "$timestamp" \
        '. + {
            project: $project,
            scope: $scope,
            stored_at: $timestamp,
            source: "skillforge-plugin"
        }')

    # Build base JSON
    local result
    result=$(jq -n \
        --arg text "$content" \
        --arg user_id "$user_id" \
        --argjson metadata "$full_metadata" \
        '{
            text: $text,
            user_id: $user_id,
            metadata: $metadata
        }')

    # Add enable_graph if true
    if [[ "$enable_graph" == "true" ]]; then
        result=$(echo "$result" | jq '. + {enable_graph: true}')
    fi

    # Add agent_id if provided
    if [[ -n "$agent_id" ]]; then
        local formatted_agent_id
        formatted_agent_id=$(mem0_format_agent_id "$agent_id")
        result=$(echo "$result" | jq --arg agent_id "$formatted_agent_id" '. + {agent_id: $agent_id}')
    fi

    echo "$result"
}

# Output JSON for MCP tool call to search memory
# Usage: mem0_search_memory_json "scope" "query" ["limit"] ["enable_graph"] ["agent_id"] ["category"] ["global"]
# Output: JSON suitable for mcp__mem0__search_memories arguments
# Note: enable_graph defaults to MEM0_ENABLE_GRAPH_DEFAULT (true in v1.2.0)
mem0_search_memory_json() {
    local scope="$1"
    local query="$2"
    local limit="${3:-10}"
    local enable_graph="${4:-$MEM0_ENABLE_GRAPH_DEFAULT}"
    local agent_id="${5:-}"
    local category="${6:-}"
    local global="${7:-false}"

    local user_id
    if [[ "$global" == "true" ]]; then
        user_id=$(mem0_global_user_id "$scope")
    else
        user_id=$(mem0_user_id "$scope")
    fi

    # Build filters array
    local filters_json
    filters_json='{"AND": [{"user_id": "'"$user_id"'"}]}'

    # Add category filter if specified
    if [[ -n "$category" ]]; then
        filters_json=$(echo "$filters_json" | jq --arg cat "$category" '.AND += [{"metadata.category": $cat}]')
    fi

    # Add agent_id filter if specified
    if [[ -n "$agent_id" ]]; then
        local formatted_agent_id
        formatted_agent_id=$(mem0_format_agent_id "$agent_id")
        filters_json=$(echo "$filters_json" | jq --arg aid "$formatted_agent_id" '.AND += [{"agent_id": $aid}]')
    fi

    # Build base result
    local result
    result=$(jq -n \
        --arg query "$query" \
        --argjson filters "$filters_json" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: $filters,
            limit: $limit
        }')

    # Add enable_graph if true
    if [[ "$enable_graph" == "true" ]]; then
        result=$(echo "$result" | jq '. + {enable_graph: true}')
    fi

    echo "$result"
}

# Output JSON for MCP tool call to get all memories for a scope
# Usage: mem0_get_all_json "scope" ["global"]
# Output: JSON suitable for mcp__mem0__get_all_memories arguments
mem0_get_all_json() {
    local scope="$1"
    local global="${2:-false}"

    local user_id
    if [[ "$global" == "true" ]]; then
        user_id=$(mem0_global_user_id "$scope")
    else
        user_id=$(mem0_user_id "$scope")
    fi

    jq -n \
        --arg user_id "$user_id" \
        '{
            user_id: $user_id
        }'
}

# Output JSON for MCP tool call to delete memory
# Usage: mem0_delete_memory_json "memory_id"
# Output: JSON suitable for mcp__mem0__delete_memory arguments
mem0_delete_memory_json() {
    local memory_id="$1"

    jq -n \
        --arg memory_id "$memory_id" \
        '{
            memory_id: $memory_id
        }'
}

# -----------------------------------------------------------------------------
# Graph Memory Helper Functions (NEW in v1.1.0)
# -----------------------------------------------------------------------------

# Build graph entity JSON for mcp__memory__create_entities
# Usage: mem0_build_graph_entity "name" "type" "observation1" "observation2" ...
# Output: JSON entity object
mem0_build_graph_entity() {
    local name="$1"
    local entity_type="$2"
    shift 2
    local observations=("$@")

    # Build observations array
    local obs_json='[]'
    for obs in "${observations[@]}"; do
        obs_json=$(echo "$obs_json" | jq --arg o "$obs" '. += [$o]')
    done

    jq -n \
        --arg name "$name" \
        --arg entityType "$entity_type" \
        --argjson observations "$obs_json" \
        '{
            name: $name,
            entityType: $entityType,
            observations: $observations
        }'
}

# Build graph relation JSON for mcp__memory__create_relations
# Usage: mem0_build_graph_relation "from_entity" "to_entity" "relation_type"
# Output: JSON relation object
mem0_build_graph_relation() {
    local from="$1"
    local to="$2"
    local relation_type="$3"

    jq -n \
        --arg from "$from" \
        --arg to "$to" \
        --arg relationType "$relation_type" \
        '{
            from: $from,
            to: $to,
            relationType: $relationType
        }'
}

# Build entities array for batch creation
# Usage: mem0_build_entities_array entity1_json entity2_json ...
# Output: JSON array of entities
mem0_build_entities_array() {
    local result='[]'
    for entity in "$@"; do
        result=$(echo "$result" | jq --argjson e "$entity" '. += [$e]')
    done
    echo "$result"
}

# Build relations array for batch creation
# Usage: mem0_build_relations_array relation1_json relation2_json ...
# Output: JSON array of relations
mem0_build_relations_array() {
    local result='[]'
    for relation in "$@"; do
        result=$(echo "$result" | jq --argjson r "$relation" '. += [$r]')
    done
    echo "$result"
}

# Extract entities from text for graph memory
# Usage: mem0_extract_entities_hint "database-engineer uses pgvector for RAG"
# Output: Suggested entities and relations (hint for Claude)
mem0_extract_entities_hint() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    # Known agent patterns
    local agents=("database-engineer" "backend-system-architect" "frontend-ui-developer" "security-auditor" "test-generator" "workflow-architect" "llm-integrator" "data-pipeline-engineer")

    local found_agents=()
    for agent in "${agents[@]}"; do
        if [[ "$text_lower" == *"$agent"* ]]; then
            found_agents+=("$agent")
        fi
    done

    # Build hint JSON
    jq -n \
        --arg text "$text" \
        --argjson agents "$(printf '%s\n' "${found_agents[@]}" | jq -R . | jq -s .)" \
        '{
            original_text: $text,
            detected_agents: $agents,
            hint: "Consider creating entities for agents and their recommendations/patterns"
        }'
}

# -----------------------------------------------------------------------------
# Convenience Functions for Common Operations
# -----------------------------------------------------------------------------

# Build session continuity memory content
# Combines current task, decisions, and recent activity
# Output: Formatted string suitable for storing as memory
build_continuity_content() {
    local current_task
    local decisions
    local recent_tasks

    current_task=$(extract_current_task)
    decisions=$(extract_session_decisions)
    recent_tasks=$(extract_recent_tasks 3)

    local project_id
    project_id=$(mem0_get_project_id)

    # Build human-readable summary
    jq -n \
        --arg project "$project_id" \
        --argjson task "$current_task" \
        --argjson decisions "$decisions" \
        --argjson recent "$recent_tasks" \
        '"Project: " + $project + "\n\n" +
        (if $task != null then "Current Task:\n" + ($task | tostring) + "\n\n" else "" end) +
        (if ($decisions | length) > 0 then "Recent Decisions:\n" + ($decisions | map("- " + .summary) | join("\n")) + "\n\n" else "" end) +
        (if ($recent | length) > 0 then "Recent Activity:\n" + ($recent | map("- [" + .agent + "] " + .summary) | join("\n")) else "" end)' | \
        jq -r '.'
}

# Build decisions memory content from active decisions
# Output: Formatted string of decisions for memory storage
build_decisions_content() {
    local decisions
    decisions=$(extract_session_decisions)
    local project_id
    project_id=$(mem0_get_project_id)

    jq -n \
        --arg project "$project_id" \
        --argjson decisions "$decisions" \
        '"Architectural Decisions for " + $project + ":\n\n" +
        ($decisions | map(
            "## " + .id + " (" + .date + ")\n" +
            "Status: " + .status + " | Impact: " + (.impact // "unknown") + "\n" +
            .summary
        ) | join("\n\n"))' | \
        jq -r '.'
}

# -----------------------------------------------------------------------------
# Validation Functions (Graph-First v2.1)
# -----------------------------------------------------------------------------

# Check if knowledge graph is available
# Graph-First: ALWAYS returns 0 (true) - graph requires no configuration
# This is the preferred check for primary memory operations
is_graph_available() {
    return 0
}

# Alias for is_graph_available - preferred name for clarity
# Graph-First: ALWAYS returns 0 (true)
is_memory_available() {
    return 0
}

# Check if enhanced memory (mem0 cloud) is available
# Returns 0 if mem0 is configured, 1 if not
# Use this when mem0-specific features are requested (e.g., --mem0 flag)
is_enhanced_available() {
    is_mem0_available
}

# Check if Mem0 MCP server is likely available (optional enhancement)
# This is a heuristic check based on environment
# Returns 0 if likely available, 1 if not
is_mem0_available() {
    # Check if MCP memory tools are likely configured
    # This is an approximation - actual availability depends on Claude Desktop config

    # Check for MCP config indicators
    local config_file="${HOME}/.config/claude/claude_desktop_config.json"
    local alt_config="${HOME}/Library/Application Support/Claude/claude_desktop_config.json"

    if [[ -f "$config_file" ]]; then
        if grep -q "mem0" "$config_file" 2>/dev/null; then
            return 0
        fi
    fi

    if [[ -f "$alt_config" ]]; then
        if grep -q "mem0" "$alt_config" 2>/dev/null; then
            return 0
        fi
    fi

    # If we can't determine, assume not available
    return 1
}

# Validate memory content is not empty or too short
# Usage: validate_memory_content "content"
# Returns 0 if valid, 1 if invalid
validate_memory_content() {
    local content="$1"
    local min_length="${2:-10}"

    if [[ -z "$content" ]]; then
        echo "Error: Memory content cannot be empty" >&2
        return 1
    fi

    if [[ ${#content} -lt $min_length ]]; then
        echo "Error: Memory content too short (min $min_length chars)" >&2
        return 1
    fi

    return 0
}

# Validate agent_id format
# Usage: validate_agent_id "database-engineer"
# Returns 0 if valid, 1 if invalid
validate_agent_id() {
    local agent_id="$1"

    # Remove skf: prefix if present for validation
    agent_id="${agent_id#skf:}"

    # Known valid agents
    local valid_agents=("database-engineer" "backend-system-architect" "frontend-ui-developer" "security-auditor" "test-generator" "workflow-architect" "llm-integrator" "data-pipeline-engineer" "system-design-reviewer" "metrics-architect" "debug-investigator" "security-layer-auditor" "ux-researcher" "product-strategist" "code-quality-reviewer" "requirements-translator" "prioritization-analyst" "rapid-ui-designer" "market-intelligence" "business-case-builder")

    for valid in "${valid_agents[@]}"; do
        if [[ "$agent_id" == "$valid" ]]; then
            return 0
        fi
    done

    # Also allow custom agent IDs that match pattern
    if [[ "$agent_id" =~ ^[a-z0-9-]+$ ]]; then
        return 0
    fi

    echo "Warning: Unknown agent_id '$agent_id'" >&2
    return 1
}

# -----------------------------------------------------------------------------
# Export Functions
# -----------------------------------------------------------------------------

export -f mem0_get_project_id
export -f mem0_user_id
export -f mem0_global_user_id
export -f mem0_format_agent_id
export -f has_context_dir
export -f get_context_dir
export -f extract_session_decisions
export -f extract_current_task
export -f extract_recent_tasks
export -f mem0_add_memory_json
export -f mem0_search_memory_json
export -f mem0_get_all_json
export -f mem0_delete_memory_json
export -f mem0_build_graph_entity
export -f mem0_build_graph_relation
export -f mem0_build_entities_array
export -f mem0_build_relations_array
export -f mem0_extract_entities_hint
export -f build_continuity_content
export -f build_decisions_content
export -f is_graph_available
export -f is_memory_available
export -f is_enhanced_available
export -f is_mem0_available
export -f validate_memory_content
export -f validate_agent_id

# Export scope constants
export MEM0_SCOPE_DECISIONS
export MEM0_SCOPE_PATTERNS
export MEM0_SCOPE_CONTINUITY
export MEM0_SCOPE_AGENTS
export MEM0_SCOPE_BEST_PRACTICES
export MEM0_GLOBAL_PREFIX

# Export graph memory default (v1.2.0)
export MEM0_ENABLE_GRAPH_DEFAULT

# -----------------------------------------------------------------------------
# Best Practices Library Functions (#49)
# -----------------------------------------------------------------------------

# Build best practice memory content with outcome metadata
# Usage: build_best_practice_json "success|failed|neutral" "category" "text" ["lesson"] ["enable_graph"] ["agent_id"] ["global"]
# Output: JSON suitable for storing in mem0
# Note: enable_graph defaults to MEM0_ENABLE_GRAPH_DEFAULT (true in v1.2.0)
build_best_practice_json() {
    local outcome="$1"
    local category="$2"
    local text="$3"
    local lesson="${4:-}"
    local enable_graph="${5:-$MEM0_ENABLE_GRAPH_DEFAULT}"
    local agent_id="${6:-}"
    local global="${7:-false}"

    local user_id
    if [[ "$global" == "true" ]]; then
        user_id=$(mem0_global_user_id "$MEM0_SCOPE_BEST_PRACTICES")
    else
        user_id=$(mem0_user_id "$MEM0_SCOPE_BEST_PRACTICES")
    fi

    local project_id
    project_id=$(mem0_get_project_id)
    local timestamp
    timestamp=$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S%z)

    # Build metadata
    local metadata
    if [[ -n "$lesson" ]]; then
        metadata=$(jq -n \
            --arg category "$category" \
            --arg outcome "$outcome" \
            --arg project "$project_id" \
            --arg timestamp "$timestamp" \
            --arg lesson "$lesson" \
            '{
                category: $category,
                outcome: $outcome,
                project: $project,
                stored_at: $timestamp,
                lesson: $lesson,
                source: "skillforge-plugin"
            }')
    else
        metadata=$(jq -n \
            --arg category "$category" \
            --arg outcome "$outcome" \
            --arg project "$project_id" \
            --arg timestamp "$timestamp" \
            '{
                category: $category,
                outcome: $outcome,
                project: $project,
                stored_at: $timestamp,
                source: "skillforge-plugin"
            }')
    fi

    # Build base result
    local result
    result=$(jq -n \
        --arg text "$text" \
        --arg user_id "$user_id" \
        --argjson metadata "$metadata" \
        '{
            text: $text,
            user_id: $user_id,
            metadata: $metadata
        }')

    # Add enable_graph if true
    if [[ "$enable_graph" == "true" ]]; then
        result=$(echo "$result" | jq '. + {enable_graph: true}')
    fi

    # Add agent_id if provided
    if [[ -n "$agent_id" ]]; then
        local formatted_agent_id
        formatted_agent_id=$(mem0_format_agent_id "$agent_id")
        result=$(echo "$result" | jq --arg agent_id "$formatted_agent_id" '. + {agent_id: $agent_id}')
    fi

    echo "$result"
}

# Auto-detect category from text content
# Usage: detect_best_practice_category "text content"
# Output: category name (lowercase)
detect_best_practice_category() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    # Check for category indicators (order matters - more specific first)
    # Performance should come before database because "query was slow" should match performance
    if [[ "$text_lower" =~ pagination|cursor|offset|page ]]; then
        echo "pagination"
    elif [[ "$text_lower" =~ auth|jwt|oauth|token|session|login ]]; then
        echo "authentication"
    elif [[ "$text_lower" =~ performance|slow|fast|cache|optimize|latency ]]; then
        echo "performance"
    elif [[ "$text_lower" =~ database|sql|postgres|query|schema|migration ]]; then
        echo "database"
    elif [[ "$text_lower" =~ api|endpoint|rest|graphql|route ]]; then
        echo "api"
    elif [[ "$text_lower" =~ react|component|frontend|ui|css|style ]]; then
        echo "frontend"
    elif [[ "$text_lower" =~ architecture|design|system|structure ]]; then
        echo "architecture"
    elif [[ "$text_lower" =~ pattern|convention|style ]]; then
        echo "pattern"
    elif [[ "$text_lower" =~ blocked|issue|bug|workaround ]]; then
        echo "blocker"
    elif [[ "$text_lower" =~ must|cannot|required|constraint ]]; then
        echo "constraint"
    elif [[ "$text_lower" =~ chose|decided|selected ]]; then
        echo "decision"
    else
        echo "decision"  # Default
    fi
}

# Check if text might be a known anti-pattern
# Usage: check_for_antipattern "text content"
# Output: JSON with matched anti-patterns or empty
# Note: This requires mem0 MCP tool to be called separately
check_for_antipattern_query() {
    local text="$1"
    local category
    category=$(detect_best_practice_category "$text")

    # Build query for searching similar patterns
    jq -n \
        --arg text "$text" \
        --arg category "$category" \
        '{
            query: $text,
            filters: {
                "AND": [
                    { "metadata.category": $category },
                    { "metadata.outcome": "failed" }
                ]
            },
            limit: 5
        }'
}

# Export best practices functions
export -f build_best_practice_json
export -f detect_best_practice_category
export -f check_for_antipattern_query

# -----------------------------------------------------------------------------
# Cross-Agent Federation Functions (NEW in v1.2.0)
# -----------------------------------------------------------------------------

# Get related agents for cross-agent knowledge sharing
# Usage: mem0_get_related_agents "database-engineer"
# Output: Space-separated list of related agent types
mem0_get_related_agents() {
    local agent_type="$1"
    case "$agent_type" in
        database-engineer)
            echo "backend-system-architect security-auditor data-pipeline-engineer" ;;
        backend-system-architect)
            echo "database-engineer frontend-ui-developer security-auditor llm-integrator" ;;
        frontend-ui-developer)
            echo "backend-system-architect ux-researcher accessibility-specialist rapid-ui-designer" ;;
        security-auditor)
            echo "backend-system-architect database-engineer infrastructure-architect" ;;
        test-generator)
            echo "backend-system-architect frontend-ui-developer code-quality-reviewer" ;;
        workflow-architect)
            echo "llm-integrator backend-system-architect data-pipeline-engineer" ;;
        llm-integrator)
            echo "workflow-architect data-pipeline-engineer backend-system-architect" ;;
        data-pipeline-engineer)
            echo "database-engineer llm-integrator workflow-architect" ;;
        metrics-architect)
            echo "backend-system-architect product-strategist business-case-builder" ;;
        ux-researcher)
            echo "frontend-ui-developer product-strategist rapid-ui-designer" ;;
        code-quality-reviewer)
            echo "test-generator backend-system-architect security-auditor" ;;
        infrastructure-architect)
            echo "ci-cd-engineer deployment-manager security-auditor" ;;
        ci-cd-engineer)
            echo "infrastructure-architect deployment-manager test-generator" ;;
        deployment-manager)
            echo "infrastructure-architect ci-cd-engineer release-engineer" ;;
        accessibility-specialist)
            echo "frontend-ui-developer ux-researcher rapid-ui-designer" ;;
        product-strategist)
            echo "requirements-translator market-intelligence business-case-builder ux-researcher" ;;
        requirements-translator)
            echo "product-strategist prioritization-analyst backend-system-architect" ;;
        prioritization-analyst)
            echo "product-strategist requirements-translator metrics-architect" ;;
        rapid-ui-designer)
            echo "frontend-ui-developer ux-researcher accessibility-specialist" ;;
        market-intelligence)
            echo "product-strategist business-case-builder" ;;
        business-case-builder)
            echo "product-strategist metrics-architect prioritization-analyst" ;;
        *)
            echo "" ;;
    esac
}

# Build cross-agent search JSON for multiple agents
# Usage: mem0_cross_agent_search_json "database-engineer" "query" ["limit"]
# Output: JSON suitable for mcp__mem0__search_memories with OR filters
mem0_cross_agent_search_json() {
    local agent_type="$1"
    local query="$2"
    local limit="${3:-5}"

    local related_agents
    related_agents=$(mem0_get_related_agents "$agent_type")

    local project_id
    project_id=$(mem0_get_project_id)

    local user_id
    user_id=$(mem0_user_id "$MEM0_SCOPE_AGENTS")

    # Build OR filter for multiple agents
    local agent_filters='[]'

    # Add primary agent
    agent_filters=$(echo "$agent_filters" | jq --arg aid "skf:$agent_type" '. += [{"agent_id": $aid}]')

    # Add related agents
    for related in $related_agents; do
        if [[ -n "$related" ]]; then
            agent_filters=$(echo "$agent_filters" | jq --arg aid "skf:$related" '. += [{"agent_id": $aid}]')
        fi
    done

    # Build the search JSON with OR filter
    jq -n \
        --arg query "$query" \
        --arg user_id "$user_id" \
        --argjson agent_filters "$agent_filters" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: {
                "AND": [
                    {"user_id": $user_id},
                    {"OR": $agent_filters}
                ]
            },
            limit: $limit,
            enable_graph: true
        }'
}

# Build cross-project best practices search for an agent's domain
# Usage: mem0_cross_project_search_json "database-engineer" "query" ["limit"]
# Output: JSON for searching global best practices relevant to agent domain
mem0_cross_project_search_json() {
    local agent_type="$1"
    local query="$2"
    local limit="${3:-5}"

    local global_user_id
    global_user_id=$(mem0_global_user_id "$MEM0_SCOPE_BEST_PRACTICES")

    # Get domain keywords for this agent
    local domain_keywords=""
    case "$agent_type" in
        database-engineer)
            domain_keywords="database schema SQL PostgreSQL migration" ;;
        backend-system-architect)
            domain_keywords="API REST architecture backend microservice" ;;
        frontend-ui-developer)
            domain_keywords="React frontend UI component TypeScript" ;;
        security-auditor)
            domain_keywords="security OWASP vulnerability authentication" ;;
        llm-integrator)
            domain_keywords="LLM API embeddings RAG function-calling" ;;
        workflow-architect)
            domain_keywords="LangGraph workflow agent orchestration state" ;;
        *)
            domain_keywords="$agent_type" ;;
    esac

    # Enhance query with domain keywords
    local enhanced_query="${query} ${domain_keywords}"

    jq -n \
        --arg query "$enhanced_query" \
        --arg user_id "$global_user_id" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: {
                "AND": [
                    {"user_id": $user_id}
                ]
            },
            limit: $limit,
            enable_graph: true
        }'
}

# Export cross-agent functions
export -f mem0_get_related_agents
export -f mem0_cross_agent_search_json
export -f mem0_cross_project_search_json

# -----------------------------------------------------------------------------
# Proactive Pattern Surfacing Functions (NEW in v1.2.0)
# -----------------------------------------------------------------------------

# Build search JSON filtered by outcome (success or failed)
# Usage: mem0_search_by_outcome_json "scope" "query" "success|failed" ["limit"]
# Output: JSON for searching patterns with specific outcome
mem0_search_by_outcome_json() {
    local scope="$1"
    local query="$2"
    local outcome="$3"
    local limit="${4:-5}"

    local user_id
    user_id=$(mem0_user_id "$scope")

    jq -n \
        --arg query "$query" \
        --arg user_id "$user_id" \
        --arg outcome "$outcome" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: {
                "AND": [
                    {"user_id": $user_id},
                    {"metadata.outcome": $outcome}
                ]
            },
            limit: $limit,
            enable_graph: true
        }'
}

# Build search JSON for anti-patterns (failed patterns)
# Usage: mem0_search_antipatterns_json "query" ["category"] ["limit"]
# Output: JSON for searching failed patterns
mem0_search_antipatterns_json() {
    local query="$1"
    local category="${2:-}"
    local limit="${3:-5}"

    local user_id
    user_id=$(mem0_user_id "$MEM0_SCOPE_BEST_PRACTICES")

    local filters
    if [[ -n "$category" ]]; then
        filters=$(jq -n \
            --arg user_id "$user_id" \
            --arg category "$category" \
            '{
                "AND": [
                    {"user_id": $user_id},
                    {"metadata.outcome": "failed"},
                    {"metadata.category": $category}
                ]
            }')
    else
        filters=$(jq -n \
            --arg user_id "$user_id" \
            '{
                "AND": [
                    {"user_id": $user_id},
                    {"metadata.outcome": "failed"}
                ]
            }')
    fi

    jq -n \
        --arg query "$query" \
        --argjson filters "$filters" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: $filters,
            limit: $limit,
            enable_graph: true
        }'
}

# Build search JSON for best practices (successful patterns)
# Usage: mem0_search_best_practices_json "query" ["category"] ["limit"]
# Output: JSON for searching successful patterns
mem0_search_best_practices_json() {
    local query="$1"
    local category="${2:-}"
    local limit="${3:-5}"

    local user_id
    user_id=$(mem0_user_id "$MEM0_SCOPE_BEST_PRACTICES")

    local filters
    if [[ -n "$category" ]]; then
        filters=$(jq -n \
            --arg user_id "$user_id" \
            --arg category "$category" \
            '{
                "AND": [
                    {"user_id": $user_id},
                    {"metadata.outcome": "success"},
                    {"metadata.category": $category}
                ]
            }')
    else
        filters=$(jq -n \
            --arg user_id "$user_id" \
            '{
                "AND": [
                    {"user_id": $user_id},
                    {"metadata.outcome": "success"}
                ]
            }')
    fi

    jq -n \
        --arg query "$query" \
        --argjson filters "$filters" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: $filters,
            limit: $limit,
            enable_graph: true
        }'
}

# Build global search JSON for cross-project patterns by outcome
# Usage: mem0_search_global_by_outcome_json "query" "success|failed" ["limit"]
# Output: JSON for searching global patterns with specific outcome
mem0_search_global_by_outcome_json() {
    local query="$1"
    local outcome="$2"
    local limit="${3:-5}"

    local user_id
    user_id=$(mem0_global_user_id "$MEM0_SCOPE_BEST_PRACTICES")

    jq -n \
        --arg query "$query" \
        --arg user_id "$user_id" \
        --arg outcome "$outcome" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: {
                "AND": [
                    {"user_id": $user_id},
                    {"metadata.outcome": $outcome}
                ]
            },
            limit: $limit,
            enable_graph: true
        }'
}

# Export proactive pattern surfacing functions
export -f mem0_search_by_outcome_json
export -f mem0_search_antipatterns_json
export -f mem0_search_best_practices_json
export -f mem0_search_global_by_outcome_json

# -----------------------------------------------------------------------------
# Session Continuity 2.0 Functions (NEW in v1.2.0)
# -----------------------------------------------------------------------------

# Build session summary JSON for storage at session end
# Collects current task, blockers, decisions, agents used, and next steps
# Usage: build_session_summary_json "task_summary" "status" ["blockers"] ["next_steps"]
# Output: JSON suitable for mcp__mem0__add_memory for session continuity
build_session_summary_json() {
    local task_summary="$1"
    local status="${2:-in_progress}"
    local blockers="${3:-}"
    local next_steps="${4:-}"

    local project_id
    project_id=$(mem0_get_project_id)

    local user_id
    user_id=$(mem0_user_id "$MEM0_SCOPE_CONTINUITY")

    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local session_id
    session_id="${CLAUDE_SESSION_ID:-$(date +%s)}"

    # Build text summary
    local text="Session Summary: ${task_summary}"
    if [[ -n "$blockers" ]]; then
        text="${text} | Blockers: ${blockers}"
    fi
    if [[ -n "$next_steps" ]]; then
        text="${text} | Next: ${next_steps}"
    fi

    # Build metadata
    local metadata
    metadata=$(jq -n \
        --arg status "$status" \
        --arg project "$project_id" \
        --arg timestamp "$timestamp" \
        --arg session_id "$session_id" \
        --arg blockers "$blockers" \
        --arg next_steps "$next_steps" \
        '{
            type: "session_summary",
            status: $status,
            project: $project,
            session_id: $session_id,
            stored_at: $timestamp,
            has_blockers: ($blockers != ""),
            has_next_steps: ($next_steps != ""),
            source: "skillforge-plugin"
        }')

    # Build result
    local result
    result=$(jq -n \
        --arg text "$text" \
        --arg user_id "$user_id" \
        --argjson metadata "$metadata" \
        '{
            text: $text,
            user_id: $user_id,
            metadata: $metadata,
            enable_graph: true
        }')

    echo "$result"
}

# Build search JSON for recent sessions with time filtering
# Usage: mem0_search_recent_sessions_json "query" ["days_back"] ["limit"]
# Output: JSON for searching session continuity with time filter
mem0_search_recent_sessions_json() {
    local query="$1"
    local days_back="${2:-7}"
    local limit="${3:-3}"

    local user_id
    user_id=$(mem0_user_id "$MEM0_SCOPE_CONTINUITY")

    # Calculate date threshold
    # macOS date differs from Linux - detect and handle both
    local date_threshold
    if date --version >/dev/null 2>&1; then
        # GNU date (Linux)
        date_threshold=$(date -d "-${days_back} days" +%Y-%m-%d)
    else
        # BSD date (macOS)
        date_threshold=$(date -v-${days_back}d +%Y-%m-%d)
    fi

    jq -n \
        --arg query "$query" \
        --arg user_id "$user_id" \
        --arg date_threshold "$date_threshold" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: {
                "AND": [
                    {"user_id": $user_id},
                    {"created_at": {"gte": $date_threshold}}
                ]
            },
            limit: $limit,
            enable_graph: true
        }'
}

# Build search JSON for sessions with blockers
# Usage: mem0_search_blocked_sessions_json "query" ["days_back"] ["limit"]
# Output: JSON for searching sessions that had blockers
mem0_search_blocked_sessions_json() {
    local query="$1"
    local days_back="${2:-14}"
    local limit="${3:-5}"

    local user_id
    user_id=$(mem0_user_id "$MEM0_SCOPE_CONTINUITY")

    # Calculate date threshold
    local date_threshold
    if date --version >/dev/null 2>&1; then
        date_threshold=$(date -d "-${days_back} days" +%Y-%m-%d)
    else
        date_threshold=$(date -v-${days_back}d +%Y-%m-%d)
    fi

    jq -n \
        --arg query "$query blockers issues" \
        --arg user_id "$user_id" \
        --arg date_threshold "$date_threshold" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: {
                "AND": [
                    {"user_id": $user_id},
                    {"metadata.has_blockers": true},
                    {"created_at": {"gte": $date_threshold}}
                ]
            },
            limit: $limit,
            enable_graph: true
        }'
}

# Build search JSON for sessions with pending next steps
# Usage: mem0_search_pending_work_json "query" ["days_back"] ["limit"]
# Output: JSON for searching sessions with unfinished work
mem0_search_pending_work_json() {
    local query="$1"
    local days_back="${2:-14}"
    local limit="${3:-5}"

    local user_id
    user_id=$(mem0_user_id "$MEM0_SCOPE_CONTINUITY")

    # Calculate date threshold
    local date_threshold
    if date --version >/dev/null 2>&1; then
        date_threshold=$(date -d "-${days_back} days" +%Y-%m-%d)
    else
        date_threshold=$(date -v-${days_back}d +%Y-%m-%d)
    fi

    jq -n \
        --arg query "$query next steps pending" \
        --arg user_id "$user_id" \
        --arg date_threshold "$date_threshold" \
        --argjson limit "$limit" \
        '{
            query: $query,
            filters: {
                "AND": [
                    {"user_id": $user_id},
                    {"metadata.has_next_steps": true},
                    {"metadata.status": "in_progress"},
                    {"created_at": {"gte": $date_threshold}}
                ]
            },
            limit: $limit,
            enable_graph: true
        }'
}

# Build combined session context retrieval hint for Claude
# Usage: build_session_retrieval_hint ["days_back"]
# Output: Formatted hint for Claude to search session context
build_session_retrieval_hint() {
    local days_back="${1:-7}"

    local project_id
    project_id=$(mem0_get_project_id)

    local user_id
    user_id=$(mem0_user_id "$MEM0_SCOPE_CONTINUITY")

    local decisions_user_id
    decisions_user_id=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")

    # Build the recent sessions search JSON
    local recent_search
    recent_search=$(mem0_search_recent_sessions_json "session context blockers next steps" "$days_back" 3)

    # Build the blocked sessions search JSON
    local blocked_search
    blocked_search=$(mem0_search_blocked_sessions_json "blockers issues" "$days_back" 3)

    cat <<EOF
Session context available for ${project_id} (graph memory enabled):

1. Recent session summaries (last ${days_back} days):
   mcp__mem0__search_memories with:
   ${recent_search}

2. Sessions with blockers:
   mcp__mem0__search_memories with:
   ${blocked_search}

3. Project decisions:
   mcp__mem0__search_memories with:
   - query="recent decisions architecture"
   - filters={"AND": [{"user_id": "${decisions_user_id}"}]}
   - limit=5
   - enable_graph=true
EOF
}

# Export session continuity functions
export -f build_session_summary_json
export -f mem0_search_recent_sessions_json
export -f mem0_search_blocked_sessions_json
export -f mem0_search_pending_work_json
export -f build_session_retrieval_hint