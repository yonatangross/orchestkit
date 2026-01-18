#!/bin/bash
# Skill Edit Pattern Tracker - PostToolUse Hook
# Tracks edit patterns after skill usage to enable skill evolution
#
# Part of: #58 (Skill Evolution System)
# Triggers on: Write|Edit after skill usage
# Action: Categorize and log edit patterns for evolution analysis
# CC 2.1.7 Compliant: Self-contained hook with stdin reading
#
# Version: 1.0.2 - Fixed Bash 3.2 compatibility (no associative arrays)

set -eo pipefail

# Read stdin BEFORE sourcing common.sh to avoid race conditions
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source common utilities
if [[ -f "$HOOKS_ROOT/_lib/common.sh" ]]; then
    source "$HOOKS_ROOT/_lib/common.sh"
fi

# Source feedback lib for metrics
FEEDBACK_LIB="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/feedback-lib.sh"
if [[ -f "$FEEDBACK_LIB" ]]; then
    source "$FEEDBACK_LIB"
fi

# Configuration
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SESSION_STATE_FILE="${PROJECT_ROOT}/.claude/session/state.json"
EDIT_PATTERNS_FILE="${PROJECT_ROOT}/.claude/feedback/edit-patterns.jsonl"
SKILL_USAGE_LOG="${PROJECT_ROOT}/.claude/logs/skill-usage.log"

# Edit pattern categories with detection patterns
# Note: Using parallel arrays for Bash 3.2 compatibility (no associative arrays)
# Pattern names and their regex detectors are stored in parallel arrays
PATTERN_NAMES=(
    # API/Backend patterns
    "add_pagination"
    "add_rate_limiting"
    "add_caching"
    "add_retry_logic"
    # Error handling patterns
    "add_error_handling"
    "add_validation"
    "add_logging"
    # Type safety patterns
    "add_types"
    "add_type_guards"
    # Code quality patterns
    "add_docstring"
    "remove_comments"
    # Security patterns
    "add_auth_check"
    "add_input_sanitization"
    # Testing patterns
    "add_test_case"
    "add_mock"
    # Import/dependency patterns
    "modify_imports"
    # Async patterns
    "add_async"
)

PATTERN_REGEXES=(
    # API/Backend patterns
    "limit.*offset|page.*size|cursor.*pagination|paginate|Paginated"
    "rate.?limit|throttl|RateLimiter|requests.?per"
    "@cache|cache_key|TTL|redis|memcache|@cached"
    "retry|backoff|max_attempts|tenacity|Retry"
    # Error handling patterns
    "try.*catch|except|raise.*Exception|throw.*Error|error.*handler"
    "validate|Validator|@validate|Pydantic|Zod|yup|schema"
    "logger[.]|logging[.]|console[.]log|winston|pino|structlog"
    # Type safety patterns
    ": *(str|int|bool|List|Dict|Optional)|interface |type .*="
    "isinstance|typeof|is.*Type|assert.*type"
    # Code quality patterns
    'docstring|"""[^"]+"""|/[*][*]'
    "^-.*#|^-.*//|^-.*[*]"
    # Security patterns
    "@auth|@require_auth|isAuthenticated|requiresAuth|@login_required"
    "escape|sanitize|htmlspecialchars|DOMPurify"
    # Testing patterns
    "def test_|it[(]|describe[(]|expect[(]|assert|@pytest"
    "Mock|patch|jest[.]mock|vi[.]mock|MagicMock"
    # Import/dependency patterns
    "^[+-].*import|^[+-].*from.*import|^[+-].*require[(]"
    # Async patterns
    "async |await |Promise|asyncio|async def"
)

# Get recent skill usage from session state
get_recent_skill() {
    if [[ ! -f "$SESSION_STATE_FILE" ]]; then
        echo ""
        return
    fi

    # Get most recently loaded skill (within last 5 minutes)
    local now
    now=$(date +%s)
    local cutoff=$((now - 300))

    jq -r --argjson cutoff "$cutoff" '
        .recentSkills // [] |
        map(select(.timestamp > $cutoff)) |
        sort_by(-.timestamp) |
        .[0].skillId // ""
    ' "$SESSION_STATE_FILE" 2>/dev/null || echo ""
}

