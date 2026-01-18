#!/usr/bin/env bash
# issue-subtask-updater.sh - Auto-update issue checkboxes based on commit messages
# Part of SkillForge Plugin - Issue Progress Tracking
#
# Triggers: After successful git commit commands
# Function: Parses commit message for task completion keywords and updates
#           corresponding checkboxes in the GitHub issue body
#
# CC 2.1.9 Compliant: Uses suppressOutput for silent operation

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")}"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/issue-subtask.log"

# Sanitize session ID to prevent path traversal (security best practice)
SAFE_SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
SAFE_SESSION_ID="${SAFE_SESSION_ID//[^a-zA-Z0-9_-]/}"
SESSION_DIR="/tmp/claude-session-${SAFE_SESSION_ID}"
PROGRESS_FILE="$SESSION_DIR/issue-progress.json"

# Ensure directories exist
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [issue-subtask-updater] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Task Matching Patterns
# -----------------------------------------------------------------------------

# Keywords that indicate task completion (matched against checkboxes)
# These patterns match the start of checkbox items
TASK_PATTERNS=(
    "Add"
    "Implement"
    "Create"
    "Build"
    "Fix"
    "Resolve"
    "Correct"
    "Update"
    "Improve"
    "Enhance"
    "Refactor"
    "Test"
    "Validate"
    "Verify"
    "Document"
    "Write"
    "Configure"
    "Setup"
    "Set up"
    "Remove"
    "Delete"
    "Clean"
    "Migrate"
    "Convert"
    "Enable"
    "Disable"
)

# Extract action and subject from commit message
# e.g., "feat(#123): Add input validation" -> "Add input validation"
extract_task_from_commit() {
    local message="$1"

    # Remove conventional commit prefix: type(scope):
    local task
    task=$(echo "$message" | sed -E 's/^[a-z]+(\([^)]*\))?:[[:space:]]*//' | sed -E 's/^[A-Z][a-z]+(\([^)]*\))?:[[:space:]]*//')

    # Remove issue references like (#123)
    task=$(echo "$task" | sed -E 's/\(#[0-9]+\)//g')

    # Trim whitespace
    task=$(echo "$task" | sed -E 's/^[[:space:]]+|[[:space:]]+$//')

    echo "$task"
}

# Normalize text for comparison (lowercase, remove extra spaces)
normalize_text() {
    local text="$1"
    echo "$text" | tr '[:upper:]' '[:lower:]' | sed -E 's/[[:space:]]+/ /g' | sed -E 's/^[[:space:]]+|[[:space:]]+$//'
}

# Check if commit task matches a checkbox item
# Returns 0 if match found, 1 otherwise
matches_checkbox() {
    local commit_task="$1"
    local checkbox_text="$2"

    local norm_commit
    local norm_checkbox

    norm_commit=$(normalize_text "$commit_task")
    norm_checkbox=$(normalize_text "$checkbox_text")

    # Exact match (after normalization)
    if [[ "$norm_commit" == "$norm_checkbox" ]]; then
        return 0
    fi

    # Commit task contains checkbox text
    if [[ "$norm_commit" == *"$norm_checkbox"* ]]; then
        return 0
    fi

    # Checkbox text contains commit task
    if [[ "$norm_checkbox" == *"$norm_commit"* ]]; then
        return 0
    fi

    # Check if they share significant words (at least 3 words matching)
    local commit_words checkbox_words matching_words
    commit_words=$(echo "$norm_commit" | tr ' ' '\n' | grep -E '^.{3,}$' | sort -u)
    checkbox_words=$(echo "$norm_checkbox" | tr ' ' '\n' | grep -E '^.{3,}$' | sort -u)
    matching_words=$(comm -12 <(echo "$commit_words") <(echo "$checkbox_words") | wc -l)

    if [[ "$matching_words" -ge 2 ]]; then
        return 0
    fi

    return 1
}

# -----------------------------------------------------------------------------
# Issue Manipulation
# -----------------------------------------------------------------------------

