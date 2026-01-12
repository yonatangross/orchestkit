#!/bin/bash
# Hook: auto-spawn-quality.sh
# Trigger: SubagentStop - fires when any agent completes
# Purpose: Auto-spawns code-quality-reviewer after test-generator completes,
#          Auto-spawns security-auditor on sensitive file changes (.env, auth, secrets)
#
# CC 2.1.2 Compliant: includes continue field in all outputs

set -euo pipefail

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

# Constants
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs"
SPAWN_LOG="$LOG_DIR/auto-spawn-quality.log"
SPAWN_QUEUE="${CLAUDE_PROJECT_DIR:-.}/.claude/context/spawn-queue.json"

# Ensure directories exist
mkdir -p "$LOG_DIR" 2>/dev/null || true
mkdir -p "$(dirname "$SPAWN_QUEUE")" 2>/dev/null || true

# Extract agent information from hook input
AGENT_TYPE=$(echo "$_HOOK_INPUT" | jq -r '.subagent_type // .agent_type // "unknown"' 2>/dev/null || echo "unknown")
SESSION_ID=$(echo "$_HOOK_INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
AGENT_OUTPUT=$(echo "$_HOOK_INPUT" | jq -r '.agent_output // .output // ""' 2>/dev/null || echo "")
ERROR=$(echo "$_HOOK_INPUT" | jq -r '.error // ""' 2>/dev/null || echo "")

# Use CLAUDE_AGENT_ID if available
AGENT_ID="${CLAUDE_AGENT_ID:-$AGENT_TYPE}"

# Log function
log_spawn() {
    local message="$1"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [auto-spawn-quality] $message" >> "$SPAWN_LOG"
}

# Patterns for sensitive files that trigger security-auditor
SENSITIVE_PATTERNS=(
    ".env"
    "credentials"
    "secret"
    "auth"
    "password"
    "token"
    "api.key"
    "private.key"
    ".pem"
    "oauth"
    "jwt"
    "session"
    "cookie"
    "encryption"
    "crypto"
)

# Check if agent output contains sensitive file references
contains_sensitive_files() {
    local output="$1"
    local lower_output
    lower_output=$(echo "$output" | tr '[:upper:]' '[:lower:]')

    for pattern in "${SENSITIVE_PATTERNS[@]}"; do
        if echo "$lower_output" | grep -q "$pattern"; then
            log_spawn "Detected sensitive pattern: $pattern"
            return 0
        fi
    done
    return 1
}

# Queue an agent spawn request
queue_spawn() {
    local target_agent="$1"
    local trigger_reason="$2"
    local priority="${3:-normal}"

    local spawn_id="SPAWN-$(date +%Y%m%d%H%M%S)-$(printf "%04d" $((RANDOM % 10000)))"

    # Initialize spawn queue if it doesn't exist
    if [[ ! -f "$SPAWN_QUEUE" ]]; then
        jq -n '{
            schema_version: "1.0.0",
            created_at: "'$TIMESTAMP'",
            queue: []
        }' > "$SPAWN_QUEUE" 2>/dev/null || true
    fi

    # Create spawn request
    local spawn_request
    spawn_request=$(jq -n \
        --arg spawn_id "$spawn_id" \
        --arg target "$target_agent" \
        --arg trigger_agent "$AGENT_TYPE" \
        --arg trigger_reason "$trigger_reason" \
        --arg priority "$priority" \
        --arg timestamp "$TIMESTAMP" \
        --arg session_id "$SESSION_ID" \
        '{
            spawn_id: $spawn_id,
            target_agent: $target,
            trigger_agent: $trigger_agent,
            trigger_reason: $trigger_reason,
            priority: $priority,
            timestamp: $timestamp,
            session_id: $session_id,
            status: "queued"
        }')

    # Append to queue
    local temp_file
    temp_file=$(mktemp)
    if jq --argjson req "$spawn_request" '.queue += [$req]' "$SPAWN_QUEUE" > "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$SPAWN_QUEUE"
        log_spawn "Queued spawn request: $spawn_id for $target_agent (reason: $trigger_reason)"
        echo "$spawn_id"
    else
        rm -f "$temp_file"
        log_spawn "ERROR: Failed to queue spawn request for $target_agent"
        echo ""
    fi
}

# Write spawn suggestion to handoff context (for orchestrator to pick up)
write_spawn_suggestion() {
    local target_agent="$1"
    local trigger_reason="$2"
    local priority="${3:-normal}"

    local handoff_dir="${CLAUDE_PROJECT_DIR:-.}/.claude/context/handoffs"
    mkdir -p "$handoff_dir" 2>/dev/null || true

    local suggestion_file="$handoff_dir/auto_spawn_${target_agent}_$(date +%Y%m%d_%H%M%S).json"

    jq -n \
        --arg from "$AGENT_TYPE" \
        --arg to "$target_agent" \
        --arg timestamp "$TIMESTAMP" \
        --arg reason "$trigger_reason" \
        --arg priority "$priority" \
        --arg session_id "$SESSION_ID" \
        '{
            type: "auto_spawn_suggestion",
            from_agent: $from,
            to_agent: $to,
            timestamp: $timestamp,
            trigger_reason: $reason,
            priority: $priority,
            session_id: $session_id,
            auto_triggered: true,
            status: "suggested"
        }' > "$suggestion_file" 2>/dev/null || true

    log_spawn "Created spawn suggestion: $target_agent (reason: $trigger_reason)"
}

