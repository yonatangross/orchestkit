#!/bin/bash
# ============================================================
# SkillForge GitHub CLI Helper Functions
# Source this file: source .claude/skills/github-cli/scripts/gh-helpers.sh
# ============================================================

# Configuration
export SF_REPO="ArieGoldkin/SkillForge"
export SF_PROJECT_NUMBER=1
export SF_PROJECT_OWNER="yonatangross"
export SF_PROJECT_ID="PVT_kwHOAS8tks4BIL_t"
export SF_STATUS_FIELD_ID="PVTSSF_lAHOAS8tks4BIL_tzg4uOTk"

# Status Option IDs
export SF_STATUS_READY="19303ae5"
export SF_STATUS_IN_DEV="92ee1ecd"
export SF_STATUS_CODE_COMPLETE="e27c7ae4"
export SF_STATUS_REVIEW_READY="14cafa46"
export SF_STATUS_APPROVED="1e03846e"
export SF_STATUS_DEPLOYED="f39cbda5"

# ============================================================
# ISSUE FUNCTIONS
# ============================================================

# Create issue and return number
sf_issue_create() {
    local title="$1"
    local body="${2:-No description provided.}"
    local labels="${3:-enhancement}"
    local milestone="${4:-}"

    local cmd="gh issue create --repo $SF_REPO --title \"$title\" --body \"$body\" --label \"$labels\""
    [[ -n "$milestone" ]] && cmd="$cmd --milestone \"$milestone\""
    cmd="$cmd --json number --jq '.number'"

    eval "$cmd"
}

# Get issue URL
sf_issue_url() {
    local issue_num="$1"
    echo "https://github.com/$SF_REPO/issues/$issue_num"
}

# List open issues by label
sf_issues_by_label() {
    local label="$1"
    gh issue list --repo "$SF_REPO" --label "$label" --state open \
        --json number,title --jq '.[] | "#\(.number): \(.title)"'
}

# ============================================================
# PROJECT FUNCTIONS
# ============================================================

# Add issue to project board
sf_project_add() {
    local issue_url="$1"
    gh project item-add "$SF_PROJECT_NUMBER" \
        --owner "$SF_PROJECT_OWNER" \
        --url "$issue_url" \
        --format json | jq -r '.id'
}

# Set project item status
sf_project_set_status() {
    local item_id="$1"
    local status_option_id="$2"

    gh api graphql -f query='
        mutation($pid:ID!,$iid:ID!,$fid:ID!,$oid:String!) {
            updateProjectV2ItemFieldValue(input:{
                projectId:$pid,
                itemId:$iid,
                fieldId:$fid,
                value:{singleSelectOptionId:$oid}
            }) {
                projectV2Item { id }
            }
        }
    ' \
        -f pid="$SF_PROJECT_ID" \
        -f iid="$item_id" \
        -f fid="$SF_STATUS_FIELD_ID" \
        -f oid="$status_option_id"
}

# ============================================================
# BRANCH FUNCTIONS
# ============================================================

# Create feature branch from issue
sf_feature_branch() {
    local issue_num="$1"

    # Get issue title
    local title=$(gh issue view "$issue_num" --repo "$SF_REPO" \
        --json title --jq '.title' | \
        tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9]/-/g' | \
        sed 's/--*/-/g' | \
        cut -c1-40)

    local branch="issue/${issue_num}-${title}"

    # Switch to dev and create branch
    git checkout dev && git pull origin dev
    git checkout -b "$branch"

    echo "$branch"
}

# ============================================================
# PR FUNCTIONS
# ============================================================

# Create PR with standard format
sf_pr_create() {
    local title="$1"
    local body="$2"
    local base="${3:-dev}"

    gh pr create \
        --repo "$SF_REPO" \
        --title "$title" \
        --body "$body

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>" \
        --base "$base"
}

# Check if PR is ready to merge
sf_pr_ready() {
    local pr_num="$1"

    local data=$(gh pr view "$pr_num" --repo "$SF_REPO" \
        --json reviewDecision,statusCheckRollupState,mergeable)

    local review=$(echo "$data" | jq -r '.reviewDecision')
    local checks=$(echo "$data" | jq -r '.statusCheckRollupState')
    local mergeable=$(echo "$data" | jq -r '.mergeable')

    echo "Review: $review"
    echo "Checks: $checks"
    echo "Mergeable: $mergeable"

    if [[ "$review" == "APPROVED" && "$checks" == "SUCCESS" && "$mergeable" == "MERGEABLE" ]]; then
        echo "✅ PR is ready to merge"
        return 0
    else
        echo "❌ PR is NOT ready to merge"
        return 1
    fi
}

