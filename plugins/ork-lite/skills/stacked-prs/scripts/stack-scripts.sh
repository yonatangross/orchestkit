#!/bin/bash
# Stacked PR Management Scripts
# Manage multi-PR feature development workflows

set -euo pipefail

# =============================================================================
# STACK CONFIGURATION
# =============================================================================

# Define your stack branches (modify for your feature)
# Order matters: base first, dependent branches follow
STACK_BRANCHES=(
  # "feature/auth-1-model"
  # "feature/auth-2-service"
  # "feature/auth-3-api"
  # "feature/auth-4-ui"
)

# Base branch to merge into
BASE_BRANCH="main"

# =============================================================================
# STACK STATUS
# =============================================================================

# Show status of all branches in stack
stack_status() {
  echo "=== Stack Status ==="
  echo "Base: $BASE_BRANCH"
  echo ""

  local position=1
  for branch in "${STACK_BRANCHES[@]}"; do
    echo "[$position] $branch"

    # Check if branch exists locally
    if ! git show-ref --verify --quiet "refs/heads/$branch" 2>/dev/null; then
      echo "    ❌ Branch not found locally"
      ((position++))
      continue
    fi

    # Get PR info
    local pr_info
    pr_info=$(gh pr list --head "$branch" --json number,state,title --jq '.[0] // empty' 2>/dev/null || echo "")

    if [[ -n "$pr_info" ]]; then
      local pr_num pr_state pr_title
      pr_num=$(echo "$pr_info" | jq -r '.number')
      pr_state=$(echo "$pr_info" | jq -r '.state')
      pr_title=$(echo "$pr_info" | jq -r '.title')
      echo "    PR #$pr_num [$pr_state]: $pr_title"
    else
      echo "    ⚠️  No PR found"
    fi

    # Check if up-to-date with previous branch
    local prev_branch="$BASE_BRANCH"
    if [[ $position -gt 1 ]]; then
      prev_branch="${STACK_BRANCHES[$((position-2))]}"
    fi

    local behind
    behind=$(git rev-list --count "$branch".."$prev_branch" 2>/dev/null || echo "?")
    if [[ "$behind" != "0" && "$behind" != "?" ]]; then
      echo "    ⚠️  Behind $prev_branch by $behind commits (needs rebase)"
    fi

    ((position++))
    echo ""
  done
}

# =============================================================================
# STACK REBASE
# =============================================================================

# Rebase entire stack on base branch
stack_rebase() {
  echo "=== Rebasing Stack ==="
  echo ""

  # Save current branch
  local current_branch
  current_branch=$(git branch --show-current)

  local prev_branch="$BASE_BRANCH"

  # First, update base
  echo "Updating $BASE_BRANCH..."
  git checkout "$BASE_BRANCH"
  git pull origin "$BASE_BRANCH"

  # Rebase each branch in order
  for branch in "${STACK_BRANCHES[@]}"; do
    echo ""
    echo "Rebasing $branch onto $prev_branch..."

    if ! git show-ref --verify --quiet "refs/heads/$branch" 2>/dev/null; then
      echo "  ⚠️  Branch $branch not found, skipping"
      continue
    fi

    git checkout "$branch"

    if ! git rebase "$prev_branch"; then
      echo ""
      echo "❌ Conflict in $branch!"
      echo ""
      echo "Resolve conflicts, then run:"
      echo "  git rebase --continue"
      echo "  stack_rebase  # Resume from here"
      echo ""
      echo "Or abort:"
      echo "  git rebase --abort"
      return 1
    fi

    echo "  ✅ Rebased successfully"
    prev_branch="$branch"
  done

  # Return to original branch
  git checkout "$current_branch"

  echo ""
  echo "✅ Stack rebased successfully!"
  echo ""
  echo "Don't forget to force-push:"
  echo "  stack_push"
}

# =============================================================================
# STACK PUSH
# =============================================================================

# Force push all branches in stack
stack_push() {
  echo "=== Pushing Stack ==="
  echo ""

  for branch in "${STACK_BRANCHES[@]}"; do
    if ! git show-ref --verify --quiet "refs/heads/$branch" 2>/dev/null; then
      echo "⚠️  Branch $branch not found, skipping"
      continue
    fi

    echo "Pushing $branch..."
    git push --force-with-lease origin "$branch"
    echo "  ✅ Pushed"
  done

  echo ""
  echo "✅ Stack pushed successfully!"
}

# =============================================================================
# STACK CREATE
# =============================================================================

