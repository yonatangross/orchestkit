#!/usr/bin/env bash
# issue-progress-commenter.sh - Queue commit progress for GitHub issue updates
# Part of SkillForge Plugin - Issue Progress Tracking
#
# Triggers: After successful git commit commands
# Function: Extracts issue number from branch name or commit message and queues
#           progress for batch commenting at session end
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

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/issue-progress.log"

# Sanitize session ID to prevent path traversal (security best practice)
SAFE_SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
SAFE_SESSION_ID="${SAFE_SESSION_ID//[^a-zA-Z0-9_-]/}"
SESSION_DIR="/tmp/claude-session-${SAFE_SESSION_ID}"
PROGRESS_FILE="$SESSION_DIR/issue-progress.json"

# Ensure directories exist
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
mkdir -p "$SESSION_DIR" 2>/dev/null || true

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [issue-progress-commenter] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Issue Number Extraction
# -----------------------------------------------------------------------------

# Extract issue number from branch name (e.g., issue/123-description, fix/123-bug)
extract_issue_from_branch() {
    local branch="$1"

    # Pattern: issue/123-*, fix/123-*, feature/123-*, etc.
    if [[ "$branch" =~ ^(issue|fix|feature|bug|feat)/([0-9]+) ]]; then
        echo "${BASH_REMATCH[2]}"
        return 0
    fi

    # Pattern: 123-description (issue number at start)
    if [[ "$branch" =~ ^([0-9]+)- ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi

    return 1
}

# Extract issue number from commit message (e.g., "fix(#123): message" or "closes #123")
extract_issue_from_commit() {
    local message="$1"

    # Pattern: (#123) or #123 in message
    if [[ "$message" =~ \#([0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi

    # Pattern: fixes/closes/resolves #123
    if [[ "$message" =~ (fix|fixes|close|closes|resolve|resolves)[[:space:]]+\#?([0-9]+) ]]; then
        echo "${BASH_REMATCH[2]}"
        return 0
    fi

    return 1
}

# Get current branch name
get_current_branch() {
    git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null || echo ""
}

# Get latest commit info
get_latest_commit() {
    local sha message timestamp
    sha=$(git rev-parse --short HEAD 2>/dev/null) || return 1
    message=$(git log -1 --pretty=%s 2>/dev/null) || return 1
    timestamp=$(git log -1 --pretty=%cI 2>/dev/null) || timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    jq -n \
        --arg sha "$sha" \
        --arg message "$message" \
        --arg timestamp "$timestamp" \
        '{sha: $sha, message: $message, timestamp: $timestamp}'
}

# Get files changed in latest commit
get_changed_files() {
    git diff-tree --no-commit-id --name-status -r HEAD 2>/dev/null | \
        while IFS=$'\t' read -r status file; do
            echo "$status $file"
        done
}

# -----------------------------------------------------------------------------
# Progress Queue Management
# -----------------------------------------------------------------------------

# Initialize progress file if needed
init_progress_file() {
    if [[ ! -f "$PROGRESS_FILE" ]]; then
        local session_id="${CLAUDE_SESSION_ID:-unknown}"
        jq -n \
            --arg session_id "$session_id" \
            '{
                session_id: $session_id,
                issues: {}
            }' > "$PROGRESS_FILE"
    fi
}

# Add commit to issue progress queue
queue_commit_progress() {
    local issue_num="$1"
    local commit_json="$2"
    local branch="$3"

    init_progress_file

    local tmp_file
    tmp_file=$(mktemp)

    # Add commit to the issue's commits array
    jq --arg issue "$issue_num" \
       --argjson commit "$commit_json" \
       --arg branch "$branch" \
       '
        .issues[$issue] //= {commits: [], tasks_completed: [], pr_url: null, branch: $branch} |
        .issues[$issue].commits += [$commit] |
        .issues[$issue].branch = $branch
       ' "$PROGRESS_FILE" > "$tmp_file" 2>/dev/null

    if jq empty "$tmp_file" 2>/dev/null; then
        mv "$tmp_file" "$PROGRESS_FILE"
        log "Queued commit for issue #$issue_num"
        return 0
    else
        rm -f "$tmp_file"
        log "Error queuing commit for issue #$issue_num"
        return 1
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

    log "Processing git commit command..."

    # Check if gh CLI is available
    if ! command -v gh &>/dev/null; then
        log "gh CLI not available, skipping issue progress tracking"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Check if we're in a git repo with GitHub remote
    if ! git remote get-url origin 2>/dev/null | grep -q "github"; then
        log "Not a GitHub repository, skipping"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Get branch and commit info
    local branch
    branch=$(get_current_branch)

    if [[ -z "$branch" ]]; then
        log "Could not determine current branch"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Try to extract issue number
    local issue_num=""

    # First try branch name
    issue_num=$(extract_issue_from_branch "$branch") || true

    # If not found in branch, try commit message
    if [[ -z "$issue_num" ]]; then
        local commit_msg
        commit_msg=$(git log -1 --pretty=%s 2>/dev/null) || true
        if [[ -n "$commit_msg" ]]; then
            issue_num=$(extract_issue_from_commit "$commit_msg") || true
        fi
    fi

    # If no issue number found, skip silently
    if [[ -z "$issue_num" ]]; then
        log "No issue number found in branch '$branch' or commit message"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    log "Found issue #$issue_num"

    # Verify issue exists (quick check)
    if ! gh issue view "$issue_num" --json number &>/dev/null; then
        log "Issue #$issue_num not found or not accessible"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Get commit info and queue it
    local commit_json
    commit_json=$(get_latest_commit) || {
        log "Could not get commit info"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    }

    queue_commit_progress "$issue_num" "$commit_json" "$branch"

    echo '{"continue": true, "suppressOutput": true}'
}

main "$@"
