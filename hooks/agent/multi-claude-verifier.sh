#!/bin/bash
# multi-claude-verifier.sh - Automates multi-Claude verification workflows
# CC 2.1.6 Compliant: includes continue field in all outputs
#
# Purpose:
# 1. Auto-spawn code-quality-reviewer after test-generator completes
# 2. Auto-spawn security-auditor on sensitive file changes
# 3. Enable parallel verification for comprehensive coverage

set -euo pipefail

# Read stdin (the hook input JSON)
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
LOG_DIR="$PROJECT_DIR/.claude/logs/multi-claude"
mkdir -p "$LOG_DIR" 2>/dev/null || true

# Extract agent info from hook input
AGENT_NAME=$(echo "$_HOOK_INPUT" | jq -r '.subagent_type // .agent_type // "unknown"' 2>/dev/null || echo "unknown")
AGENT_OUTPUT=$(echo "$_HOOK_INPUT" | jq -r '.agent_output // .output // ""' 2>/dev/null || echo "")

# Log function
log_action() {
    local action="$1"
    local details="${2:-}"
    local log_file="$LOG_DIR/verifier_$(date +%Y%m%d).log"
    echo "[$TIMESTAMP] [$AGENT_NAME] $action: $details" >> "$log_file"
}

# Check if files touched include sensitive patterns
contains_sensitive_files() {
    local output="$1"
    # Patterns that trigger security review
    local sensitive_patterns=(
        "\.env"
        "auth"
        "secret"
        "credential"
        "password"
        "token"
        "api[_-]?key"
        "jwt"
        "session"
        "oauth"
        "permission"
        "\.pem$"
        "\.key$"
        "config.*prod"
    )

    for pattern in "${sensitive_patterns[@]}"; do
        if echo "$output" | grep -iqE "$pattern"; then
            return 0
        fi
    done
    return 1
}

# Determine verification actions needed
VERIFICATION_ACTIONS=()
VERIFICATION_REASONS=()

# Rule 1: After test-generator, spawn code-quality-reviewer
if [[ "$AGENT_NAME" == "test-generator" ]]; then
    VERIFICATION_ACTIONS+=("code-quality-reviewer")
    VERIFICATION_REASONS+=("Test generation complete - quality review recommended")
    log_action "TRIGGER" "test-generator completion triggers code-quality-reviewer"
fi

# Rule 2: After frontend-ui-developer with form/auth components, spawn security review
if [[ "$AGENT_NAME" == "frontend-ui-developer" ]]; then
    if echo "$AGENT_OUTPUT" | grep -iqE "form|input|validation|submit|auth|login"; then
        VERIFICATION_ACTIONS+=("security-auditor")
        VERIFICATION_REASONS+=("Frontend auth/form components - security review recommended")
        log_action "TRIGGER" "frontend auth components trigger security-auditor"
    fi
fi

# Rule 3: After backend-system-architect with API endpoints, spawn security review
if [[ "$AGENT_NAME" == "backend-system-architect" ]]; then
    if echo "$AGENT_OUTPUT" | grep -iqE "endpoint|route|api|auth|jwt|session"; then
        VERIFICATION_ACTIONS+=("security-auditor")
        VERIFICATION_REASONS+=("Backend API endpoints - security review recommended")
        log_action "TRIGGER" "backend API endpoints trigger security-auditor"
    fi
fi

# Rule 4: Any agent touching sensitive files triggers security-auditor
if contains_sensitive_files "$AGENT_OUTPUT"; then
    # Avoid duplicate if already added
    if [[ ! " ${VERIFICATION_ACTIONS[*]:-} " =~ " security-auditor " ]]; then
        VERIFICATION_ACTIONS+=("security-auditor")
        VERIFICATION_REASONS+=("Sensitive files modified - security review required")
        log_action "TRIGGER" "sensitive file patterns detected"
    fi
fi

# Rule 5: After database-engineer with schema changes, spawn code-quality-reviewer
if [[ "$AGENT_NAME" == "database-engineer" ]]; then
    VERIFICATION_ACTIONS+=("code-quality-reviewer")
    VERIFICATION_REASONS+=("Database schema changes - review for consistency")
    log_action "TRIGGER" "database changes trigger code-quality-reviewer"
fi

# Rule 6: After workflow-architect, spawn security-layer-auditor
if [[ "$AGENT_NAME" == "workflow-architect" ]]; then
    VERIFICATION_ACTIONS+=("security-layer-auditor")
    VERIFICATION_REASONS+=("LangGraph workflow created - layer audit recommended")
    log_action "TRIGGER" "workflow-architect triggers security-layer-auditor"
fi

# Create verification queue file for orchestrator to pick up
if [[ ${#VERIFICATION_ACTIONS[@]} -gt 0 ]]; then
    QUEUE_DIR="$PROJECT_DIR/.claude/context/verification-queue"
    mkdir -p "$QUEUE_DIR" 2>/dev/null || true
    QUEUE_FILE="$QUEUE_DIR/pending_$(date +%Y%m%d_%H%M%S)_${AGENT_NAME}.json"

    # Build JSON array of verifications
    VERIFICATIONS_JSON=$(jq -n \
        --arg from "$AGENT_NAME" \
        --arg timestamp "$TIMESTAMP" \
        --argjson actions "$(printf '%s\n' "${VERIFICATION_ACTIONS[@]}" | jq -R . | jq -s .)" \
        --argjson reasons "$(printf '%s\n' "${VERIFICATION_REASONS[@]}" | jq -R . | jq -s .)" \
        '{
            triggered_by: $from,
            timestamp: $timestamp,
            verifications: [range(0; $actions | length) as $i | {
                agent: $actions[$i],
                reason: $reasons[$i],
                status: "pending"
            }]
        }')

    echo "$VERIFICATIONS_JSON" > "$QUEUE_FILE"

    # Create system message with recommendations
    RECOMMENDATION_MSG="Multi-Claude Verification Triggered: "
    for i in "${!VERIFICATION_ACTIONS[@]}"; do
        RECOMMENDATION_MSG+="${VERIFICATION_ACTIONS[$i]} (${VERIFICATION_REASONS[$i]}); "
    done

    log_action "QUEUE" "Created verification queue: $QUEUE_FILE"

    # Output with recommendation
    jq -n \
        --arg msg "$RECOMMENDATION_MSG" \
        --arg queue "$QUEUE_FILE" \
        '{
            systemMessage: $msg,
            verification_queue: $queue,
            continue: true
        }'
else
    log_action "SKIP" "No verification triggers matched"
    echo '{"continue":true}'
fi

exit 0