# ============================================================
# RATE LIMIT FUNCTIONS
# ============================================================

# Check rate limit
sf_rate_limit() {
    gh api rate_limit --jq '.resources.core | {
        remaining: .remaining,
        limit: .limit,
        reset: (.reset | strftime("%H:%M:%S"))
    }'
}

# Wait if rate limited
sf_rate_limit_wait() {
    local min_remaining="${1:-50}"

    local remaining=$(gh api rate_limit --jq '.resources.core.remaining')

    if [[ "$remaining" -lt "$min_remaining" ]]; then
        local reset=$(gh api rate_limit --jq '.resources.core.reset')
        local wait=$((reset - $(date +%s) + 60))
        echo "Rate limit low ($remaining remaining). Waiting ${wait}s..."
        sleep "$wait"
    fi
}

# ============================================================
# COMPLETE WORKFLOWS
# ============================================================

# Create issue, branch, and add to project
sf_start_feature() {
    local title="$1"
    local body="${2:-}"
    local labels="${3:-enhancement,backend}"

    echo "=== Creating Issue ==="
    local issue_num=$(sf_issue_create "$title" "$body" "$labels")
    local issue_url=$(sf_issue_url "$issue_num")
    echo "Created: #$issue_num - $issue_url"

    echo "=== Creating Branch ==="
    local branch=$(sf_feature_branch "$issue_num")
    echo "Branch: $branch"

    echo "=== Adding to Project ==="
    local item_id=$(sf_project_add "$issue_url" 2>/dev/null || echo "")
    if [[ -n "$item_id" ]]; then
        sf_project_set_status "$item_id" "$SF_STATUS_IN_DEV" >/dev/null
        echo "Added to project: $item_id"
    fi

    echo ""
    echo "=== Ready to Work ==="
    echo "Issue:  #$issue_num"
    echo "Branch: $branch"
    echo "URL:    $issue_url"
}

# Finish feature (create PR)
sf_finish_feature() {
    local branch=$(git branch --show-current)
    local issue_num=$(echo "$branch" | grep -o '[0-9]*' | head -1)

    if [[ -z "$issue_num" ]]; then
        echo "ERROR: Cannot extract issue number from branch: $branch"
        return 1
    fi

    # Get issue title
    local issue_title=$(gh issue view "$issue_num" --repo "$SF_REPO" \
        --json title --jq '.title')

    echo "=== Pushing Branch ==="
    git push -u origin "$branch"

    echo "=== Creating PR ==="
    sf_pr_create \
        "feat(#${issue_num}): ${issue_title}" \
        "## Summary
Implements #${issue_num}

## Changes
- TODO: List changes

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass

Closes #${issue_num}"

    echo "=== Done ==="
}

# ============================================================
# HELP
# ============================================================

sf_help() {
    cat << 'EOF'
SkillForge GitHub CLI Helpers

ISSUE FUNCTIONS:
  sf_issue_create "title" ["body"] ["labels"]  - Create issue
  sf_issue_url <number>                        - Get issue URL
  sf_issues_by_label <label>                   - List issues by label

PROJECT FUNCTIONS:
  sf_project_add <issue_url>                   - Add to project board
  sf_project_set_status <item_id> <status_id>  - Set status field

BRANCH FUNCTIONS:
  sf_feature_branch <issue_num>                - Create feature branch

PR FUNCTIONS:
  sf_pr_create "title" "body" [base]           - Create PR
  sf_pr_ready <pr_num>                         - Check if ready to merge

RATE LIMIT:
  sf_rate_limit                                - Check rate limit
  sf_rate_limit_wait [min_remaining]           - Wait if rate limited

WORKFLOWS:
  sf_start_feature "title" ["body"] ["labels"] - Full feature setup
  sf_finish_feature                            - Create PR from current branch

ENVIRONMENT:
  $SF_REPO              - ArieGoldkin/SkillForge
  $SF_PROJECT_NUMBER    - 1
  $SF_STATUS_IN_DEV     - 92ee1ecd (🚧 in-development)
  $SF_STATUS_APPROVED   - 1e03846e (✅ approved)

USAGE:
  source .claude/skills/github-cli/scripts/gh-helpers.sh
  sf_start_feature "Add hybrid search" "Implement RRF fusion" "enhancement,backend"
EOF
}

echo "SkillForge gh-helpers loaded. Run 'sf_help' for usage."
