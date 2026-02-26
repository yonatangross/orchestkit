#!/bin/bash
# Fetch PR Data for Review
# Retrieves comprehensive PR information from GitHub
# Usage: ./fetch-pr-data.sh <PR-number> [--json]

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

PR_NUMBER="${1:-}"
OUTPUT_FORMAT="${2:-text}"

if [[ -z "$PR_NUMBER" ]]; then
  echo "Usage: $0 <PR-number> [--json]"
  echo ""
  echo "Examples:"
  echo "  $0 123          # Fetch PR #123 details"
  echo "  $0 123 --json   # Output as JSON"
  exit 1
fi

# Check for gh CLI
if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) not found. Install from https://cli.github.com/" >&2
  exit 1
fi

# Check authentication
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: Not authenticated with GitHub. Run 'gh auth login'" >&2
  exit 1
fi

# =============================================================================
# FETCH PR DATA
# =============================================================================

# Get PR details
pr_data=$(gh pr view "$PR_NUMBER" --json \
  number,title,author,state,createdAt,updatedAt,baseRefName,headRefName,\
mergeable,reviewDecision,additions,deletions,changedFiles,commits,\
labels,assignees,reviewRequests,body,url,isDraft 2>/dev/null)

if [[ -z "$pr_data" ]]; then
  echo "Error: Could not fetch PR #$PR_NUMBER" >&2
  exit 1
fi

# Get changed files
changed_files=$(gh pr diff "$PR_NUMBER" --name-only 2>/dev/null || echo "")

# Get review comments
reviews=$(gh pr view "$PR_NUMBER" --json reviews --jq '.reviews | length' 2>/dev/null || echo "0")

# Get check status
checks=$(gh pr checks "$PR_NUMBER" --json name,state,conclusion 2>/dev/null || echo "[]")

# Get comments count
comments=$(gh pr view "$PR_NUMBER" --json comments --jq '.comments | length' 2>/dev/null || echo "0")

# =============================================================================
# ANALYSIS
# =============================================================================

# Extract key fields
title=$(echo "$pr_data" | jq -r '.title')
author=$(echo "$pr_data" | jq -r '.author.login')
state=$(echo "$pr_data" | jq -r '.state')
base=$(echo "$pr_data" | jq -r '.baseRefName')
head=$(echo "$pr_data" | jq -r '.headRefName')
additions=$(echo "$pr_data" | jq -r '.additions')
deletions=$(echo "$pr_data" | jq -r '.deletions')
changed_count=$(echo "$pr_data" | jq -r '.changedFiles')
commits=$(echo "$pr_data" | jq -r '.commits | length')
mergeable=$(echo "$pr_data" | jq -r '.mergeable')
review_decision=$(echo "$pr_data" | jq -r '.reviewDecision // "PENDING"')
is_draft=$(echo "$pr_data" | jq -r '.isDraft')
url=$(echo "$pr_data" | jq -r '.url')
created=$(echo "$pr_data" | jq -r '.createdAt')
updated=$(echo "$pr_data" | jq -r '.updatedAt')

# Categorize changed files
py_files=$(echo "$changed_files" | grep -c "\.py$" || echo "0")
ts_files=$(echo "$changed_files" | grep -c "\.tsx\?$" || echo "0")
test_files=$(echo "$changed_files" | grep -cE "(test|spec)\." || echo "0")
config_files=$(echo "$changed_files" | grep -cE "\.(json|yaml|yml|toml|env)$" || echo "0")

# Calculate change size
total_changes=$((additions + deletions))
if [[ $total_changes -lt 50 ]]; then
  change_size="XS"
elif [[ $total_changes -lt 200 ]]; then
  change_size="S"
elif [[ $total_changes -lt 500 ]]; then
  change_size="M"
elif [[ $total_changes -lt 1000 ]]; then
  change_size="L"
else
  change_size="XL"
fi

