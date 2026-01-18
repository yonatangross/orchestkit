#!/usr/bin/env bash
# skill-auto-suggest.sh - Proactive skill suggestion based on prompt analysis
# Issue #123: Skill Auto-Suggest Hook
#
# This hook analyzes user prompts for task keywords and suggests relevant skills
# from the skills/ directory via CC 2.1.9 additionalContext injection.
#
# CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext for suggestions
# Version: 1.0.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$SCRIPT_DIR")")}"
SKILLS_DIR="${PLUGIN_ROOT}/skills"

# Source common library if available
if [[ -f "${PLUGIN_ROOT}/hooks/_lib/common.sh" ]]; then
    source "${PLUGIN_ROOT}/hooks/_lib/common.sh"
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/skill-auto-suggest.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [skill-auto-suggest] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# Maximum number of skills to suggest
MAX_SUGGESTIONS=3

# Minimum confidence score (0-100) to include a skill
MIN_CONFIDENCE=30

# -----------------------------------------------------------------------------
# Keyword-to-Skill Mapping Database
# Format: keyword|skill-name|confidence-boost (using | as delimiter for bash 3.2)
# -----------------------------------------------------------------------------

# Keywords are grouped by domain for better matching
declare -a KEYWORD_MAPPINGS=(
    # API & Backend
    "api|api-design-framework|80"
    "endpoint|api-design-framework|70"
    "rest|api-design-framework|75"
    "graphql|api-design-framework|75"
    "route|api-design-framework|60"
    "fastapi|fastapi-advanced|90"
    "uvicorn|fastapi-advanced|70"
    "starlette|fastapi-advanced|60"
    "middleware|fastapi-advanced|50"
    "pydantic|fastapi-advanced|60"

    # Database
    "database|database-schema-designer|80"
    "schema|database-schema-designer|70"
    "table|database-schema-designer|50"
    "migration|alembic-migrations|85"
    "alembic|alembic-migrations|95"
    "sql|database-schema-designer|60"
    "postgres|database-schema-designer|70"
    "query|database-schema-designer|40"
    "index|database-schema-designer|50"
    "sqlalchemy|sqlalchemy-2-async|85"
    "async.*database|sqlalchemy-2-async|80"
    "orm|sqlalchemy-2-async|60"
    "connection.*pool|connection-pooling|90"
    "pool|connection-pooling|60"
    "pgvector|pgvector-search|95"
    "vector.*search|pgvector-search|85"
    "embedding|embeddings|80"

    # Authentication & Security
    "auth|auth-patterns|85"
    "login|auth-patterns|75"
    "jwt|auth-patterns|80"
    "oauth|auth-patterns|85"
    "passkey|auth-patterns|90"
    "webauthn|auth-patterns|90"
    "session|auth-patterns|60"
    "password|auth-patterns|70"
    "security|owasp-top-10|75"
    "owasp|owasp-top-10|95"
    "xss|owasp-top-10|80"
    "injection|owasp-top-10|80"
    "csrf|owasp-top-10|80"
    "validation|input-validation|70"
    "sanitiz|input-validation|80"
    "defense.*depth|defense-in-depth|95"

    # Testing
    "test|integration-testing|60"
    "unit.*test|pytest-advanced|80"
    "pytest|pytest-advanced|90"
    "integration.*test|integration-testing|85"
    "e2e|e2e-testing|90"
    "playwright|e2e-testing|80"
    "mock|msw-mocking|75"
    "msw|msw-mocking|95"
    "fixture|test-data-management|80"
    "test.*data|test-data-management|85"
    "coverage|pytest-advanced|60"
    "property.*test|property-based-testing|90"
    "hypothesis|property-based-testing|95"
    "contract.*test|contract-testing|95"
    "pact|contract-testing|95"
    "golden.*dataset|golden-dataset-validation|90"
    "performance.*test|performance-testing|90"
    "load.*test|performance-testing|85"
    "k6|performance-testing|95"
    "locust|performance-testing|95"

    # Frontend & React
    "react|react-server-components-framework|70"
    "component|react-server-components-framework|50"
    "server.*component|react-server-components-framework|95"
    "nextjs|react-server-components-framework|85"
    "next\.js|react-server-components-framework|85"
    "suspense|react-server-components-framework|70"
    "streaming.*ssr|react-server-components-framework|90"
    "form|form-state-patterns|70"
    "react.*hook.*form|form-state-patterns|95"
    "zod|form-state-patterns|60"
    "zustand|zustand-patterns|95"
    "state.*management|zustand-patterns|70"
    "tanstack|tanstack-query-advanced|90"
    "react.*query|tanstack-query-advanced|85"
    "radix|radix-primitives|95"
    "shadcn|radix-primitives|80"
    "tailwind|design-system-starter|60"
    "design.*system|design-system-starter|85"
    "animation|motion-animation-patterns|80"
    "framer|motion-animation-patterns|90"
    "core.*web.*vital|core-web-vitals|95"
    "lcp|core-web-vitals|80"
    "cls|core-web-vitals|80"
    "inp|core-web-vitals|80"
    "i18n|i18n-date-patterns|90"
    "internationalization|i18n-date-patterns|95"
    "locale|i18n-date-patterns|70"

    # Accessibility
    "accessibility|a11y-testing|85"
    "a11y|a11y-testing|95"
    "wcag|a11y-testing|95"
    "screen.*reader|focus-management|80"
    "keyboard.*nav|focus-management|90"
    "focus|focus-management|60"
    "aria|focus-management|70"

    # AI/LLM
    "llm|function-calling|70"
    "openai|function-calling|60"
    "anthropic|function-calling|60"
    "function.*call|function-calling|90"
    "tool.*use|function-calling|85"
    "stream|llm-streaming|70"
    "rag|rag-retrieval|95"
    "retrieval|rag-retrieval|75"
    "context|contextual-retrieval|60"
    "chunk|embeddings|70"
    "vector|embeddings|75"
    "semantic.*search|embeddings|85"
    "langfuse|langfuse-observability|95"
    "llm.*observ|langfuse-observability|90"
    "langgraph|langgraph-state|85"
    "agent|agent-loops|70"
    "workflow|langgraph-state|60"
    "supervisor|langgraph-supervisor|90"
    "human.*in.*loop|langgraph-human-in-loop|95"
    "checkpoint|langgraph-checkpoints|90"
    "prompt.*cache|prompt-caching|95"
    "cache.*llm|semantic-caching|85"
    "eval|llm-evaluation|70"
    "llm.*test|llm-testing|85"
    "ollama|ollama-local|95"

    # DevOps & Infrastructure
    "deploy|devops-deployment|75"
    "ci|devops-deployment|60"
    "cd|devops-deployment|60"
    "github.*action|github-operations|85"
    "workflow|github-operations|50"
    "release|release-management|80"
    "changelog|release-management|70"
    "version|release-management|50"
    "observ|observability-monitoring|80"
    "monitor|observability-monitoring|70"
    "log|observability-monitoring|50"
    "metric|observability-monitoring|60"
    "trace|observability-monitoring|70"
    "alert|observability-monitoring|60"

    # Git & GitHub
    "git|git-workflow|70"
    "branch|git-workflow|60"
    "commit|commit|80"
    "rebase|git-workflow|70"
    "stacked.*pr|stacked-prs|95"
    "pr|create-pr|60"
    "pull.*request|create-pr|75"
    "recovery|git-recovery-command|80"
    "reflog|git-recovery-command|95"
    "milestone|github-operations|80"
    "issue|github-operations|50"

    # Event-Driven & Messaging
    "event.*sourc|event-sourcing|95"
    "kafka|message-queues|85"
    "rabbitmq|message-queues|85"
    "queue|message-queues|75"
    "pub.*sub|message-queues|80"
    "outbox|outbox-pattern|95"
    "saga|event-sourcing|70"
    "cqrs|event-sourcing|80"

    # Async & Concurrency
    "async|asyncio-advanced|70"
    "asyncio|asyncio-advanced|90"
    "taskgroup|asyncio-advanced|95"
    "concurrent|asyncio-advanced|60"
    "background.*job|background-jobs|90"
    "celery|background-jobs|95"
    "worker|background-jobs|60"
    "distributed.*lock|distributed-locks|95"
    "redis.*lock|distributed-locks|85"
    "idempoten|idempotency-patterns|95"

    # Architecture & Patterns
    "clean.*architecture|clean-architecture|95"
    "ddd|domain-driven-design|95"
    "domain.*driven|domain-driven-design|90"
    "aggregate|aggregate-patterns|90"
    "adr|architecture-decision-record|95"
    "decision.*record|architecture-decision-record|85"

    # Code Quality
    "lint|biome-linting|70"
    "biome|biome-linting|95"
    "eslint|biome-linting|60"
    "format|biome-linting|50"
    "code.*review|code-review-playbook|90"
    "review|code-review-playbook|60"
    "quality.*gate|quality-gates|90"

    # Error Handling
    "error.*handl|error-handling-rfc9457|85"
    "rfc.*9457|error-handling-rfc9457|95"
    "problem.*detail|error-handling-rfc9457|90"
)

