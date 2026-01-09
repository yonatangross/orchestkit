#!/bin/bash
# Agent Context Loader - Before Subagent Hook
# Loads agent-specific context when spawning a subagent
# CC 2.1.2 Compliant: includes continue field in all outputs
#
# Receives agent_id from hook input and loads corresponding context file
# Part of Context Engineering 2.0

set -euo pipefail

# Read stdin immediately
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
CONTEXT_DIR="$PROJECT_ROOT/.claude/context"
LOG_FILE="$PROJECT_ROOT/.claude/logs/agent-context.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# Parse input to get agent_id
get_agent_id() {
    local agent_id=""

    # Try subagent_type first (standard hook field)
    agent_id=$(echo "$_HOOK_INPUT" | jq -r '.subagent_type // empty' 2>/dev/null || echo "")

    # Fallback to agent_id
    if [ -z "$agent_id" ]; then
        agent_id=$(echo "$_HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || echo "")
    fi

    echo "$agent_id"
}

# Load agent-specific context
load_agent_context() {
    local agent_id=$1
    local context=""

    if [ -z "$agent_id" ] || [ "$agent_id" == "null" ]; then
        return
    fi

    # Try loading from plugin.json agents array
    local plugin_file="$PROJECT_ROOT/plugin.json"
    if [ -f "$plugin_file" ]; then
        local agent_info=$(jq -r ".agents[] | select(.id==\"$agent_id\") | {capabilities, skills_used, boundaries}" "$plugin_file" 2>/dev/null || echo "{}")
        if [ "$agent_info" != "{}" ] && [ -n "$agent_info" ]; then
            context="Agent: $agent_id\nCapabilities: $(echo "$agent_info" | jq -c '.capabilities // []')\nSkills: $(echo "$agent_info" | jq -c '.skills_used // []')"
            log "Loaded context for agent: $agent_id from plugin.json"
        fi
    fi

    echo "$context"
}

# Load relevant knowledge based on agent type
load_relevant_knowledge() {
    local agent_id=$1
    local knowledge=""

    local patterns_file="$CONTEXT_DIR/knowledge/patterns/established.json"
    local decisions_file="$CONTEXT_DIR/knowledge/decisions/active.json"

    case "$agent_id" in
        backend-system-architect|database-engineer)
            if [ -f "$patterns_file" ]; then
                local count=$(jq -r '.patterns.backend // [] | length' "$patterns_file" 2>/dev/null || echo "0")
                if [ "$count" -gt 0 ]; then
                    knowledge="Backend patterns available: $count"
                fi
            fi
            ;;
        frontend-ui-developer|rapid-ui-designer)
            if [ -f "$patterns_file" ]; then
                local count=$(jq -r '.patterns.frontend // [] | length' "$patterns_file" 2>/dev/null || echo "0")
                if [ "$count" -gt 0 ]; then
                    knowledge="Frontend patterns available: $count"
                fi
            fi
            ;;
        security-auditor|security-layer-auditor)
            if [ -f "$decisions_file" ]; then
                local count=$(jq -r '[.decisions[]? | select(.category == "security")] | length' "$decisions_file" 2>/dev/null || echo "0")
                if [ "$count" -gt 0 ]; then
                    knowledge="Security decisions to review: $count"
                fi
            fi
            ;;
    esac

    echo "$knowledge"
}

# Main
agent_id=$(get_agent_id)
log "Agent context loader triggered for: $agent_id"

context=$(load_agent_context "$agent_id")
knowledge=$(load_relevant_knowledge "$agent_id")

# Build system message
system_message=""
if [ -n "$context" ]; then
    system_message="$context"
fi
if [ -n "$knowledge" ]; then
    if [ -n "$system_message" ]; then
        system_message="$system_message\n$knowledge"
    else
        system_message="$knowledge"
    fi
fi

# Output CC 2.1.2 compliant JSON
if [ -n "$system_message" ]; then
    jq -n --arg msg "$system_message" '{systemMessage: $msg, continue: true}' 2>/dev/null || \
        echo '{"continue":true,"suppressOutput":true}'
else
    echo '{"continue":true}'
fi

log "Agent context load complete"
exit 0