# Check status summary
checks_passed=$(echo "$checks" | jq '[.[] | select(.conclusion == "SUCCESS" or .conclusion == "success")] | length' 2>/dev/null || echo "0")
checks_failed=$(echo "$checks" | jq '[.[] | select(.conclusion == "FAILURE" or .conclusion == "failure")] | length' 2>/dev/null || echo "0")
checks_pending=$(echo "$checks" | jq '[.[] | select(.state == "pending" or .state == "queued")] | length' 2>/dev/null || echo "0")

# =============================================================================
# OUTPUT
# =============================================================================

if [[ "$OUTPUT_FORMAT" == "--json" ]]; then
  cat << EOF
{
  "pr_number": $PR_NUMBER,
  "title": "$title",
  "author": "$author",
  "state": "$state",
  "is_draft": $is_draft,
  "url": "$url",
  "branches": {
    "base": "$base",
    "head": "$head"
  },
  "changes": {
    "additions": $additions,
    "deletions": $deletions,
    "total": $total_changes,
    "files": $changed_count,
    "commits": $commits,
    "size": "$change_size"
  },
  "file_types": {
    "python": $py_files,
    "typescript": $ts_files,
    "tests": $test_files,
    "config": $config_files
  },
  "status": {
    "mergeable": "$mergeable",
    "review_decision": "$review_decision",
    "reviews": $reviews,
    "comments": $comments
  },
  "checks": {
    "passed": $checks_passed,
    "failed": $checks_failed,
    "pending": $checks_pending
  },
  "timestamps": {
    "created": "$created",
    "updated": "$updated"
  },
  "changed_files": $(echo "$changed_files" | jq -R -s 'split("\n") | map(select(length > 0))')
}
EOF
else
  cat << EOF
================================================================================
                         PR #$PR_NUMBER REVIEW DATA
================================================================================

OVERVIEW
--------
Title:          $title
Author:         $author
State:          $state $(if [[ "$is_draft" == "true" ]]; then echo "(DRAFT)"; fi)
URL:            $url

Branches:       $head -> $base
Created:        $created
Updated:        $updated

CHANGES
-------
Size:           $change_size ($total_changes lines: +$additions / -$deletions)
Files Changed:  $changed_count
Commits:        $commits

FILE BREAKDOWN
--------------
Python files:   $py_files
TypeScript:     $ts_files
Test files:     $test_files
Config files:   $config_files

STATUS
------
Mergeable:      $mergeable
Review Status:  $review_decision
Reviews:        $reviews
Comments:       $comments

CI CHECKS
---------
Passed:         $checks_passed
Failed:         $checks_failed
Pending:        $checks_pending

EOF

  if [[ $checks_failed -gt 0 ]]; then
    echo "FAILED CHECKS:"
    echo "$checks" | jq -r '.[] | select(.conclusion == "FAILURE" or .conclusion == "failure") | "  - \(.name)"' 2>/dev/null || true
    echo ""
  fi

  echo "CHANGED FILES"
  echo "-------------"
  echo "$changed_files" | head -30
  if [[ $(echo "$changed_files" | wc -l) -gt 30 ]]; then
    echo "... and $(($(echo "$changed_files" | wc -l) - 30)) more files"
  fi
  echo ""

  # Recommendations
  echo "REVIEW RECOMMENDATIONS"
  echo "----------------------"

  if [[ "$change_size" == "XL" ]]; then
    echo "- WARNING: Very large PR ($total_changes lines). Consider breaking into smaller PRs."
  fi

  if [[ $test_files -eq 0 && $py_files -gt 0 ]]; then
    echo "- NOTE: No test files changed. Verify test coverage for Python changes."
  fi

  if [[ $config_files -gt 0 ]]; then
    echo "- NOTE: Config files changed. Review for sensitive data exposure."
  fi

  if [[ "$is_draft" == "true" ]]; then
    echo "- NOTE: This is a draft PR. May not be ready for full review."
  fi

  if [[ $checks_failed -gt 0 ]]; then
    echo "- BLOCKER: $checks_failed CI checks failed. Address before merging."
  fi

  if [[ "$review_decision" == "CHANGES_REQUESTED" ]]; then
    echo "- BLOCKER: Changes requested. Review and address feedback."
  fi

  echo ""
  echo "================================================================================
"
fi