# Extract issue number (same logic as issue-progress-commenter.sh)
extract_issue_from_branch() {
    local branch="$1"

    if [[ "$branch" =~ ^(issue|fix|feature|bug|feat)/([0-9]+) ]]; then
        echo "${BASH_REMATCH[2]}"
        return 0
    fi

    if [[ "$branch" =~ ^([0-9]+)- ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi

    return 1
}

extract_issue_from_commit() {
    local message="$1"

    if [[ "$message" =~ \#([0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi

    return 1
}

# Get issue body and find unchecked checkboxes
get_unchecked_tasks() {
    local issue_num="$1"

    local body
    body=$(gh issue view "$issue_num" --json body -q '.body' 2>/dev/null) || return 1

    # Extract unchecked checkbox items: - [ ] text
    echo "$body" | grep -E '^\s*-\s*\[\s*\]\s+' | sed -E 's/^\s*-\s*\[\s*\]\s+//'
}

# Update a checkbox from unchecked to checked
update_checkbox() {
    local issue_num="$1"
    local checkbox_text="$2"

    log "Attempting to update checkbox: '$checkbox_text' in issue #$issue_num"

    # Get current body
    local body
    body=$(gh issue view "$issue_num" --json body -q '.body' 2>/dev/null) || {
        log "Failed to get issue body"
        return 1
    }

    # Escape special regex characters in checkbox text for sed
    local escaped_text
    escaped_text=$(printf '%s\n' "$checkbox_text" | sed 's/[[\.*^$()+?{|]/\\&/g')

    # Replace unchecked with checked
    # Match: - [ ] text (with possible leading whitespace)
    local updated_body
    updated_body=$(echo "$body" | sed -E "s/(^[[:space:]]*-[[:space:]]*)\[[[:space:]]*\]([[:space:]]+${escaped_text})/\1[x]\2/")

    # Check if anything changed
    if [[ "$body" == "$updated_body" ]]; then
        log "No change needed for checkbox: '$checkbox_text'"
        return 1
    fi

    # Get repo info
    local repo
    repo=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null) || {
        log "Failed to get repo info"
        return 1
    }

    # Update issue body via API
    if gh api -X PATCH "repos/$repo/issues/$issue_num" -f body="$updated_body" &>/dev/null; then
        log "Successfully updated checkbox: '$checkbox_text'"
        return 0
    else
        log "Failed to update issue body via API"
        return 1
    fi
}

# Record completed task in progress file
record_task_completion() {
    local issue_num="$1"
    local task_text="$2"

    if [[ ! -f "$PROGRESS_FILE" ]]; then
        return 0
    fi

    local tmp_file
    tmp_file=$(mktemp)

    jq --arg issue "$issue_num" \
       --arg task "$task_text" \
       '
        .issues[$issue] //= {commits: [], tasks_completed: [], pr_url: null} |
        if (.issues[$issue].tasks_completed | index($task)) == null then
            .issues[$issue].tasks_completed += [$task]
        else
            .
        end
       ' "$PROGRESS_FILE" > "$tmp_file" 2>/dev/null

    if jq empty "$tmp_file" 2>/dev/null; then
        mv "$tmp_file" "$PROGRESS_FILE"
    else
        rm -f "$tmp_file"
    fi
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

    # Only process successful git commit commands
    local command_lower
    command_lower=$(echo "$command" | tr '[:upper:]' '[:lower:]')

    if [[ ! "$command_lower" =~ git[[:space:]]+commit ]] || [[ "$exit_code" != "0" ]]; then
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    log "Processing git commit for subtask updates..."

    # Check if gh CLI is available
    if ! command -v gh &>/dev/null; then
        log "gh CLI not available, skipping subtask updates"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Check if we're in a git repo with GitHub remote
    if ! git remote get-url origin 2>/dev/null | grep -q "github"; then
        log "Not a GitHub repository, skipping"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Get branch and commit message
    local branch
    branch=$(git branch --show-current 2>/dev/null) || {
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    }

    local commit_msg
    commit_msg=$(git log -1 --pretty=%s 2>/dev/null) || {
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    }

    # Extract issue number
    local issue_num=""
    issue_num=$(extract_issue_from_branch "$branch") || true

    if [[ -z "$issue_num" ]]; then
        issue_num=$(extract_issue_from_commit "$commit_msg") || true
    fi

    if [[ -z "$issue_num" ]]; then
        log "No issue number found"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    log "Found issue #$issue_num, checking for matching subtasks..."

    # Extract task from commit message
    local commit_task
    commit_task=$(extract_task_from_commit "$commit_msg")

    if [[ -z "$commit_task" ]]; then
        log "Could not extract task from commit message"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    log "Commit task: '$commit_task'"

    # Get unchecked tasks from issue
    local unchecked_tasks
    unchecked_tasks=$(get_unchecked_tasks "$issue_num") || {
        log "Could not get issue tasks or no checkboxes found"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    }

    if [[ -z "$unchecked_tasks" ]]; then
        log "No unchecked tasks in issue #$issue_num"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Check each unchecked task for a match
    local matched=false
    while IFS= read -r checkbox_text; do
        if [[ -z "$checkbox_text" ]]; then
            continue
        fi

        if matches_checkbox "$commit_task" "$checkbox_text"; then
            log "Found matching checkbox: '$checkbox_text'"

            if update_checkbox "$issue_num" "$checkbox_text"; then
                record_task_completion "$issue_num" "$checkbox_text"
                matched=true
            fi
        fi
    done <<< "$unchecked_tasks"

    if [[ "$matched" == "false" ]]; then
        log "No matching checkboxes found for task: '$commit_task'"
        echo '{"continue": true, "suppressOutput": true}'
    else
        # Provide additionalContext to Claude when tasks are updated (CC 2.1.9)
        local context="Issue #${issue_num}: Automatically marked sub-task as complete based on commit."
        jq -n \
            --arg ctx "$context" \
            '{
                "continue": true,
                "suppressOutput": true,
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": $ctx
                }
            }'
    fi
}

main "$@"
