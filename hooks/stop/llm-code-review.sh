#!/usr/bin/env bash
# SkillForge Quality Gate: LLM Code Review
# Timeout: 600000ms (10 minutes) - CC 2.1.3 feature
#
# Uses LLM to review uncommitted changes for quality issues.
# Requires ANTHROPIC_API_KEY or OPENAI_API_KEY in environment.

set -euo pipefail

# Configuration
LOG_FILE="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/logs/llm-code-review.log"
REVIEW_DIR="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/logs/reviews"
MAX_DIFF_LINES=500

mkdir -p "$REVIEW_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "=== LLM Code Review Started ==="

# Check for API key
check_api_key() {
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]] && [[ -z "${OPENAI_API_KEY:-}" ]]; then
        log "No API key found (ANTHROPIC_API_KEY or OPENAI_API_KEY), skipping LLM review"
        return 1
    fi
    return 0
}

# Get uncommitted changes
get_diff() {
    local diff
    diff=$(git diff HEAD 2>/dev/null || echo "")

    if [[ -z "$diff" ]]; then
        # Check for staged changes
        diff=$(git diff --cached 2>/dev/null || echo "")
    fi

    if [[ -z "$diff" ]]; then
        log "No uncommitted changes to review"
        return 1
    fi

    # Limit diff size
    local line_count
    line_count=$(echo "$diff" | wc -l)

    if [[ $line_count -gt $MAX_DIFF_LINES ]]; then
        log "Diff too large ($line_count lines), truncating to $MAX_DIFF_LINES lines"
        diff=$(echo "$diff" | head -n $MAX_DIFF_LINES)
        diff="${diff}\n\n... (truncated, $line_count total lines)"
    fi

    echo "$diff"
}

# Call Claude API for review
call_claude_api() {
    local diff="$1"
    local response_file="$REVIEW_DIR/claude-response-$(date +%s).json"

    local prompt
    prompt=$(cat << 'PROMPT_EOF'
Review this code diff for quality issues. Focus on:
1. Security vulnerabilities (injection, XSS, hardcoded secrets)
2. Logic errors or bugs
3. Performance issues
4. Missing error handling

Output format:
- CRITICAL: [issues that must be fixed before merge]
- HIGH: [significant issues]
- MEDIUM: [improvements recommended]
- OK: [if no issues found]

Be concise. Only mention actual issues found in the diff.
PROMPT_EOF
)

    local json_payload
    json_payload=$(jq -n \
        --arg model "claude-haiku-4-5-20251022" \
        --arg prompt "$prompt" \
        --arg diff "$diff" \
        '{
            model: $model,
            max_tokens: 1000,
            messages: [
                {
                    role: "user",
                    content: ($prompt + "\n\n```diff\n" + $diff + "\n```")
                }
            ]
        }')

    log "Calling Claude API..."

    if curl -s "https://api.anthropic.com/v1/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: ${ANTHROPIC_API_KEY}" \
        -H "anthropic-version: 2023-06-01" \
        -d "$json_payload" \
        -o "$response_file" 2>/dev/null; then

        # Extract review content
        local review
        review=$(jq -r '.content[0].text // "No review generated"' "$response_file" 2>/dev/null)

        if [[ -n "$review" ]] && [[ "$review" != "No review generated" ]]; then
            log "Review received"
            echo "$review"

            # Save review
            echo "$review" > "$REVIEW_DIR/review-$(date +%Y%m%d-%H%M%S).md"

            # Check for critical issues
            if echo "$review" | grep -q "CRITICAL:"; then
                return 2  # Signal critical issues found
            fi
            return 0
        fi
    fi

    log "API call failed or returned empty response"
    return 1
}

# Call OpenAI API for review (fallback)
call_openai_api() {
    local diff="$1"

    if [[ -z "${OPENAI_API_KEY:-}" ]]; then
        return 1
    fi

    log "Falling back to OpenAI API..."

    # Similar implementation for OpenAI
    # Simplified for brevity
    return 1
}

# Main execution
main() {
    cd "${CLAUDE_PROJECT_DIR:-$PWD}"

    # Check for API key
    if ! check_api_key; then
        exit 0
    fi

    # Get diff
    local diff
    if ! diff=$(get_diff); then
        exit 0
    fi

    # Run review
    local review
    local exit_code=0

    if review=$(call_claude_api "$diff"); then
        echo "=== LLM Code Review ===" >&2
        echo "$review" >&2
        echo "=======================" >&2
    else
        exit_code=$?
        if [[ $exit_code -eq 2 ]]; then
            log "Critical issues found in review"
            echo "WARNING: Critical issues found in code review" >&2
        fi
    fi

    log "=== LLM Code Review Complete ==="
    exit 0  # Don't block on review results
}

main "$@"