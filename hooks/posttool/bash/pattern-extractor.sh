#!/usr/bin/env bash
# pattern-extractor.sh - Automatic pattern extraction from bash events
# Part of SkillForge Plugin - Cross-Project Patterns (#48) + Best Practices (#49)
#
# Automatically extracts patterns from:
# - git commit messages
# - gh pr merge
# - test results (pass/fail)
# - build results
#
# CC 2.1.9 Compliant: Uses additionalContext for pattern injection

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")}"

# Source mem0 library
if [[ -f "${PLUGIN_ROOT}/hooks/_lib/mem0.sh" ]]; then
    source "${PLUGIN_ROOT}/hooks/_lib/mem0.sh"
else
    echo '{"continue": true, "suppressOutput": true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/pattern-extractor.log"
PATTERNS_QUEUE="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/patterns-queue.json"

# Ensure directories exist
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
mkdir -p "$(dirname "$PATTERNS_QUEUE")" 2>/dev/null || true

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [pattern-extractor] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Pattern Detection
# -----------------------------------------------------------------------------

# Extract tech/pattern from text
extract_pattern_info() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local tech=""
    local pattern=""

    # Detect technologies
    if [[ "$text_lower" =~ jwt|jsonwebtoken ]]; then tech="JWT"; fi
    if [[ "$text_lower" =~ oauth|oauth2 ]]; then tech="OAuth2"; fi
    if [[ "$text_lower" =~ postgres|postgresql|psql ]]; then tech="PostgreSQL"; fi
    if [[ "$text_lower" =~ redis ]]; then tech="Redis"; fi
    if [[ "$text_lower" =~ react ]]; then tech="React"; fi
    if [[ "$text_lower" =~ fastapi ]]; then tech="FastAPI"; fi
    if [[ "$text_lower" =~ sqlalchemy ]]; then tech="SQLAlchemy"; fi
    if [[ "$text_lower" =~ alembic ]]; then tech="Alembic"; fi
    if [[ "$text_lower" =~ cursor.based|keyset ]]; then tech="cursor-pagination"; fi
    if [[ "$text_lower" =~ offset.pagination ]]; then tech="offset-pagination"; fi
    if [[ "$text_lower" =~ websocket ]]; then tech="WebSocket"; fi
    if [[ "$text_lower" =~ sse|server.sent ]]; then tech="SSE"; fi
    if [[ "$text_lower" =~ graphql ]]; then tech="GraphQL"; fi
    if [[ "$text_lower" =~ rest.api|restful ]]; then tech="REST"; fi

    # Detect patterns from commit prefixes
    if [[ "$text_lower" =~ ^feat:|^feature: ]]; then pattern="feature"; fi
    if [[ "$text_lower" =~ ^fix:|^bugfix: ]]; then pattern="bugfix"; fi
    if [[ "$text_lower" =~ ^refactor: ]]; then pattern="refactor"; fi
    if [[ "$text_lower" =~ ^perf:|^performance: ]]; then pattern="optimization"; fi
    if [[ "$text_lower" =~ ^security:|^sec: ]]; then pattern="security"; fi
    if [[ "$text_lower" =~ ^test:|^tests: ]]; then pattern="testing"; fi

    echo "${tech:-unknown}|${pattern:-general}"
}

# Queue a pattern for storage (batched on session end)
queue_pattern() {
    local text="$1"
    local category="$2"
    local outcome="$3"
    local source="$4"

    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local project_id
    project_id=$(mem0_get_project_id)

    # Initialize queue file if needed
    if [[ ! -f "$PATTERNS_QUEUE" ]]; then
        echo '{"patterns": []}' > "$PATTERNS_QUEUE"
    fi

    # Add pattern to queue
    local tmp_file
    tmp_file=$(mktemp)

    jq --arg text "$text" \
       --arg category "$category" \
       --arg outcome "$outcome" \
       --arg source "$source" \
       --arg timestamp "$timestamp" \
       --arg project "$project_id" \
       '.patterns += [{
         text: $text,
         category: $category,
         outcome: $outcome,
         source: $source,
         timestamp: $timestamp,
         project: $project
       }]' "$PATTERNS_QUEUE" > "$tmp_file" 2>/dev/null && mv "$tmp_file" "$PATTERNS_QUEUE"

    log "Queued pattern: category=$category outcome=$outcome source=$source"
}

# -----------------------------------------------------------------------------
# Event Handlers
# -----------------------------------------------------------------------------