# Create PRs for stack branches
stack_create_prs() {
  echo "=== Creating PRs for Stack ==="
  echo ""

  local position=1
  local prev_branch="$BASE_BRANCH"

  for branch in "${STACK_BRANCHES[@]}"; do
    echo "[$position] $branch"

    # Check if PR already exists
    local existing_pr
    existing_pr=$(gh pr list --head "$branch" --json number --jq '.[0].number // empty' 2>/dev/null || echo "")

    if [[ -n "$existing_pr" ]]; then
      echo "  PR #$existing_pr already exists"

      # Update base if needed
      local current_base
      current_base=$(gh pr view "$existing_pr" --json baseRefName --jq '.baseRefName')
      if [[ "$current_base" != "$prev_branch" ]]; then
        echo "  Updating base from $current_base to $prev_branch"
        gh pr edit "$existing_pr" --base "$prev_branch"
      fi
    else
      echo "  Creating PR..."

      # Generate title
      local total=${#STACK_BRANCHES[@]}
      local title
      title=$(git log "$prev_branch".."$branch" --format=%s | head -1)
      title="$title [$position/$total]"

      # Generate body with stack info
      local body
      body=$(generate_stack_pr_body "$position")

      # Create PR
      gh pr create \
        --head "$branch" \
        --base "$prev_branch" \
        --title "$title" \
        --body "$body" \
        --draft

      echo "  ✅ PR created (as draft)"
    fi

    prev_branch="$branch"
    ((position++))
    echo ""
  done
}

# Generate PR body with stack information
generate_stack_pr_body() {
  local current_position="$1"
  local total=${#STACK_BRANCHES[@]}

  cat << EOF
## Stack Position

| # | Branch | Status |
|---|--------|--------|
EOF

  local pos=1
  for branch in "${STACK_BRANCHES[@]}"; do
    local marker=""
    if [[ $pos -eq $current_position ]]; then
      marker="**This PR**"
    else
      local pr_num
      pr_num=$(gh pr list --head "$branch" --json number --jq '.[0].number // empty' 2>/dev/null || echo "")
      if [[ -n "$pr_num" ]]; then
        marker="#$pr_num"
      else
        marker="Pending"
      fi
    fi

    echo "| $pos | $branch | $marker |"
    ((pos++))
  done

  cat << EOF

## Dependencies
EOF

  if [[ $current_position -gt 1 ]]; then
    local prev_branch="${STACK_BRANCHES[$((current_position-2))]}"
    local prev_pr
    prev_pr=$(gh pr list --head "$prev_branch" --json number --jq '.[0].number // empty' 2>/dev/null || echo "")
    if [[ -n "$prev_pr" ]]; then
      echo "**Depends on**: #$prev_pr (merge that first)"
    else
      echo "**Depends on**: $prev_branch"
    fi
  else
    echo "Base PR - no dependencies"
  fi

  if [[ $current_position -lt $total ]]; then
    echo ""
    echo "**Blocks**: Subsequent PRs in stack"
  fi

  cat << EOF

## Changes
<!-- Describe changes in this PR -->

## Test Plan
- [ ] Tests pass
- [ ] Reviewed in context of full stack
EOF
}

# =============================================================================
# STACK UPDATE (After Base Merges)
# =============================================================================

# Update stack after base PR merges
stack_update_after_merge() {
  local merged_position="${1:-1}"

  echo "=== Updating Stack After Merge ==="
  echo "Merged position: $merged_position"
  echo ""

  # Update base
  git checkout "$BASE_BRANCH"
  git pull origin "$BASE_BRANCH"

  # Find next branch in stack
  local next_position=$((merged_position + 1))

  if [[ $next_position -gt ${#STACK_BRANCHES[@]} ]]; then
    echo "All PRs in stack have been merged!"
    return 0
  fi

  local next_branch="${STACK_BRANCHES[$((next_position-1))]}"

  echo "Next branch: $next_branch"
  echo ""

  # Update PR base to main
  local pr_num
  pr_num=$(gh pr list --head "$next_branch" --json number --jq '.[0].number // empty' 2>/dev/null || echo "")

  if [[ -n "$pr_num" ]]; then
    echo "Updating PR #$pr_num base to $BASE_BRANCH"
    gh pr edit "$pr_num" --base "$BASE_BRANCH"
  fi

  # Rebase on main
  echo "Rebasing $next_branch on $BASE_BRANCH"
  git checkout "$next_branch"
  git rebase "$BASE_BRANCH"
  git push --force-with-lease origin "$next_branch"

  # Remove merged branch from stack
  echo ""
  echo "Update STACK_BRANCHES to remove merged branch"
  echo "Then run: stack_rebase"
}

# =============================================================================
# STACK CLEANUP
# =============================================================================

# Delete merged branches
stack_cleanup() {
  echo "=== Cleaning Up Merged Branches ==="
  echo ""

  for branch in "${STACK_BRANCHES[@]}"; do
    # Check if merged
    if git branch --merged "$BASE_BRANCH" | grep -q "$branch"; then
      echo "Deleting merged branch: $branch"
      git branch -d "$branch" 2>/dev/null || true
      git push origin --delete "$branch" 2>/dev/null || true
    else
      echo "Keeping unmerged branch: $branch"
    fi
  done

  echo ""
  echo "✅ Cleanup complete"
}

# =============================================================================
# USAGE
# =============================================================================

usage() {
  cat << 'EOF'
Stacked PR Management Scripts

Setup:
  1. Edit STACK_BRANCHES array at top of script
  2. Source this file: source stack-scripts.sh

Commands:
  stack_status              Show status of all branches in stack
  stack_rebase              Rebase entire stack on base branch
  stack_push                Force push all branches in stack
  stack_create_prs          Create PRs for all stack branches
  stack_update_after_merge  Update stack after base PR merges
  stack_cleanup             Delete merged branches

Example Workflow:
  # 1. Define your stack
  STACK_BRANCHES=("feature/auth-1" "feature/auth-2" "feature/auth-3")

  # 2. Check status
  stack_status

  # 3. After making changes to base, rebase all
  stack_rebase
  stack_push

  # 4. Create PRs
  stack_create_prs

  # 5. After first PR merges
  stack_update_after_merge 1
EOF
}

# Show usage if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  usage
fi
