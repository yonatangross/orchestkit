#!/bin/bash
# Mem0 Memory Operations Library for SkillForge Plugin
# Provides helper functions for interacting with Mem0 MCP server
#
# Version: 1.0.0
# Part of SkillForge Plugin - Works across ANY repository
#
# Usage: source "${CLAUDE_PLUGIN_ROOT}/hooks/_lib/mem0.sh"
#
# Key Design Principles:
# - Project-agnostic: Works in any repository where the plugin is installed
# - Graceful degradation: Works even if project has no .claude/context structure
# - Scoped memory: Uses {project-name}-{scope} format for user_id
# - MCP-compatible: Outputs JSON suitable for mcp__mem0__* tool calls

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Memory scopes for organizing different types of context
readonly MEM0_SCOPE_DECISIONS="decisions"    # Architecture/design decisions
readonly MEM0_SCOPE_PATTERNS="patterns"      # Code patterns and conventions
readonly MEM0_SCOPE_CONTINUITY="continuity"  # Session continuity/handoff
readonly MEM0_SCOPE_AGENTS="agents"              # Agent-specific context
readonly MEM0_SCOPE_BEST_PRACTICES="best-practices"  # Success/failure patterns (#49)

# Valid scopes array for validation
readonly MEM0_VALID_SCOPES=("$MEM0_SCOPE_DECISIONS" "$MEM0_SCOPE_PATTERNS" "$MEM0_SCOPE_CONTINUITY" "$MEM0_SCOPE_AGENTS" "$MEM0_SCOPE_BEST_PRACTICES")

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
# Mem0 MCP Tool JSON Generators
# -----------------------------------------------------------------------------

# Output JSON for MCP tool call to add memory
# Usage: mem0_add_memory_json "scope" "content" ["metadata_json"]
# Output: JSON suitable for mcp__mem0__add_memory arguments
mem0_add_memory_json() {
    local scope="$1"
    local content="$2"
    local metadata="${3:-{\}}"
    local user_id
    user_id=$(mem0_user_id "$scope")
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

    # Output the tool call arguments
    jq -n \
        --arg content "$content" \
        --arg user_id "$user_id" \
        --argjson metadata "$full_metadata" \
        '{
            content: $content,
            user_id: $user_id,
            metadata: $metadata
        }'
}

# Output JSON for MCP tool call to search memory
# Usage: mem0_search_memory_json "scope" "query" ["limit"]
# Output: JSON suitable for mcp__mem0__search_memory arguments
mem0_search_memory_json() {
    local scope="$1"
    local query="$2"
    local limit="${3:-10}"
    local user_id
    user_id=$(mem0_user_id "$scope")

    jq -n \
        --arg query "$query" \
        --arg user_id "$user_id" \
        --argjson limit "$limit" \
        '{
            query: $query,
            user_id: $user_id,
            limit: $limit
        }'
}

# Output JSON for MCP tool call to get all memories for a scope
# Usage: mem0_get_all_json "scope"
# Output: JSON suitable for mcp__mem0__get_all_memories arguments
mem0_get_all_json() {
    local scope="$1"
    local user_id
    user_id=$(mem0_user_id "$scope")

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
# Validation Functions
# -----------------------------------------------------------------------------

# Check if Mem0 MCP server is likely available
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

# -----------------------------------------------------------------------------
# Export Functions
# -----------------------------------------------------------------------------

export -f mem0_get_project_id
export -f mem0_user_id
export -f has_context_dir
export -f get_context_dir
export -f extract_session_decisions
export -f extract_current_task
export -f extract_recent_tasks
export -f mem0_add_memory_json
export -f mem0_search_memory_json
export -f mem0_get_all_json
export -f mem0_delete_memory_json
export -f build_continuity_content
export -f build_decisions_content
export -f is_mem0_available
export -f validate_memory_content

# Export scope constants
export MEM0_SCOPE_DECISIONS
export MEM0_SCOPE_PATTERNS
export MEM0_SCOPE_CONTINUITY
export MEM0_SCOPE_AGENTS
export MEM0_SCOPE_BEST_PRACTICES

# -----------------------------------------------------------------------------
# Best Practices Library Functions (#49)
# -----------------------------------------------------------------------------

# Build best practice memory content with outcome metadata
# Usage: build_best_practice_json "success|failed|neutral" "category" "text" ["lesson"]
# Output: JSON suitable for storing in mem0
build_best_practice_json() {
    local outcome="$1"
    local category="$2"
    local text="$3"
    local lesson="${4:-}"
    local user_id
    user_id=$(mem0_user_id "$MEM0_SCOPE_BEST_PRACTICES")
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

    # Output the tool call arguments
    jq -n \
        --arg content "$text" \
        --arg user_id "$user_id" \
        --argjson metadata "$metadata" \
        '{
            content: $content,
            user_id: $user_id,
            metadata: $metadata
        }'
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

# Export new functions
export -f build_best_practice_json
export -f detect_best_practice_category
export -f check_for_antipattern_query
