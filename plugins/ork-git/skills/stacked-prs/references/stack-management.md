# Stack Management

Practical patterns for managing stacked PR workflows.

## Stack Naming Convention

```bash
# Pattern: feature/<name>-<stack-number>
feature/auth-1-model          # PR 1: Data model
feature/auth-2-service        # PR 2: Business logic
feature/auth-3-api            # PR 3: API endpoints
feature/auth-4-ui             # PR 4: Frontend

# Or with issue numbers
issue/100-auth-base           # Base PR
issue/100-auth-service        # Stacked on base
issue/100-auth-ui             # Stacked on service
```

## Rebasing the Stack

When base PR changes, rebase the entire stack:

```bash
#!/bin/bash
# rebase-stack.sh

STACK=(
  "feature/auth-1-model"
  "feature/auth-2-service"
  "feature/auth-3-api"
  "feature/auth-4-ui"
)

BASE="main"

for branch in "${STACK[@]}"; do
  echo "=== Rebasing $branch onto $BASE ==="
  git checkout "$branch"
  git rebase "$BASE" || {
    echo "Conflict in $branch - resolve and run: git rebase --continue"
    exit 1
  }
  git push --force-with-lease
  BASE="$branch"
done

echo "Stack rebased successfully!"
```

## After Base PR Merges

```bash
# Base PR (feature/auth-1) merged to main
# Update PR 2's target

# 1. Fetch latest main
git checkout main && git pull

# 2. Change PR 2's base branch to main
gh pr edit <pr-2-number> --base main

# 3. Rebase PR 2 on main
git checkout feature/auth-2-service
git rebase main
git push --force-with-lease

# 4. Rebase remaining stack on PR 2
git checkout feature/auth-3-api
git rebase feature/auth-2-service
git push --force-with-lease
```

## Stack Status Script

```bash
#!/bin/bash
# stack-status.sh

echo "=== Stack Status ==="
echo ""

# Define your stack
BRANCHES=(
  "feature/auth-1-model"
  "feature/auth-2-service"
  "feature/auth-3-api"
)

for branch in "${BRANCHES[@]}"; do
  # Get PR info
  PR_INFO=$(gh pr list --head "$branch" --json number,state,title --jq '.[0]')

  if [ -n "$PR_INFO" ]; then
    NUMBER=$(echo "$PR_INFO" | jq -r '.number')
    STATE=$(echo "$PR_INFO" | jq -r '.state')
    TITLE=$(echo "$PR_INFO" | jq -r '.title')
    echo "[$STATE] #$NUMBER: $TITLE"
    echo "         Branch: $branch"
  else
    echo "[NO PR] $branch"
  fi
  echo ""
done
```

## PR Description Template

```markdown
## Summary
[Brief description of this slice]

## Stack Position
| # | PR | Status | Branch |
|---|-----|--------|--------|
| 1 | #101 | Merged | feature/auth-1-model |
| 2 | **#102** | **This PR** | feature/auth-2-service |
| 3 | #103 | Draft | feature/auth-3-api |

## Dependencies
- **Depends on**: #101 (merge that first)
- **Blocks**: #103 (cannot merge until this merges)

## Changes in This PR
- [ ] Change 1
- [ ] Change 2

## How to Review
1. Start from PR #101 for context
2. Focus on service layer logic
3. Tests are in this PR
```

## Handling Conflicts

When conflicts appear during stack rebase:

```bash
# During rebase
git status  # See conflicted files
# Fix conflicts manually
git add <fixed-files>
git rebase --continue

# If too messy, start over
git rebase --abort
```

## Tips

1. **Keep PRs small** - 200-400 lines each
2. **Make each PR reviewable** - Complete feature slice
3. **Document dependencies** - Clear in PR description
4. **Rebase frequently** - Daily if possible
5. **Communicate** - Tell reviewers about the stack
