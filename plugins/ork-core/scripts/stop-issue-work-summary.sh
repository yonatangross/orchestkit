#!/usr/bin/env bash
# issue-work-summary.sh - Post consolidated progress comments to GitHub issues
# Part of OrchestKit Plugin - Issue Progress Tracking
#
# Triggers: Session ends (Stop hook)
# Function: Reads queued progress from session temp file and posts a single
#           consolidated comment to each issue that was worked on
#
# CC 2.1.7 Compliant: Uses suppressOutput for silent operation

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$SCRIPT_DIR")")}"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/issue-work-summary.log"

# Sanitize session ID to prevent path traversal (security best practice)
SAFE_SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
SAFE_SESSION_ID="${SAFE_SESSION_ID//[^a-zA-Z0-9_-]/}"
SESSION_DIR="/tmp/claude-session-${SAFE_SESSION_ID}"
PROGRESS_FILE="$SESSION_DIR/issue-progress.json"

# Ensure directories exist
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [issue-work-summary] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Progress Comment Generation
# -----------------------------------------------------------------------------

# Get files changed across all commits for an issue
get_files_changed() {
    local commits_json="$1"

    # Get all unique SHAs
    local shas
    shas=$(echo "$commits_json" | jq -r '.[].sha' 2>/dev/null) || return 1

    local all_files=""
    while IFS= read -r sha; do
        if [[ -n "$sha" ]]; then
            local files
            files=$(git diff-tree --no-commit-id --numstat -r "$sha" 2>/dev/null) || continue
            all_files+="$files"$'\n'
        fi
    done <<< "$shas"

    # Aggregate file stats
    echo "$all_files" | awk '
        NF == 3 {
            added[$3] += $1
            deleted[$3] += $2
        }
        END {
            for (file in added) {
                printf "- `%s` (+%d, -%d)\n", file, added[file], deleted[file]
            }
        }
    ' | sort | head -20
}

# Check if there's an open PR for the branch
get_pr_url() {
    local branch="$1"

    local pr_url
    pr_url=$(gh pr view "$branch" --json url -q '.url' 2>/dev/null) || return 1

    echo "$pr_url"
}

# Generate markdown comment for an issue
generate_comment() {
    local issue_num="$1"
    local issue_data="$2"

    local session_id="${CLAUDE_SESSION_ID:-unknown}"
    local branch
    branch=$(echo "$issue_data" | jq -r '.branch // "unknown"')

    local commits_json
    commits_json=$(echo "$issue_data" | jq '.commits // []')

    local commits_count
    commits_count=$(echo "$commits_json" | jq 'length')

    if [[ "$commits_count" -eq 0 ]]; then
        return 1
    fi

    local tasks_json
    tasks_json=$(echo "$issue_data" | jq '.tasks_completed // []')

    local tasks_count
    tasks_count=$(echo "$tasks_json" | jq 'length')

    # Build commits section
    local commits_section=""
    while IFS= read -r commit_line; do
        if [[ -n "$commit_line" ]]; then
            local sha msg
            sha=$(echo "$commit_line" | jq -r '.sha')
            msg=$(echo "$commit_line" | jq -r '.message')
            commits_section+="- \`$sha\`: $msg"$'\n'
        fi
    done < <(echo "$commits_json" | jq -c '.[]')

    # Build files section
    local files_section
    files_section=$(get_files_changed "$commits_json") || files_section="*Could not determine files changed*"

    # Build tasks section
    local tasks_section=""
    if [[ "$tasks_count" -gt 0 ]]; then
        while IFS= read -r task; do
            if [[ -n "$task" ]]; then
                tasks_section+="- [x] $task"$'\n'
            fi
        done < <(echo "$tasks_json" | jq -r '.[]')
    fi

    # Check for PR
    local pr_section=""
    local pr_url
    pr_url=$(get_pr_url "$branch") || true
    if [[ -n "$pr_url" ]]; then
        pr_section="### Pull Request
$pr_url"
    fi

    # Generate full comment
    cat << EOF
## Claude Code Progress Update

**Session**: \`${session_id:0:8}...\`
**Branch**: \`$branch\`

### Commits ($commits_count)
$commits_section
### Files Changed
$files_section
$(if [[ -n "$tasks_section" ]]; then echo "### Sub-tasks Completed"; echo "$tasks_section"; fi)
$(if [[ -n "$pr_section" ]]; then echo "$pr_section"; fi)
---
*Automated by [OrchestKit](https://github.com/yonatangross/orchestkit)*
EOF
}

# Post comment to GitHub issue
post_comment() {
    local issue_num="$1"
    local comment="$2"

    log "Posting progress comment to issue #$issue_num"

    if gh issue comment "$issue_num" --body "$comment" &>/dev/null; then
        log "Successfully posted comment to issue #$issue_num"
        return 0
    else
        log "Failed to post comment to issue #$issue_num"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    log "Session ending, checking for issue progress to post..."

    # Check if progress file exists
    if [[ ! -f "$PROGRESS_FILE" ]]; then
        log "No progress file found at $PROGRESS_FILE"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Check if gh CLI is available
    if ! command -v gh &>/dev/null; then
        log "gh CLI not available, skipping issue summary posting"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Check if we're in a git repo with GitHub remote
    if ! git remote get-url origin 2>/dev/null | grep -q "github"; then
        log "Not a GitHub repository, skipping"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Check if gh is authenticated
    if ! gh auth status &>/dev/null; then
        log "gh CLI not authenticated, skipping"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Read progress file
    local progress_json
    progress_json=$(cat "$PROGRESS_FILE" 2>/dev/null) || {
        log "Failed to read progress file"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    }

    # Get list of issues
    local issues
    issues=$(echo "$progress_json" | jq -r '.issues | keys[]' 2>/dev/null) || {
        log "No issues found in progress file"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    }

    if [[ -z "$issues" ]]; then
        log "No issues to process"
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
    fi

    # Process each issue
    local posted_count=0
    while IFS= read -r issue_num; do
        if [[ -z "$issue_num" ]]; then
            continue
        fi

        log "Processing issue #$issue_num"

        local issue_data
        issue_data=$(echo "$progress_json" | jq --arg num "$issue_num" '.issues[$num]')

        # Check if there are any commits
        local commits_count
        commits_count=$(echo "$issue_data" | jq '.commits | length')

        if [[ "$commits_count" -eq 0 ]]; then
            log "No commits for issue #$issue_num, skipping"
            continue
        fi

        # Verify issue exists and is accessible
        if ! gh issue view "$issue_num" --json number &>/dev/null; then
            log "Issue #$issue_num not found or not accessible, skipping"
            continue
        fi

        # Generate and post comment
        local comment
        comment=$(generate_comment "$issue_num" "$issue_data") || {
            log "Failed to generate comment for issue #$issue_num"
            continue
        }

        if post_comment "$issue_num" "$comment"; then
            ((posted_count++))
        fi
    done <<< "$issues"

    log "Posted progress comments to $posted_count issue(s)"

    # Clean up progress file
    if [[ -f "$PROGRESS_FILE" ]]; then
        rm -f "$PROGRESS_FILE"
        log "Cleaned up progress file"
    fi

    # Clean up session directory if empty
    if [[ -d "$SESSION_DIR" ]] && [[ -z "$(ls -A "$SESSION_DIR" 2>/dev/null)" ]]; then
        rmdir "$SESSION_DIR" 2>/dev/null || true
    fi

    echo '{"continue": true, "suppressOutput": true}'
}

main "$@"
