---
name: stacked-prs
description: Multi-PR development for large features. Stack dependent PRs, manage rebases, and get faster reviews on smaller changes. Use when creating stacked PRs.
context: fork
version: 1.0.0
author: OrchestKit
tags: [git, pull-request, stacked, workflow, code-review]
user-invocable: false
---

# Stacked PRs

Break large features into small, reviewable PRs that depend on each other. Merge in order for clean history.

## Quick Reference

```
main ──────────────────────────────────────────●
                                              /
PR #3 (final)  ─────────────────────────●────┘   ← Merge last
                                       /
PR #2 (middle) ────────────────────●──┘          ← Depends on #1
                                  /
PR #1 (base)   ────────────────●──                ← Merge first
                              /
feature/auth ──────●────●────●                    ← Development
```

---

## Workflow

### 1. Plan the Stack

```bash
# Identify logical chunks
# Example: Auth feature
# PR 1: Add User model + migrations
# PR 2: Add auth service + tests
# PR 3: Add login UI + integration tests
```

### 2. Create Base Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/auth-base

# Implement first chunk
git add -p
git commit -m "feat(#100): Add User model"
git commit -m "feat(#100): Add user migrations"

# Push and create first PR
git push -u origin feature/auth-base
gh pr create --base main --title "feat(#100): Add User model [1/3]" \
  --body "## Stack
- PR 1/3: User model (this PR)
- PR 2/3: Auth service (depends on this)
- PR 3/3: Login UI (depends on #2)

## Changes
- Add User model with validation
- Add database migrations"
```

### 3. Stack Next PR

```bash
# Branch from first PR's branch (not main!)
git checkout -b feature/auth-service

# Implement second chunk
git add -p
git commit -m "feat(#100): Add auth service"
git commit -m "test(#100): Add auth service tests"

# Push and create PR targeting FIRST branch
git push -u origin feature/auth-service
gh pr create --base feature/auth-base \
  --title "feat(#100): Add auth service [2/3]" \
  --body "## Stack
- PR 1/3: User model (#101)
- PR 2/3: Auth service (this PR)
- PR 3/3: Login UI (depends on this)

**Depends on #101** - merge that first"
```

### 4. Continue Stacking

```bash
git checkout -b feature/auth-ui

# Implement third chunk
git commit -m "feat(#100): Add login form"
git commit -m "test(#100): Add login integration tests"

git push -u origin feature/auth-ui
gh pr create --base feature/auth-service \
  --title "feat(#100): Add login UI [3/3]"
```

---

## Managing the Stack

### When Base PR Gets Feedback

```bash
# Make changes to base PR
git checkout feature/auth-base
git add -p
git commit -m "fix: Address review feedback"
git push

# Rebase dependent PRs
git checkout feature/auth-service
git rebase feature/auth-base
git push --force-with-lease

git checkout feature/auth-ui
git rebase feature/auth-service
git push --force-with-lease
```

### When Base PR Merges

```bash
# After PR #1 merges to main
git checkout main
git pull origin main

# Update PR #2 to target main now
gh pr edit 102 --base main

# Rebase PR #2 on main
git checkout feature/auth-service
git rebase main
git push --force-with-lease

# Repeat for PR #3 after #2 merges
```

---

## Stack Visualization

Track your stack with comments:

```markdown
## PR Stack for Auth Feature (#100)

| Order | PR | Status | Branch |
|-------|-----|--------|--------|
| 1 | #101 | Merged | feature/auth-base |
| 2 | #102 | Review | feature/auth-service |
| 3 | #103 | Draft | feature/auth-ui |

**Merge order**: #101 -> #102 -> #103
```

---

## Automation Script

```bash
#!/bin/bash
# stack-rebase.sh - Rebase entire stack after changes

STACK=(
  "feature/auth-base"
  "feature/auth-service"
  "feature/auth-ui"
)

BASE="main"

for branch in "${STACK[@]}"; do
  echo "Rebasing $branch onto $BASE..."
  git checkout "$branch"
  git rebase "$BASE"
  git push --force-with-lease
  BASE="$branch"
done

echo "Stack rebased successfully!"
```

---

## Tools for Stacked PRs

### GitHub CLI Extensions

```bash
# Install stacked PR helper
gh extension install dlvhdr/gh-dash

# View PR dependencies
gh pr view --json baseRefName,headRefName
```

### Third-Party Tools

- **Graphite** - graphite.dev (full stack management)
- **Stacked** - stacked.dev
- **git-branchless** - github.com/arxanas/git-branchless

---

## Best Practices

```
DO:
✅ Keep each PR < 400 lines
✅ Make each PR independently reviewable
✅ Document the stack in PR descriptions
✅ Number PRs clearly [1/3], [2/3], [3/3]
✅ Use draft PRs for incomplete stack items
✅ Rebase after feedback, don't merge

DON'T:
❌ Create circular dependencies
❌ Stack more than 4-5 PRs deep
❌ Leave stacks open for > 1 week
❌ Force push to already-approved PRs
❌ Merge out of order
```

---

## When NOT to Stack

- Small features (< 300 lines total)
- Unrelated changes
- Urgent hotfixes
- Single-purpose refactors

---

## PR Template for Stacked PRs

```markdown
## Summary
Brief description of this PR's changes

## Stack Position
- [ ] PR 1/N: Description (#xxx) - [Status]
- [x] PR 2/N: This PR
- [ ] PR 3/N: Description (#xxx) - [Status]

## Dependencies
**Depends on**: #xxx (merge that first)
**Blocks**: #xxx (must merge this first)

## Changes
- Change 1
- Change 2

## Test Plan
- [ ] Tests added
- [ ] CI passes
```

## Related Skills

- git-workflow: Branching, commits, and recovery patterns
- create-pr: PR creation basics

## References

- [Stack Management](references/stack-management.md)
- [Rebase Strategy](references/rebase-strategy.md)
