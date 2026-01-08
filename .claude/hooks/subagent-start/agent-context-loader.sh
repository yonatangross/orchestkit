#!/bin/bash
# Agent Context Loader - Before Subagent Hook
# Loads agent-specific context when spawning a subagent
#
# Receives agent_id from hook input and loads corresponding context file
# Position: MIDDLE (lower attention, background knowledge)
#
# Version: 2.0.0
# Part of Context Engineering 2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTEXT_DIR="$PROJECT_ROOT/context"
LOG_FILE="$PROJECT_ROOT/logs/agent-context.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Parse input (expects JSON with agent_id)
parse_input() {
    local input="${1:-}"

    if [ -z "$input" ]; then
        # Try reading from stdin
        input=$(cat 2>/dev/null || echo '{}')
    fi

    # Extract agent_id from various possible formats
    local agent_id=""

    # Try JSON format: {"agent_id": "xxx"} or {"subagent_type": "xxx"}
    if echo "$input" | jq -e '.agent_id' > /dev/null 2>&1; then
        agent_id=$(echo "$input" | jq -r '.agent_id')
    elif echo "$input" | jq -e '.subagent_type' > /dev/null 2>&1; then
        agent_id=$(echo "$input" | jq -r '.subagent_type')
    else
        # Assume plain text agent ID
        agent_id="$input"
    fi

    echo "$agent_id"
}

# Load agent-specific context
load_agent_context() {
    local agent_id=$1

    if [ -z "$agent_id" ] || [ "$agent_id" == "null" ]; then
        log "No agent_id provided, skipping agent context load"
        echo "{}"
        return
    fi

    local context_file="$CONTEXT_DIR/agents/${agent_id}.json"

    if [ ! -f "$context_file" ]; then
        log "No context file for agent: $agent_id"
        echo "{}"
        return
    fi

    log "Loading context for agent: $agent_id"

    # Load and compress context for injection
    local context=$(jq -c '{
        role: .role_summary,
        patterns: .relevant_patterns,
        recent_work: [.recent_work[]? | {task: .task, status: .status}],
        concerns: .active_concerns,
        skills: .preferred_skills
    }' "$context_file" 2>/dev/null || echo '{}')

    if [ "$context" != "{}" ]; then
        local tokens=$(wc -c <<< "$context" | awk '{print int($1/4)}')
        log "Loaded agent context (~$tokens tokens)"

        # Output formatted for injection
        echo "[AGENT_CONTEXT: $agent_id]"
        echo "$context"
    else
        log "Failed to parse agent context for: $agent_id"
        echo "{}"
    fi
}

# Also load relevant knowledge based on agent type
load_relevant_knowledge() {
    local agent_id=$1
    local output=""

    # Map agent types to relevant knowledge triggers
    case "$agent_id" in
        backend-system-architect|database-engineer)
            # Load patterns for backend agents
            if [ -f "$CONTEXT_DIR/knowledge/patterns/established.json" ]; then
                local backend_patterns=$(jq -c '.patterns.backend' "$CONTEXT_DIR/knowledge/patterns/established.json" 2>/dev/null || echo '[]')
                if [ "$backend_patterns" != "[]" ]; then
                    output="[BACKEND_PATTERNS]\n$backend_patterns\n"
                fi
            fi
            ;;
        frontend-ui-developer|rapid-ui-designer)
            # Load patterns for frontend agents
            if [ -f "$CONTEXT_DIR/knowledge/patterns/established.json" ]; then
                local frontend_patterns=$(jq -c '.patterns.frontend' "$CONTEXT_DIR/knowledge/patterns/established.json" 2>/dev/null || echo '[]')
                if [ "$frontend_patterns" != "[]" ]; then
                    output="[FRONTEND_PATTERNS]\n$frontend_patterns\n"
                fi
            fi
            ;;
        security-auditor|security-layer-auditor)
            # Load security-related decisions
            if [ -f "$CONTEXT_DIR/knowledge/decisions/active.json" ]; then
                local security_decisions=$(jq -c '[.decisions[] | select(.id | contains("security") or contains("auth"))]' "$CONTEXT_DIR/knowledge/decisions/active.json" 2>/dev/null || echo '[]')
                if [ "$security_decisions" != "[]" ]; then
                    output="[SECURITY_DECISIONS]\n$security_decisions\n"
                fi
            fi
            ;;
        test-generator|code-quality-reviewer)
            # Load testing patterns
            if [ -f "$CONTEXT_DIR/knowledge/patterns/established.json" ]; then
                local testing_patterns=$(jq -c '.patterns.testing' "$CONTEXT_DIR/knowledge/patterns/established.json" 2>/dev/null || echo '[]')
                if [ "$testing_patterns" != "[]" ]; then
                    output="[TESTING_PATTERNS]\n$testing_patterns\n"
                fi
            fi
            ;;
    esac

    if [ -n "$output" ]; then
        echo -e "$output"
    fi
}

# Main function
main() {
    local input="${1:-$(cat 2>/dev/null || echo '')}"
    local agent_id=$(parse_input "$input")

    log "Agent context loader triggered for: $agent_id"

    # Load agent-specific context
    load_agent_context "$agent_id"

    # Load relevant knowledge
    load_relevant_knowledge "$agent_id"

    log "Agent context load complete"
}

# Execute
# Output systemMessage for user visibility
echo '{"systemMessage":"Agent context loaded"}'
main "$@"