handle_git_commit() {
    local command="$1"
    local exit_code="$2"

    # Extract commit message
    local commit_msg=""
    if [[ "$command" =~ -m[[:space:]]+[\"\'](.*?)[\"\'] ]] || [[ "$command" =~ -m[[:space:]]+[\"\']([^\"\']+)[\"\'] ]]; then
        commit_msg="${BASH_REMATCH[1]}"
    elif [[ "$command" =~ -m[[:space:]]+([^[:space:]]+) ]]; then
        commit_msg="${BASH_REMATCH[1]}"
    fi

    if [[ -z "$commit_msg" ]]; then
        return 0
    fi

    local info
    info=$(extract_pattern_info "$commit_msg")
    local tech="${info%%|*}"
    local pattern="${info##*|}"

    local category
    category=$(detect_best_practice_category "$commit_msg")

    # Determine outcome from exit code
    local outcome="success"
    if [[ "$exit_code" != "0" ]]; then
        outcome="failed"
    fi

    # Build descriptive text
    local pattern_text="$commit_msg"
    if [[ "$tech" != "unknown" ]]; then
        pattern_text="[$tech] $commit_msg"
    fi

    queue_pattern "$pattern_text" "$category" "$outcome" "commit"
}

handle_pr_merge() {
    local command="$1"
    local exit_code="$2"

    if [[ "$exit_code" != "0" ]]; then
        return 0
    fi

    # PR merge is always a success pattern (reviewed code)
    local pr_info=""
    if [[ "$command" =~ gh[[:space:]]+pr[[:space:]]+merge[[:space:]]+([0-9]+) ]]; then
        pr_info="PR #${BASH_REMATCH[1]} merged"
    else
        pr_info="PR merged successfully"
    fi

    queue_pattern "$pr_info" "decision" "success" "pr-merge"
}

handle_test_result() {
    local command="$1"
    local exit_code="$2"

    local test_framework="unknown"
    if [[ "$command" =~ pytest|py\.test ]]; then test_framework="pytest"; fi
    if [[ "$command" =~ jest ]]; then test_framework="jest"; fi
    if [[ "$command" =~ vitest ]]; then test_framework="vitest"; fi
    if [[ "$command" =~ npm[[:space:]]+test|yarn[[:space:]]+test|bun[[:space:]]+test ]]; then test_framework="npm-test"; fi
    if [[ "$command" =~ go[[:space:]]+test ]]; then test_framework="go-test"; fi

    local outcome="success"
    local pattern_text="Tests passed ($test_framework)"

    if [[ "$exit_code" != "0" ]]; then
        outcome="failed"
        pattern_text="Tests failed ($test_framework)"
    fi

    queue_pattern "$pattern_text" "testing" "$outcome" "test-run"
}

handle_build_result() {
    local command="$1"
    local exit_code="$2"

    local build_tool="unknown"
    if [[ "$command" =~ npm[[:space:]]+run[[:space:]]+build ]]; then build_tool="npm"; fi
    if [[ "$command" =~ yarn[[:space:]]+build ]]; then build_tool="yarn"; fi
    if [[ "$command" =~ cargo[[:space:]]+build ]]; then build_tool="cargo"; fi
    if [[ "$command" =~ make ]]; then build_tool="make"; fi
    if [[ "$command" =~ docker[[:space:]]+build ]]; then build_tool="docker"; fi

    local outcome="success"
    local pattern_text="Build succeeded ($build_tool)"

    if [[ "$exit_code" != "0" ]]; then
        outcome="failed"
        pattern_text="Build failed ($build_tool)"
    fi

    queue_pattern "$pattern_text" "build" "$outcome" "build"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    # Read hook input from stdin
    local input=""
    if [[ ! -t 0 ]]; then
        input=$(cat)
    fi

    if [[ -z "$input" ]]; then
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Parse the tool result
    local command=""
    local exit_code="0"

    command=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null) || true
    exit_code=$(echo "$input" | jq -r '.tool_result.exit_code // "0"' 2>/dev/null) || true

    if [[ -z "$command" ]]; then
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    local command_lower
    command_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')

    # Route to appropriate handler
    if [[ "$command_lower" =~ git[[:space:]]+commit ]]; then
        handle_git_commit "$command" "$exit_code"
    elif [[ "$command_lower" =~ gh[[:space:]]+pr[[:space:]]+merge ]]; then
        handle_pr_merge "$command" "$exit_code"
    elif [[ "$command_lower" =~ pytest|jest|vitest|npm[[:space:]]+test|yarn[[:space:]]+test|bun[[:space:]]+test|go[[:space:]]+test ]]; then
        handle_test_result "$command" "$exit_code"
    elif [[ "$command_lower" =~ npm[[:space:]]+run[[:space:]]+build|yarn[[:space:]]+build|cargo[[:space:]]+build|make|docker[[:space:]]+build ]]; then
        handle_build_result "$command" "$exit_code"
    fi

    echo '{"continue": true, "suppressOutput": true}'
}

main "$@"
