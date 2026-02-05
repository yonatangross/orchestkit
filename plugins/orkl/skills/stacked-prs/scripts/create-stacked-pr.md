---
name: create-stacked-pr
description: Create stacked PRs with auto-detected branch structure. Use when managing multi-PR feature development.
user-invocable: true
argument-hint: [base-branch]
allowed-tools: Bash, Read, Grep, Glob
---

Create stacked PR from: $ARGUMENTS

## Stack Context (Auto-Detected)

- **Current Branch**: !`git branch --show-current || echo "Unknown"`
- **All Branches**: !`git branch --list 2>/dev/null | head -10 || echo "No branches found"`
- **Existing PRs**: !`gh pr list --head "$(git branch --show-current 2>/dev/null || echo '')" --json number,title --jq '.[] | "\(.number): \(.title)"' 2>/dev/null | head -5 || echo "No PRs found"`
- **GitHub CLI Available**: !`which gh >/dev/null 2>&1 && echo "✅ Yes" || echo "❌ Not found"`

## Your Task

Create a stacked PR with base branch: **$ARGUMENTS**

Check the branch status:
- Verify base branch exists: `git show-ref --verify --quiet refs/heads/$ARGUMENTS`
- Check commits ahead: `git rev-list --count $ARGUMENTS..HEAD`
- Check commits behind: `git rev-list --count HEAD..$ARGUMENTS`

## Stacked PR Workflow

### 1. Check Stack Status

```bash
# Review current branch status
git log $ARGUMENTS..HEAD --oneline | head -10
```

### 2. Create PR

```bash
# Create PR with base branch
gh pr create \
  --base "$ARGUMENTS" \
  --head "$(git branch --show-current)" \
  --title "[Stack] $(git log -1 --format=%s)" \
  --body "Stacked PR based on $ARGUMENTS"
```

### 3. Stack Management

Use the stack scripts for full workflow:

```bash
source scripts/stack-scripts.sh

# Define your stack
STACK_BRANCHES=(
  "feature/part-1"
  "feature/part-2"
  "feature/part-3"
)

# Check status
stack_status

# Create all PRs
stack_create_prs

# Rebase entire stack
stack_rebase
```

## Stack Position

This PR is part of a stacked feature. Dependencies:
- **Base**: $ARGUMENTS
- **This Branch**: !`git branch --show-current || echo "current"`
- **Next in Stack**: (define in STACK_BRANCHES array)
