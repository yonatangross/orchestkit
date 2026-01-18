#!/bin/bash
# Decision Entity Extractor Hook
# Extracts entities (Agent, Technology, Pattern, Constraint) from decisions
# and suggests graph memory relationships for knowledge graph building
#
# Part of Mem0 Pro Integration - Phase 2
# CC 2.1.7 Compliant: includes continue field in all outputs
#
# Entity Types:
# - Agent: SkillForge agents (database-engineer, security-auditor, etc.)
# - Technology: Tech stack choices (PostgreSQL, FastAPI, pgvector, etc.)
# - Pattern: Design patterns (cursor-pagination, repository-pattern, etc.)
# - Constraint: Business/technical constraints
#
# Relation Types:
# - RECOMMENDS: Agent -> Technology/Pattern
# - CHOSEN_FOR: Decision -> Technology/Pattern
# - REPLACES: New choice -> Old choice
# - CONFLICTS_WITH: Pattern -> Anti-pattern
#
# Version: 1.0.0

set -euo pipefail

# Read stdin BEFORE sourcing libraries
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source mem0 library
source "$SCRIPT_DIR/../_lib/mem0.sh" 2>/dev/null || {
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || true

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Known SkillForge agents
KNOWN_AGENTS=(
    "database-engineer"
    "backend-system-architect"
    "frontend-ui-developer"
    "security-auditor"
    "test-generator"
    "workflow-architect"
    "llm-integrator"
    "data-pipeline-engineer"
    "metrics-architect"
    "ux-researcher"
    "code-quality-reviewer"
    "requirements-translator"
    "prioritization-analyst"
    "rapid-ui-designer"
    "market-intelligence"
    "ci-cd-engineer"
    "infrastructure-architect"
    "accessibility-specialist"
    "deployment-manager"
    "git-operations-engineer"
)

# Known technologies (common tech stack choices)
KNOWN_TECHNOLOGIES=(
    # Databases
    "postgresql" "postgres" "pgvector" "redis" "mongodb" "sqlite"
    # Backend frameworks
    "fastapi" "django" "flask" "express" "nestjs"
    # Frontend frameworks
    "react" "vue" "angular" "nextjs" "remix" "svelte"
    # Languages
    "python" "typescript" "javascript" "rust" "go"
    # Auth
    "jwt" "oauth" "oauth2" "passkeys" "webauthn"
    # AI/ML
    "langchain" "langgraph" "openai" "anthropic" "ollama" "langfuse"
    # Infrastructure
    "docker" "kubernetes" "terraform" "aws" "gcp" "azure"
    # Testing
    "pytest" "jest" "vitest" "playwright" "msw"
)

# Known patterns
KNOWN_PATTERNS=(
    "cursor-pagination" "cursor-based-pagination" "keyset-pagination"
    "offset-pagination"
    "repository-pattern" "service-layer" "clean-architecture"
    "dependency-injection" "di-pattern"
    "event-sourcing" "cqrs" "saga-pattern"
    "circuit-breaker" "retry-pattern" "bulkhead"
    "rate-limiting" "throttling"
    "optimistic-locking" "pessimistic-locking"
    "caching" "cache-aside" "write-through"
    "rag" "semantic-search" "vector-search"
)

# Minimum text length to process
MIN_TEXT_LENGTH=50

# -----------------------------------------------------------------------------
# Entity Extraction Functions
# -----------------------------------------------------------------------------

# Extract agents from text
extract_agents() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local found_agents=()
    for agent in "${KNOWN_AGENTS[@]}"; do
        if [[ "$text_lower" == *"$agent"* ]]; then
            found_agents+=("$agent")
        fi
    done

    # Return as newline-separated list (handle empty array)
    if [[ ${#found_agents[@]} -gt 0 ]]; then
        printf '%s\n' "${found_agents[@]}" | sort -u
    fi
}

# Extract technologies from text
extract_technologies() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local found_techs=()
    for tech in "${KNOWN_TECHNOLOGIES[@]}"; do
        if [[ "$text_lower" == *"$tech"* ]]; then
            found_techs+=("$tech")
        fi
    done

    # Return as newline-separated list (handle empty array)
    if [[ ${#found_techs[@]} -gt 0 ]]; then
        printf '%s\n' "${found_techs[@]}" | sort -u
    fi
}

# Extract patterns from text
extract_patterns() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local found_patterns=()
    for pattern in "${KNOWN_PATTERNS[@]}"; do
        if [[ "$text_lower" == *"$pattern"* ]]; then
            found_patterns+=("$pattern")
        fi
    done

    # Return as newline-separated list (handle empty array)
    if [[ ${#found_patterns[@]} -gt 0 ]]; then
        printf '%s\n' "${found_patterns[@]}" | sort -u
    fi
}

# Extract constraints from text (keyword-based)
extract_constraints() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local constraints=()

    # Check for constraint indicators
    if [[ "$text_lower" == *"must"* || "$text_lower" == *"required"* ]]; then
        # Extract the sentence containing the constraint
        local sentences
        sentences=$(echo "$text" | grep -oi "[^.]*must[^.]*\." 2>/dev/null | head -1)
        if [[ -n "$sentences" ]]; then
            constraints+=("${sentences:0:100}")
        fi
    fi

    if [[ "$text_lower" == *"cannot"* || "$text_lower" == *"cannot use"* ]]; then
        local sentences
        sentences=$(echo "$text" | grep -oi "[^.]*cannot[^.]*\." 2>/dev/null | head -1)
        if [[ -n "$sentences" ]]; then
            constraints+=("${sentences:0:100}")
        fi
    fi

    # Return as newline-separated list (handle empty array)
    if [[ ${#constraints[@]} -gt 0 ]]; then
        printf '%s\n' "${constraints[@]}" | sort -u
    fi
}

# Detect relation type from context
detect_relation_type() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    if [[ "$text_lower" == *"recommend"* || "$text_lower" == *"suggests"* || "$text_lower" == *"advises"* ]]; then
        echo "RECOMMENDS"
    elif [[ "$text_lower" == *"chose"* || "$text_lower" == *"selected"* || "$text_lower" == *"decided"* ]]; then
        echo "CHOSEN_FOR"
    elif [[ "$text_lower" == *"replace"* || "$text_lower" == *"instead of"* || "$text_lower" == *"rather than"* ]]; then
        echo "REPLACES"
    elif [[ "$text_lower" == *"conflict"* || "$text_lower" == *"incompatible"* || "$text_lower" == *"anti-pattern"* ]]; then
        echo "CONFLICTS_WITH"
    else
        echo "RELATES_TO"
    fi
}

# -----------------------------------------------------------------------------
# Build Entity JSON for Graph Memory
# -----------------------------------------------------------------------------

build_entities_json() {
    local agents="$1"
    local technologies="$2"
    local patterns="$3"
    local constraints="$4"

    local entities='[]'

    # Add agent entities
    while IFS= read -r agent; do
        if [[ -n "$agent" ]]; then
            local entity
            entity=$(jq -n \
                --arg name "$agent" \
                --arg type "Agent" \
                --arg obs "SkillForge agent: $agent" \
                '{name: $name, entityType: $type, observations: [$obs]}')
            entities=$(echo "$entities" | jq --argjson e "$entity" '. += [$e]')
        fi
    done <<< "$agents"

    # Add technology entities
    while IFS= read -r tech; do
        if [[ -n "$tech" ]]; then
            local entity
            entity=$(jq -n \
                --arg name "$tech" \
                --arg type "Technology" \
                --arg obs "Technology choice: $tech" \
                '{name: $name, entityType: $type, observations: [$obs]}')
            entities=$(echo "$entities" | jq --argjson e "$entity" '. += [$e]')
        fi
    done <<< "$technologies"

    # Add pattern entities
    while IFS= read -r pattern; do
        if [[ -n "$pattern" ]]; then
            local entity
            entity=$(jq -n \
                --arg name "$pattern" \
                --arg type "Pattern" \
                --arg obs "Design pattern: $pattern" \
                '{name: $name, entityType: $type, observations: [$obs]}')
            entities=$(echo "$entities" | jq --argjson e "$entity" '. += [$e]')
        fi
    done <<< "$patterns"

    # Add constraint entities
    while IFS= read -r constraint; do
        if [[ -n "$constraint" ]]; then
            local entity
            entity=$(jq -n \
                --arg name "constraint-$(echo "$constraint" | md5sum | cut -c1-8)" \
                --arg type "Constraint" \
                --arg obs "$constraint" \
                '{name: $name, entityType: $type, observations: [$obs]}')
            entities=$(echo "$entities" | jq --argjson e "$entity" '. += [$e]')
        fi
    done <<< "$constraints"

    echo "$entities"
}

# Build relations JSON based on extracted entities
build_relations_json() {
    local agents="$1"
    local technologies="$2"
    local patterns="$3"
    local relation_type="$4"

    local relations='[]'

    # If we have agents and technologies/patterns, create RECOMMENDS relations
    while IFS= read -r agent; do
        if [[ -n "$agent" ]]; then
            while IFS= read -r tech; do
                if [[ -n "$tech" ]]; then
                    local relation
                    relation=$(jq -n \
                        --arg from "$agent" \
                        --arg to "$tech" \
                        --arg type "$relation_type" \
                        '{from: $from, to: $to, relationType: $type}')
                    relations=$(echo "$relations" | jq --argjson r "$relation" '. += [$r]')
                fi
            done <<< "$technologies"

            while IFS= read -r pattern; do
                if [[ -n "$pattern" ]]; then
                    local relation
                    relation=$(jq -n \
                        --arg from "$agent" \
                        --arg to "$pattern" \
                        --arg type "$relation_type" \
                        '{from: $from, to: $to, relationType: $type}')
                    relations=$(echo "$relations" | jq --argjson r "$relation" '. += [$r]')
                fi
            done <<< "$patterns"
        fi
    done <<< "$agents"

    echo "$relations"
}

# -----------------------------------------------------------------------------
# Main Processing
# -----------------------------------------------------------------------------

# Extract skill info from hook input
SKILL_NAME=""
SKILL_OUTPUT=""

if [[ -n "$_HOOK_INPUT" ]]; then
    SKILL_NAME=$(echo "$_HOOK_INPUT" | jq -r '.skill_name // .tool_input.skill // ""' 2>/dev/null || echo "")
    SKILL_OUTPUT=$(echo "$_HOOK_INPUT" | jq -r '.tool_result // .output // ""' 2>/dev/null || echo "")
fi

# Skip if no output or too short
if [[ -z "$SKILL_OUTPUT" || ${#SKILL_OUTPUT} -lt $MIN_TEXT_LENGTH ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Extract entities
AGENTS=$(extract_agents "$SKILL_OUTPUT")
TECHNOLOGIES=$(extract_technologies "$SKILL_OUTPUT")
PATTERNS=$(extract_patterns "$SKILL_OUTPUT")
CONSTRAINTS=$(extract_constraints "$SKILL_OUTPUT")

# Count entities (handle empty strings correctly)
count_lines() {
    local text="$1"
    if [[ -z "$text" ]]; then
        echo "0"
    else
        echo "$text" | grep -c . 2>/dev/null || echo "0"
    fi
}

AGENT_COUNT=$(count_lines "$AGENTS")
TECH_COUNT=$(count_lines "$TECHNOLOGIES")
PATTERN_COUNT=$(count_lines "$PATTERNS")
CONSTRAINT_COUNT=$(count_lines "$CONSTRAINTS")

# Ensure counts are valid integers
[[ "$AGENT_COUNT" =~ ^[0-9]+$ ]] || AGENT_COUNT=0
[[ "$TECH_COUNT" =~ ^[0-9]+$ ]] || TECH_COUNT=0
[[ "$PATTERN_COUNT" =~ ^[0-9]+$ ]] || PATTERN_COUNT=0
[[ "$CONSTRAINT_COUNT" =~ ^[0-9]+$ ]] || CONSTRAINT_COUNT=0

TOTAL_ENTITIES=$((AGENT_COUNT + TECH_COUNT + PATTERN_COUNT + CONSTRAINT_COUNT))

# Skip if no entities found
if [[ $TOTAL_ENTITIES -eq 0 ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Detect relation type
RELATION_TYPE=$(detect_relation_type "$SKILL_OUTPUT")

# Build entity and relation JSON
ENTITIES_JSON=$(build_entities_json "$AGENTS" "$TECHNOLOGIES" "$PATTERNS" "$CONSTRAINTS")
RELATIONS_JSON=$(build_relations_json "$AGENTS" "$TECHNOLOGIES" "$PATTERNS" "$RELATION_TYPE")

# Get project info
PROJECT_ID=$(mem0_get_project_id)
DECISIONS_USER_ID=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")

# Count relations
RELATION_COUNT=$(echo "$RELATIONS_JSON" | jq 'length')

# Build system message with entity extraction suggestions
MSG=$(cat <<EOF
[Entity Extraction] Found $TOTAL_ENTITIES entities from ${SKILL_NAME:-skill}:
- Agents: $AGENT_COUNT
- Technologies: $TECH_COUNT
- Patterns: $PATTERN_COUNT
- Constraints: $CONSTRAINT_COUNT
- Relations: $RELATION_COUNT ($RELATION_TYPE)

To create knowledge graph, use:

1. mcp__memory__create_entities with:
   entities: $ENTITIES_JSON

2. mcp__memory__create_relations with:
   relations: $RELATIONS_JSON

Note: Graph memory is enabled by default (v1.2.0). Entities will be automatically linked when stored via mcp__mem0__add_memory.
EOF
)

# Output CC 2.1.7 compliant JSON
jq -n \
    --arg msg "$MSG" \
    '{
        continue: true,
        systemMessage: $msg
    }'
