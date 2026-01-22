#!/usr/bin/env bash
# OrchestKit Configuration Loader
# Reads config.json and exports enabled/disabled items
# Version: 1.0.1
# FIX: Use proper null checking instead of // operator for boolean values

set -euo pipefail

# Configuration paths
ORCHESTKIT_ROOT="${ORCHESTKIT_ROOT:-$HOME/.claude/plugins/orchestkit}"
CONFIG_FILE="${ORCHESTKIT_CONFIG:-$ORCHESTKIT_ROOT/config.json}"
DEFAULT_CONFIG="$ORCHESTKIT_ROOT/.claude/defaults/config.json"

# -----------------------------------------------------------------------------
# Helper: Get boolean value with proper null handling
# jq's // operator treats false as falsy, so we need explicit null check
# -----------------------------------------------------------------------------
get_bool() {
    local json="$1"
    local path="$2"
    local default="$3"
    echo "$json" | jq -r "if $path == null then \"$default\" else ($path | tostring) end"
}

# -----------------------------------------------------------------------------
# Load Configuration
# -----------------------------------------------------------------------------
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        cat "$CONFIG_FILE"
    elif [[ -f "$DEFAULT_CONFIG" ]]; then
        cat "$DEFAULT_CONFIG"
    else
        # Return default complete preset
        cat << 'EOF'
{
  "version": "1.0.0",
  "preset": "complete",
  "customized": false,
  "skills": {
    "ai_ml": true,
    "backend": true,
    "frontend": true,
    "testing": true,
    "security": true,
    "devops": true,
    "planning": true,
    "disabled": []
  },
  "agents": {
    "product": true,
    "technical": true,
    "disabled": []
  },
  "hooks": {
    "safety": true,
    "productivity": true,
    "quality_gates": true,
    "team_coordination": true,
    "notifications": false,
    "disabled": []
  },
  "commands": {
    "enabled": true,
    "disabled": []
  }
}
EOF
    fi
}

# -----------------------------------------------------------------------------
# Check if skill is enabled
# -----------------------------------------------------------------------------
is_skill_enabled() {
    local skill_id="$1"
    local config
    config=$(load_config)
    
    # Check if individually disabled
    if echo "$config" | jq -e ".skills.disabled | index(\"$skill_id\")" > /dev/null 2>&1; then
        return 1
    fi
    
    # Check category (map skill to category)
    local category
    category=$(get_skill_category "$skill_id")
    
    if [[ -n "$category" ]]; then
        local enabled
        enabled=$(get_bool "$config" ".skills.$category" "true")
        [[ "$enabled" == "true" ]]
        return $?
    fi
    
    return 0  # Default enabled
}

# -----------------------------------------------------------------------------
# Check if agent is enabled
# -----------------------------------------------------------------------------
is_agent_enabled() {
    local agent_id="$1"
    local config
    config=$(load_config)
    
    # Check if individually disabled
    if echo "$config" | jq -e ".agents.disabled | index(\"$agent_id\")" > /dev/null 2>&1; then
        return 1
    fi
    
    # Check category
    local category
    category=$(get_agent_category "$agent_id")
    
    if [[ -n "$category" ]]; then
        local enabled
        enabled=$(get_bool "$config" ".agents.$category" "true")
        [[ "$enabled" == "true" ]]
        return $?
    fi
    
    return 0
}

# -----------------------------------------------------------------------------
# Check if hook is enabled
# -----------------------------------------------------------------------------
is_hook_enabled() {
    local hook_name="$1"
    local config
    config=$(load_config)
    
    # Safety hooks are ALWAYS enabled
    local safety_hooks=("git-branch-protection.sh" "file-guard.sh" "redact-secrets.sh")
    for safety in "${safety_hooks[@]}"; do
        if [[ "$hook_name" == *"$safety"* ]]; then
            return 0  # Always enabled
        fi
    done
    
    # Check if individually disabled
    if echo "$config" | jq -e ".hooks.disabled | index(\"$hook_name\")" > /dev/null 2>&1; then
        return 1
    fi
    
    # Check category
    local category
    category=$(get_hook_category "$hook_name")
    
    if [[ -n "$category" ]]; then
        local enabled
        # Notifications default to false, others default to true
        local default="true"
        [[ "$category" == "notifications" ]] && default="false"
        enabled=$(get_bool "$config" ".hooks.$category" "$default")
        [[ "$enabled" == "true" ]]
        return $?
    fi
    
    return 0
}