# -----------------------------------------------------------------------------
# Skill Matching Logic
# -----------------------------------------------------------------------------

# Extract skill suggestions based on prompt keywords
# Returns: skill-name|confidence (sorted by confidence, highest first)
find_matching_skills() {
    local prompt="$1"
    local prompt_lower
    prompt_lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')

    declare -A skill_scores

    # Check each keyword mapping
    for mapping in "${KEYWORD_MAPPINGS[@]}"; do
        local keyword="${mapping%%|*}"
        local rest="${mapping#*|}"
        local skill="${rest%%|*}"
        local confidence="${rest#*|}"

        # Check if keyword matches (supports basic regex)
        if echo "$prompt_lower" | grep -qE "$keyword" 2>/dev/null; then
            # Add or update skill score
            local current_score="${skill_scores[$skill]:-0}"
            if (( confidence > current_score )); then
                skill_scores[$skill]=$confidence
            fi
        fi
    done

    # Output skills sorted by confidence
    for skill in "${!skill_scores[@]}"; do
        echo "${skill}|${skill_scores[$skill]}"
    done | sort -t'|' -k2 -nr | head -n "$MAX_SUGGESTIONS"
}

# Get skill description from SKILL.md frontmatter
get_skill_description() {
    local skill_name="$1"
    local skill_file="${SKILLS_DIR}/${skill_name}/SKILL.md"

    if [[ -f "$skill_file" ]]; then
        # Extract description from YAML frontmatter
        sed -n '/^---$/,/^---$/p' "$skill_file" | grep -E "^description:" | sed 's/^description: *//' | head -1
    fi
}

