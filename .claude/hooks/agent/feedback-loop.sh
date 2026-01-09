#!/bin/bash
# Hook: feedback-loop.sh
# Trigger: SubagentStop - fires when any agent completes
# Purpose: Captures agent completion context, routes findings to relevant downstream agents, logs to decision-log.json
#
# CC 2.1.2 Compliant: includes continue field in all outputs

set -euo pipefail

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

# Constants
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DECISION_LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/coordination/decision-log.json"
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs"
FEEDBACK_LOG="$LOG_DIR/agent-feedback.log"

# Ensure directories exist
mkdir -p "$(dirname "$DECISION_LOG")" 2>/dev/null || true
mkdir -p "$LOG_DIR" 2>/dev/null || true

# Extract agent information from hook input
AGENT_TYPE=$(echo "$_HOOK_INPUT" | jq -r '.subagent_type // .agent_type // "unknown"' 2>/dev/null || echo "unknown")
SESSION_ID=$(echo "$_HOOK_INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
AGENT_OUTPUT=$(echo "$_HOOK_INPUT" | jq -r '.agent_output // .output // ""' 2>/dev/null || echo "")
ERROR=$(echo "$_HOOK_INPUT" | jq -r '.error // ""' 2>/dev/null || echo "")

# Use CLAUDE_AGENT_ID if available
AGENT_ID="${CLAUDE_AGENT_ID:-$AGENT_TYPE}"

# Generate unique decision ID
DECISION_ID="DEC-$(date +%Y%m%d)-$(printf "%04d" $((RANDOM % 10000)))"

# Log the feedback loop action
log_feedback() {
    local message="$1"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [feedback-loop] $message" >> "$FEEDBACK_LOG"
}

# Determine downstream agents based on completed agent type
get_downstream_agents() {
    local agent="$1"
    case "$agent" in
        # Product thinking pipeline
        "market-intelligence") echo "product-strategist" ;;
        "product-strategist") echo "prioritization-analyst" ;;
        "prioritization-analyst") echo "business-case-builder" ;;
        "business-case-builder") echo "requirements-translator" ;;
        "requirements-translator") echo "metrics-architect" ;;
        "metrics-architect") echo "backend-system-architect" ;;

        # Full-stack pipeline
        "backend-system-architect") echo "frontend-ui-developer database-engineer" ;;
        "frontend-ui-developer") echo "test-generator" ;;
        "test-generator") echo "code-quality-reviewer" ;;
        "code-quality-reviewer") echo "security-auditor" ;;

        # AI integration pipeline
        "workflow-architect") echo "llm-integrator" ;;
        "llm-integrator") echo "data-pipeline-engineer" ;;
        "data-pipeline-engineer") echo "code-quality-reviewer" ;;

        # Database pipeline
        "database-engineer") echo "backend-system-architect" ;;

        # UI pipeline
        "rapid-ui-designer") echo "frontend-ui-developer" ;;
        "ux-researcher") echo "rapid-ui-designer" ;;

        # Terminal agents - no downstream
        "security-auditor"|"security-layer-auditor"|"debug-investigator"|"system-design-reviewer")
            echo ""
            ;;
        *)
            echo ""
            ;;
    esac
}

# Categorize the feedback based on agent type
get_feedback_category() {
    local agent="$1"
    case "$agent" in
        "market-intelligence"|"product-strategist"|"prioritization-analyst"|"business-case-builder")
            echo "product-thinking"
            ;;
        "requirements-translator"|"metrics-architect")
            echo "specification"
            ;;
        "backend-system-architect"|"database-engineer"|"data-pipeline-engineer")
            echo "architecture"
            ;;
        "frontend-ui-developer"|"rapid-ui-designer"|"ux-researcher")
            echo "frontend"
            ;;
        "test-generator"|"code-quality-reviewer")
            echo "quality"
            ;;
        "security-auditor"|"security-layer-auditor")
            echo "security"
            ;;
        "workflow-architect"|"llm-integrator")
            echo "ai-integration"
            ;;
        "debug-investigator")
            echo "debugging"
            ;;
        *)
            echo "general"
            ;;
    esac
}