# -----------------------------------------------------------------------------
# Check if command is enabled
# -----------------------------------------------------------------------------
is_command_enabled() {
    local command_id="$1"
    local config
    config=$(load_config)
    
    # Check if commands are enabled
    local commands_enabled
    commands_enabled=$(get_bool "$config" ".commands.enabled" "true")
    if [[ "$commands_enabled" != "true" ]]; then
        return 1
    fi
    
    # Check if individually disabled
    if echo "$config" | jq -e ".commands.disabled | index(\"$command_id\")" > /dev/null 2>&1; then
        return 1
    fi
    
    return 0
}

# -----------------------------------------------------------------------------
# Get skill category
# -----------------------------------------------------------------------------
get_skill_category() {
    local skill_id="$1"
    
    # AI/ML skills
    local ai_ml_skills="agent-loops|rag-retrieval|embeddings|function-calling|multi-agent-orchestration|ollama-local|prompt-caching|semantic-caching|cache-cost-tracking|llm-streaming|llm-evaluation|llm-testing|llm-safety-patterns|context-engineering|context-compression|langfuse-observability|langgraph-functional|langgraph-supervisor|langgraph-routing|langgraph-parallel|langgraph-state|langgraph-checkpoints|langgraph-human-in-loop|contextual-retrieval|hyde-retrieval|query-decomposition|reranking-patterns"
    
    # Backend skills
    local backend_skills="fastapi-advanced|clean-architecture|api-design-framework|api-versioning|rate-limiting|background-jobs|caching-strategies|database-schema-designer|resilience-patterns|streaming-api-patterns|mcp-server-building|observability-monitoring|error-handling-rfc9457|pgvector-search"
    
    # Frontend skills
    local frontend_skills="react-server-components-framework|edge-computing-patterns|design-system-starter|motion-animation-patterns|i18n-date-patterns|type-safety-validation|performance-optimization|browser-content-capture"
    
    # Testing skills
    local testing_skills="unit-testing|integration-testing|e2e-testing|performance-testing|webapp-testing|msw-mocking|vcr-http-recording|test-data-management|test-standards-enforcer|evidence-verification|quality-gates|golden-dataset-curation|golden-dataset-management|golden-dataset-validation"
    
    # Security skills
    local security_skills="owasp-top-10|auth-patterns|input-validation|security-scanning|defense-in-depth"
    
    # DevOps skills
    local devops_skills="devops-deployment|worktree-coordination|github-cli"
    
    # Planning skills
    local planning_skills="brainstorming|system-design-interrogation|architecture-decision-record|ascii-visualizer|project-structure-enforcer|code-review-playbook"
    
    if echo "$skill_id" | grep -qE "^($ai_ml_skills)$"; then
        echo "ai_ml"
    elif echo "$skill_id" | grep -qE "^($backend_skills)$"; then
        echo "backend"
    elif echo "$skill_id" | grep -qE "^($frontend_skills)$"; then
        echo "frontend"
    elif echo "$skill_id" | grep -qE "^($testing_skills)$"; then
        echo "testing"
    elif echo "$skill_id" | grep -qE "^($security_skills)$"; then
        echo "security"
    elif echo "$skill_id" | grep -qE "^($devops_skills)$"; then
        echo "devops"
    elif echo "$skill_id" | grep -qE "^($planning_skills)$"; then
        echo "planning"
    else
        echo ""
    fi
}