# Determine if we should auto-spawn and which agent
check_auto_spawn_conditions() {
    local spawn_target=""
    local spawn_reason=""
    local spawn_priority="normal"

    # Skip if agent had errors
    if [[ -n "$ERROR" && "$ERROR" != "null" ]]; then
        log_spawn "Skipping auto-spawn - agent $AGENT_TYPE had errors: $ERROR"
        return
    fi

    # Rule 1: test-generator completion -> code-quality-reviewer
    if [[ "$AGENT_TYPE" == "test-generator" ]]; then
        spawn_target="code-quality-reviewer"
        spawn_reason="test-generator completed - validating test quality and coverage"
        spawn_priority="high"
        log_spawn "Rule matched: test-generator -> code-quality-reviewer"
    fi

    # Rule 2: Any agent with sensitive file changes -> security-auditor
    if contains_sensitive_files "$AGENT_OUTPUT"; then
        # Only spawn security-auditor if we're not already the security-auditor
        if [[ "$AGENT_TYPE" != "security-auditor" && "$AGENT_TYPE" != "security-layer-auditor" ]]; then
            spawn_target="security-auditor"
            spawn_reason="sensitive file changes detected - security audit required"
            spawn_priority="critical"
            log_spawn "Rule matched: sensitive files detected -> security-auditor"
        fi
    fi

    # Rule 3: code-quality-reviewer completion -> security-auditor (if not already triggered)
    if [[ "$AGENT_TYPE" == "code-quality-reviewer" && -z "$spawn_target" ]]; then
        spawn_target="security-auditor"
        spawn_reason="code-quality-reviewer completed - proceeding with security scan"
        spawn_priority="high"
        log_spawn "Rule matched: code-quality-reviewer -> security-auditor"
    fi

    # Rule 4: backend-system-architect with auth/security mentions -> security-layer-auditor
    if [[ "$AGENT_TYPE" == "backend-system-architect" ]]; then
        local lower_output
        lower_output=$(echo "$AGENT_OUTPUT" | tr '[:upper:]' '[:lower:]')
        if echo "$lower_output" | grep -qE "(authentication|authorization|security|access.control|rbac|acl)"; then
            spawn_target="security-layer-auditor"
            spawn_reason="backend-system-architect designed auth/security layer - validation required"
            spawn_priority="high"
            log_spawn "Rule matched: backend-system-architect with auth -> security-layer-auditor"
        fi
    fi

    # Output spawn targets
    echo "${spawn_target}|${spawn_reason}|${spawn_priority}"
}

# Main logic
main() {
    log_spawn "Checking auto-spawn conditions for agent: $AGENT_TYPE (session: $SESSION_ID)"

    # Skip if unknown agent type
    if [[ "$AGENT_TYPE" == "unknown" || -z "$AGENT_TYPE" ]]; then
        log_spawn "Skipping unknown agent type"
        echo '{"continue":true}'
        exit 0
    fi

    # Check auto-spawn conditions
    local spawn_info
    spawn_info=$(check_auto_spawn_conditions)

    local spawn_target spawn_reason spawn_priority
    spawn_target=$(echo "$spawn_info" | cut -d'|' -f1)
    spawn_reason=$(echo "$spawn_info" | cut -d'|' -f2)
    spawn_priority=$(echo "$spawn_info" | cut -d'|' -f3)

    if [[ -n "$spawn_target" ]]; then
        # Queue the spawn request
        local spawn_id
        spawn_id=$(queue_spawn "$spawn_target" "$spawn_reason" "$spawn_priority")

        # Also write a spawn suggestion for the orchestrator
        write_spawn_suggestion "$spawn_target" "$spawn_reason" "$spawn_priority"

        # Log the action
        {
            echo "=== AUTO-SPAWN QUALITY HOOK ==="
            echo "Trigger Agent: $AGENT_TYPE"
            echo "Target Agent: $spawn_target"
            echo "Reason: $spawn_reason"
            echo "Priority: $spawn_priority"
            echo "Spawn ID: $spawn_id"
            echo "Timestamp: $TIMESTAMP"
            echo "Session: $SESSION_ID"
        } >> "$SPAWN_LOG"

        # Output CC 2.1.2 compliant JSON with spawn suggestion
        jq -n \
            --arg target "$spawn_target" \
            --arg reason "$spawn_reason" \
            --arg priority "$spawn_priority" \
            '{
                systemMessage: "Auto-spawn queued: \($target) (\($priority) priority)",
                continue: true,
                spawn_suggestion: {
                    agent: $target,
                    reason: $reason,
                    priority: $priority
                }
            }'
    else
        log_spawn "No auto-spawn conditions matched for $AGENT_TYPE"
        echo '{"continue":true,"suppressOutput":true}'
    fi
}

main
exit 0