# Build suggestion message for Claude
build_suggestion_message() {
    local matches="$1"

    if [[ -z "$matches" ]]; then
        return
    fi

    local message="## Relevant Skills Detected

Based on your prompt, the following skills may be helpful:

"

    while IFS='|' read -r skill confidence; do
        if [[ -n "$skill" ]] && (( confidence >= MIN_CONFIDENCE )); then
            local description
            description=$(get_skill_description "$skill")
            if [[ -n "$description" ]]; then
                message+="- **${skill}** (${confidence}% match): ${description}
"
            else
                message+="- **${skill}** (${confidence}% match)
"
            fi
        fi
    done <<< "$matches"

    message+="
Use \`/skf:<skill-name>\` to invoke a user-invocable skill, or read the skill with \`Read skills/<skill-name>/SKILL.md\` for patterns and guidance."

    echo "$message"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

# Output silent success JSON (used for early exits and error cases)
output_silent_success() {
    echo '{"continue": true, "suppressOutput": true}'
}

main() {
    # Wrap everything in error handling to always output valid JSON
    {
        # Read prompt from stdin
        local input=""
        if [[ ! -t 0 ]]; then
            input=$(cat 2>/dev/null) || true
        fi

        if [[ -z "$input" ]]; then
            output_silent_success
            exit 0
        fi

        # Extract prompt from hook input JSON
        # Handle potential JSON parsing errors gracefully
        local prompt=""
        prompt=$(echo "$input" | jq -r '.prompt // .message // .content // ""' 2>/dev/null) || prompt=""

        if [[ -z "$prompt" ]]; then
            output_silent_success
            exit 0
        fi

        log "Analyzing prompt for skill suggestions..."

        # Find matching skills (wrap in subshell to catch errors)
        local matches=""
        matches=$(find_matching_skills "$prompt" 2>/dev/null) || matches=""

        if [[ -z "$matches" ]]; then
            log "No skill matches found"
            output_silent_success
            exit 0
        fi

        log "Found matches: $matches"

        # Build suggestion message
        local suggestion_message=""
        suggestion_message=$(build_suggestion_message "$matches" 2>/dev/null) || suggestion_message=""

        if [[ -n "$suggestion_message" ]]; then
            log "Injecting skill suggestions via additionalContext"

            # Inject via CC 2.1.9 additionalContext
            jq -n \
                --arg suggestion "$suggestion_message" \
                '{
                    "continue": true,
                    "hookSpecificOutput": {
                        "additionalContext": $suggestion
                    }
                }'
        else
            output_silent_success
        fi
    } || {
        # If anything fails, output silent success to not block the prompt
        output_silent_success
    }
}

main "$@"