# -----------------------------------------------------------------------------
# Get agent category
# -----------------------------------------------------------------------------
get_agent_category() {
    local agent_id="$1"
    
    local product_agents="market-intelligence|product-strategist|requirements-translator|ux-researcher|prioritization-analyst|business-case-builder"
    local technical_agents="backend-system-architect|frontend-ui-developer|database-engineer|llm-integrator|workflow-architect|data-pipeline-engineer|test-generator|code-quality-reviewer|security-auditor|security-layer-auditor|debug-investigator|metrics-architect|rapid-ui-designer|system-design-reviewer"
    
    if echo "$agent_id" | grep -qE "^($product_agents)$"; then
        echo "product"
    elif echo "$agent_id" | grep -qE "^($technical_agents)$"; then
        echo "technical"
    else
        echo ""
    fi
}

# -----------------------------------------------------------------------------
# Get hook category
# -----------------------------------------------------------------------------
get_hook_category() {
    local hook_name="$1"
    
    # Productivity hooks
    if echo "$hook_name" | grep -qE "(auto-approve|audit-logger|error-tracker)"; then
        echo "productivity"
        return
    fi
    
    # Quality gate hooks
    if echo "$hook_name" | grep -qE "(coverage|pattern|validator|enforcer|quality-gate)"; then
        echo "quality_gates"
        return
    fi
    
    # Team coordination hooks
    if echo "$hook_name" | grep -qE "(multi-instance|file-lock|conflict|coordination|worktree)"; then
        echo "team_coordination"
        return
    fi
    
    # Notification hooks
    if echo "$hook_name" | grep -qE "(desktop|sound|notification)"; then
        echo "notifications"
        return
    fi
    
    echo ""
}

# -----------------------------------------------------------------------------
# Get preset info
# -----------------------------------------------------------------------------
get_preset() {
    local config
    config=$(load_config)
    echo "$config" | jq -r 'if .preset == null then "complete" else .preset end'
}

# -----------------------------------------------------------------------------
# Get summary
# -----------------------------------------------------------------------------
get_summary() {
    local config
    config=$(load_config)
    
    local preset
    preset=$(echo "$config" | jq -r 'if .preset == null then "complete" else .preset end')
    
    echo "OrchestKit Configuration"
    echo "------------------------"
    echo "Preset: $preset"
    echo ""
    echo "Skills:"
    echo "  AI/ML:    $(get_bool "$config" '.skills.ai_ml' 'true')"
    echo "  Backend:  $(get_bool "$config" '.skills.backend' 'true')"
    echo "  Frontend: $(get_bool "$config" '.skills.frontend' 'true')"
    echo "  Testing:  $(get_bool "$config" '.skills.testing' 'true')"
    echo "  Security: $(get_bool "$config" '.skills.security' 'true')"
    echo "  DevOps:   $(get_bool "$config" '.skills.devops' 'true')"
    echo "  Planning: $(get_bool "$config" '.skills.planning' 'true')"
    echo ""
    echo "Agents:"
    echo "  Product:   $(get_bool "$config" '.agents.product' 'true')"
    echo "  Technical: $(get_bool "$config" '.agents.technical' 'true')"
    echo ""
    echo "Hooks:"
    echo "  Safety:       always on"
    echo "  Productivity: $(get_bool "$config" '.hooks.productivity' 'true')"
    echo "  Quality:      $(get_bool "$config" '.hooks.quality_gates' 'true')"
    echo "  Team:         $(get_bool "$config" '.hooks.team_coordination' 'true')"
    echo "  Notifications: $(get_bool "$config" '.hooks.notifications' 'false')"
}

# -----------------------------------------------------------------------------
# Main - handle commands
# -----------------------------------------------------------------------------
case "${1:-}" in
    is-skill-enabled)
        is_skill_enabled "${2:-}" && echo "true" || echo "false"
        ;;
    is-agent-enabled)
        is_agent_enabled "${2:-}" && echo "true" || echo "false"
        ;;
    is-hook-enabled)
        is_hook_enabled "${2:-}" && echo "true" || echo "false"
        ;;
    is-command-enabled)
        is_command_enabled "${2:-}" && echo "true" || echo "false"
        ;;
    get-preset)
        get_preset
        ;;
    summary)
        get_summary
        ;;
    load)
        load_config
        ;;
    *)
        echo "Usage: $0 {is-skill-enabled|is-agent-enabled|is-hook-enabled|is-command-enabled|get-preset|summary|load} [id]"
        exit 1
        ;;
esac
