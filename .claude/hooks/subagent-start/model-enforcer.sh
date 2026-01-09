#!/bin/bash
# Model Enforcer - Displays model preferences for agents
# Hook: SubagentStart
# CC 2.1.2 Compliant: includes continue field in all outputs
#
# Reads agent's model_preference from plugin.json and shows available options.

set -euo pipefail

# Read stdin immediately
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PLUGIN_FILE="$PROJECT_ROOT/plugin.json"
LOG_FILE="$PROJECT_ROOT/.claude/logs/model-enforcement.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# ANSI colors
RED=$'\033[31m'
YELLOW=$'\033[33m'
GREEN=$'\033[32m'
CYAN=$'\033[36m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

# Extract agent type from hook input (SubagentStart uses 'agent_type')
AGENT_TYPE=$(echo "$_HOOK_INPUT" | jq -r '.agent_type // empty' 2>/dev/null || echo "")

# If no agent_type, allow through
if [[ -z "$AGENT_TYPE" || "$AGENT_TYPE" == "null" ]]; then
    echo '{"continue":true}'
    exit 0
fi

# Skip enforcement for built-in agent types
BUILTIN_AGENTS="general-purpose|Explore|Plan|claude-code-guide|statusline-setup|Bash"
if [[ "$AGENT_TYPE" =~ ^($BUILTIN_AGENTS)$ ]]; then
    log "Skipping model enforcement for built-in agent: $AGENT_TYPE"
    echo '{"continue":true}'
    exit 0
fi

# Check if plugin.json exists
if [[ ! -f "$PLUGIN_FILE" ]]; then
    log "WARNING: plugin.json not found, skipping model enforcement"
    echo '{"continue":true}'
    exit 0
fi

# Get agent's model preference from plugin.json
MODEL_PREF=$(jq -r ".agents[] | select(.id==\"$AGENT_TYPE\") | .model_preference // {}" "$PLUGIN_FILE" 2>/dev/null || echo "{}")

if [[ "$MODEL_PREF" == "{}" || -z "$MODEL_PREF" ]]; then
    log "No model preference defined for agent: $AGENT_TYPE"
    echo '{"continue":true}'
    exit 0
fi

# Get the default model based on agent type
get_default_model() {
    # Agents that default to opus (complex reasoning)
    case "$AGENT_TYPE" in
        workflow-architect|security-layer-auditor|system-design-reviewer)
            echo "opus"
            return
            ;;
    esac

    # Check if agent has opus tasks defined
    has_opus=$(echo "$MODEL_PREF" | jq -r 'to_entries | map(select(.value=="opus")) | length' 2>/dev/null || echo "0")
    if [[ "$has_opus" -gt 0 ]]; then
        echo "sonnet"  # Default to sonnet, but opus available for complex tasks
        return
    fi

    # Default is sonnet
    echo "sonnet"
}

DEFAULT_MODEL=$(get_default_model)

log "Agent: $AGENT_TYPE | Default: $DEFAULT_MODEL | Preferences: $(echo "$MODEL_PREF" | jq -c '.')"

# Build model guidance message
MODEL_GUIDE="${BOLD}Model Guidance for ${CYAN}$AGENT_TYPE${RESET}:"

# Add default recommendation
case "$DEFAULT_MODEL" in
    opus)
        MODEL_GUIDE="$MODEL_GUIDE
${RED}[OPUS]${RESET} This agent requires ${BOLD}opus${RESET} for best results"
        ;;
    haiku)
        MODEL_GUIDE="$MODEL_GUIDE
${GREEN}[HAIKU]${RESET} This agent works well with ${BOLD}haiku${RESET}"
        ;;
    *)
        MODEL_GUIDE="$MODEL_GUIDE
${YELLOW}[SONNET]${RESET} Default: ${BOLD}sonnet${RESET}"
        ;;
esac

# Add available model options for this agent
MODEL_OPTIONS=$(echo "$MODEL_PREF" | jq -r 'to_entries | group_by(.value) | map({model: .[0].value, tasks: [.[].key]}) | .[] | "  \(.model): \(.tasks | join(", "))"' 2>/dev/null || echo "")

if [[ -n "$MODEL_OPTIONS" ]]; then
    MODEL_GUIDE="$MODEL_GUIDE

${BOLD}Available modes:${RESET}
$MODEL_OPTIONS"
fi

# Output CC 2.1.2 compliant JSON with model guidance
jq -n \
    --arg msg "$MODEL_GUIDE" \
    --arg default "$DEFAULT_MODEL" \
    --arg agent "$AGENT_TYPE" \
    '{
        systemMessage: $msg,
        continue: true,
        hookSpecificOutput: {
            default_model: $default,
            agent_type: $agent
        }
    }'

exit 0