# Extract key findings from agent output (first 500 chars for summary)
extract_findings_summary() {
    local output="$1"
    local summary
    summary=$(echo "$output" | head -c 500)
    if [[ ${#output} -gt 500 ]]; then
        summary="${summary}..."
    fi
    echo "$summary"
}

# Write decision to decision-log.json
write_decision() {
    local category="$1"
    local summary="$2"
    local downstream="$3"
    local status="$4"

    # Check if decision log exists, initialize if not
    if [[ ! -f "$DECISION_LOG" ]]; then
        jq -n '{
            schema_version: "1.0.0",
            log_created_at: "'$TIMESTAMP'",
            decisions: []
        }' > "$DECISION_LOG" 2>/dev/null || {
            log_feedback "ERROR: Failed to initialize decision log"
            return 1
        }
    fi

    # Create the decision entry
    local decision_entry
    decision_entry=$(jq -n \
        --arg decision_id "$DECISION_ID" \
        --arg timestamp "$TIMESTAMP" \
        --arg instance_id "${CLAUDE_INSTANCE_ID:-$(hostname)-$$}" \
        --arg category "$category" \
        --arg title "Agent $AGENT_TYPE completed" \
        --arg description "$summary" \
        --arg downstream "$downstream" \
        --arg status "$status" \
        '{
            decision_id: $decision_id,
            timestamp: $timestamp,
            made_by: {
                instance_id: $instance_id,
                agent_type: "'"$AGENT_TYPE"'"
            },
            category: $category,
            title: $title,
            description: $description,
            impact: {
                scope: "agent-pipeline",
                downstream_agents: ($downstream | split(" ") | map(select(. != "")))
            },
            status: $status
        }')

    # Append to decisions array
    local temp_file
    temp_file=$(mktemp)
    if jq --argjson entry "$decision_entry" '.decisions += [$entry]' "$DECISION_LOG" > "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$DECISION_LOG"
        log_feedback "Decision $DECISION_ID logged for agent $AGENT_TYPE"
    else
        rm -f "$temp_file"
        log_feedback "ERROR: Failed to write decision to log"
        return 1
    fi
}

# Create handoff context for downstream agents
create_handoff_context() {
    local downstream_agents="$1"
    local summary="$2"

    if [[ -z "$downstream_agents" ]]; then
        return 0
    fi

    local handoff_dir="${CLAUDE_PROJECT_DIR:-.}/.claude/context/handoffs"
    mkdir -p "$handoff_dir" 2>/dev/null || true

    for downstream in $downstream_agents; do
        local handoff_file="$handoff_dir/${AGENT_TYPE}_to_${downstream}_$(date +%Y%m%d_%H%M%S).json"

        jq -n \
            --arg from "$AGENT_TYPE" \
            --arg to "$downstream" \
            --arg timestamp "$TIMESTAMP" \
            --arg decision_id "$DECISION_ID" \
            --arg summary "$summary" \
            --arg session_id "$SESSION_ID" \
            '{
                from_agent: $from,
                to_agent: $to,
                timestamp: $timestamp,
                decision_id: $decision_id,
                summary: $summary,
                session_id: $session_id,
                status: "pending",
                feedback_loop: true
            }' > "$handoff_file" 2>/dev/null || true

        log_feedback "Created handoff context: $AGENT_TYPE -> $downstream"
    done
}

# Main logic
main() {
    log_feedback "Processing feedback for agent: $AGENT_TYPE (session: $SESSION_ID)"

    # Skip if unknown agent type
    if [[ "$AGENT_TYPE" == "unknown" || -z "$AGENT_TYPE" ]]; then
        log_feedback "Skipping unknown agent type"
        echo '{"continue":true}'
        exit 0
    fi

    # Determine downstream agents
    local downstream_agents
    downstream_agents=$(get_downstream_agents "$AGENT_TYPE")

    # Get feedback category
    local category
    category=$(get_feedback_category "$AGENT_TYPE")

    # Extract findings summary
    local summary
    if [[ -n "$ERROR" && "$ERROR" != "null" ]]; then
        summary="Agent failed: $ERROR"
        status="failed"
    else
        summary=$(extract_findings_summary "$AGENT_OUTPUT")
        status="completed"
    fi

    # Write to decision log
    write_decision "$category" "$summary" "$downstream_agents" "$status"

    # Create handoff context for downstream agents
    if [[ -n "$downstream_agents" ]]; then
        create_handoff_context "$downstream_agents" "$summary"
        log_feedback "Routed findings to downstream agents: $downstream_agents"
    else
        log_feedback "No downstream agents for $AGENT_TYPE (terminal agent)"
    fi

    # Log completion
    {
        echo "=== AGENT FEEDBACK LOOP ==="
        echo "Agent: $AGENT_TYPE"
        echo "Category: $category"
        echo "Decision ID: $DECISION_ID"
        echo "Timestamp: $TIMESTAMP"
        echo "Status: $status"
        echo "Downstream: ${downstream_agents:-none}"
        echo ""
        echo "Summary: $summary"
    } >> "$FEEDBACK_LOG"

    # Output CC 2.1.2 compliant JSON
    if [[ -n "$downstream_agents" ]]; then
        jq -n --arg agents "$downstream_agents" \
            '{systemMessage: "Feedback loop: routed to \($agents)", continue: true}'
    else
        echo '{"systemMessage":"Feedback loop: terminal agent - no routing","continue":true}'
    fi
}

main
exit 0