# Detect edit patterns in content diff
# Uses parallel arrays for Bash 3.2 compatibility
detect_patterns() {
    local diff_content="$1"
    local detected=()
    local i=0
    local count=${#PATTERN_NAMES[@]}

    while [[ $i -lt $count ]]; do
        local pattern_name="${PATTERN_NAMES[$i]}"
        local regex="${PATTERN_REGEXES[$i]}"
        if echo "$diff_content" | grep -qiE "$regex" 2>/dev/null; then
            detected+=("$pattern_name")
        fi
        i=$((i + 1))
    done

    # Output as JSON array
    if [[ ${#detected[@]} -gt 0 ]]; then
        printf '%s\n' "${detected[@]}" | jq -R . | jq -s .
    else
        echo "[]"
    fi
}

# Log edit pattern to JSONL file
log_edit_pattern() {
    local skill_id="$1"
    local file_path="$2"
    local patterns="$3"
    local session_id="${CLAUDE_SESSION_ID:-unknown}"

    # Ensure directory exists
    mkdir -p "$(dirname "$EDIT_PATTERNS_FILE")"

    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Create JSONL entry
    jq -n \
        --arg ts "$timestamp" \
        --arg skill "$skill_id" \
        --arg file "$file_path" \
        --arg session "$session_id" \
        --argjson patterns "$patterns" \
        '{
            timestamp: $ts,
            skill_id: $skill,
            file_path: $file,
            session_id: $session,
            patterns: $patterns
        }' >> "$EDIT_PATTERNS_FILE"
}

# Update skill metrics with edit patterns
update_skill_metrics() {
    local skill_id="$1"
    local patterns="$2"

    # Skip if feedback lib not available
    if ! command -v log_skill_usage &>/dev/null; then
        return
    fi

    # Count patterns as edits
    local edit_count
    edit_count=$(echo "$patterns" | jq 'length')

    # Log to metrics (success assumed since edit completed)
    log_skill_usage "$skill_id" "true" "$edit_count" 2>/dev/null || true
}

# Main execution
main() {
    # Read hook input
    local hook_input
    hook_input=$(cat)

    # Extract tool info
    local tool_name
    tool_name=$(echo "$hook_input" | jq -r '.tool_name // "unknown"')

    # Only process Write/Edit tools
    if [[ "$tool_name" != "Write" && "$tool_name" != "Edit" ]]; then
        exit 0
    fi

    # Get file path from tool input
    local file_path
    file_path=$(echo "$hook_input" | jq -r '.tool_input.file_path // ""')

    if [[ -z "$file_path" ]]; then
        exit 0
    fi

    # Get recently used skill
    local skill_id
    skill_id=$(get_recent_skill)

    if [[ -z "$skill_id" ]]; then
        # No recent skill usage - nothing to track
        exit 0
    fi

    # Get the diff/edit content
    local edit_content=""

    if [[ "$tool_name" == "Edit" ]]; then
        # For Edit tool, analyze old_string -> new_string diff
        local old_string new_string
        old_string=$(echo "$hook_input" | jq -r '.tool_input.old_string // ""')
        new_string=$(echo "$hook_input" | jq -r '.tool_input.new_string // ""')

        if [[ -n "$old_string" && -n "$new_string" ]]; then
            # Create pseudo-diff
            edit_content=$(diff <(echo "$old_string") <(echo "$new_string") 2>/dev/null || true)
        fi
    else
        # For Write tool, analyze the new content
        local content
        content=$(echo "$hook_input" | jq -r '.tool_input.content // ""')
        edit_content="$content"
    fi

    if [[ -z "$edit_content" ]]; then
        exit 0
    fi

    # Detect patterns
    local patterns
    patterns=$(detect_patterns "$edit_content")

    # Only log if patterns detected
    local pattern_count
    pattern_count=$(echo "$patterns" | jq 'length')

    if [[ "$pattern_count" -gt 0 ]]; then
        # Log to edit patterns file
        log_edit_pattern "$skill_id" "$file_path" "$patterns"

        # Update skill metrics
        update_skill_metrics "$skill_id" "$patterns"

        # Debug log
        if [[ -n "${CLAUDE_HOOK_DEBUG:-}" ]]; then
            echo "[skill-edit-tracker] Detected $pattern_count patterns for $skill_id: $patterns" >> "${PROJECT_ROOT}/.claude/logs/hooks.log"
        fi
    fi
}

# Run main
main

# CC 2.1.7: Silent success - tracking completed
output_silent_success
exit 0