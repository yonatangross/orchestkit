#!/bin/bash
# Mem0 Decision Saver Hook
# Auto-saves architectural decisions to Mem0 after design-related skills complete
#
# Triggered after skills like:
# - brainstorming
# - system-design-*
# - api-design-framework
# - database-schema-designer
# - architecture-decision-record
#
# Version: 1.0.0
# Part of SkillForge Plugin - Works across ANY repository
#
# What this hook does:
# 1. Checks if the completed skill typically produces decisions
# 2. Prompts Claude to extract and save key decisions to Mem0
# 3. Ensures decisions survive context compaction

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source the Mem0 library
if [[ -f "$PLUGIN_ROOT/hooks/_lib/mem0.sh" ]]; then
    source "$PLUGIN_ROOT/hooks/_lib/mem0.sh"
else
    # Library not found - skip gracefully
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Log file for debugging
LOG_DIR="$PLUGIN_ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/mem0-decisions.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [decision-saver] $1" >> "$LOG_FILE"
}

# -----------------------------------------------------------------------------
# Skill Detection
# -----------------------------------------------------------------------------

# Skills that typically produce architectural/design decisions
DECISION_SKILLS=(
    "brainstorming"
    "system-design"
    "api-design"
    "database-schema"
    "architecture"
    "backend-system"
    "frontend-ui"
    "workflow-architect"
    "clean-architecture"
)

# Check if the current context suggests a decision-producing skill was used
is_decision_skill() {
    local skill_name="${CLAUDE_SKILL_NAME:-}"
    local tool_name="${CLAUDE_TOOL_NAME:-}"

    # Check environment for skill context
    if [[ -n "$skill_name" ]]; then
        for pattern in "${DECISION_SKILLS[@]}"; do
            if [[ "$skill_name" == *"$pattern"* ]]; then
                return 0
            fi
        done
    fi

    # Also check tool name (for Skill tool calls)
    if [[ -n "$tool_name" && "$tool_name" == "Skill" ]]; then
        return 0  # Assume any skill might have decisions
    fi

    return 1
}

# -----------------------------------------------------------------------------
# Main Logic
# -----------------------------------------------------------------------------

main() {
    local project_id
    project_id=$(mem0_get_project_id)

    log "Decision saver triggered for project: $project_id"

    # Get project context
    local user_id
    user_id=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")

    # Build the prompt for Claude to extract and save decisions
    local system_message
    read -r -d '' system_message << 'EOF' || true
## Save Design Decisions to Mem0

If any architectural or design decisions were made in this session, please save them to Mem0 for future reference.

**Decision types to look for:**
- Technology choices (frameworks, libraries, databases)
- Architecture patterns (clean architecture, microservices, etc.)
- API design decisions (REST vs GraphQL, pagination strategy)
- Database schema decisions (normalization, indexing strategy)
- Code conventions and patterns
- Security approaches
- Performance trade-offs

**How to save:**
For each significant decision, use `mcp__mem0__add_memory` with:
- `content`: Clear description of the decision and rationale
- `user_id`: "${USER_ID}"
- `metadata`: `{"type": "decision", "category": "<category>", "source": "skillforge-plugin"}`

**Example:**
```
Decision: Use SQLAlchemy 2.0 with async support
Rationale: Better performance for I/O-bound operations, native async/await support
Trade-offs: Slightly more complex setup, but worth it for scalability
```

Only save decisions that are significant and would be useful to remember in future sessions.
EOF

    # Replace placeholder with actual user_id
    system_message="${system_message//\$\{USER_ID\}/$user_id}"

    log "Generated decision save prompt"

    # Output for Claude
    cat << HOOK_EOF
{
  "continue": true,
  "systemMessage": $(echo "$system_message" | jq -Rs .)
}
HOOK_EOF
}

# Execute
main