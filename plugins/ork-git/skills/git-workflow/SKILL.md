---
name: git-workflow
description: Complete git workflow patterns including GitHub Flow branching, atomic commits with interactive staging, and recovery operations using reflog. Essential patterns for clean history. Use when defining branching strategy or recovering git history.
context: inherit
version: 1.0.0
tags: [git, branch, commit, recovery, workflow, reflog, staging]
user-invocable: false
---

# Git Workflow

Complete git workflow patterns: GitHub Flow branching, atomic commits, and recovery operations. Essential for maintaining clean, reviewable history.

## Branch Naming Convention

```bash
# Feature branches (link to issue)
issue/<number>-<brief-description>
issue/123-add-user-auth

# When no issue exists
feature/<description>
fix/<description>
hotfix/<description>
```

**Branch Rules:**
1. `main` is always deployable
2. Branch from `main`, PR back to `main`
3. Branches live < 1-3 days
4. Delete branch after merge

---

## Atomic Commit Checklist

```
[ ] Does ONE logical thing
[ ] Leaves codebase working (tests pass)
[ ] Message doesn't need "and" in title
[ ] Can be reverted independently
[ ] Title < 50 chars, body wraps at 72
```

### Interactive Staging

```bash
# Stage changes hunk-by-hunk
git add -p

# Options:
# y - stage this hunk
# n - skip this hunk
# s - split into smaller hunks
# e - manually edit the hunk
# q - quit

# Review what's staged
git diff --staged    # What will be committed
git diff             # What won't be committed
```

### Commit Patterns

```bash
# Separate concerns
git add -p && git commit -m "refactor: Extract database pool"
git add -p && git commit -m "feat(#456): Add query caching"

# Never combine unrelated changes
# BAD:  "feat: Add auth and fix formatting"
# GOOD: Two separate commits
```

---

## Recovery Quick Reference

### The Safety Net

```bash
# ALWAYS check reflog first - it has everything
git reflog

# Shows ALL recent HEAD movements
# Even "deleted" commits live here for 90 days
```

### Common Recovery Scenarios

| Scenario | Not Pushed | Already Pushed |
|----------|------------|----------------|
| Undo commit | `git reset --soft HEAD~1` | `git revert HEAD` |
| Wrong branch | cherry-pick + reset | cherry-pick + revert |
| Lost commits | `git reset --hard HEAD@{N}` | N/A |
| Bad rebase | `git rebase --abort` or reflog | reflog + force-with-lease |

### Quick Recovery Commands

```bash
# Undo last commit, keep changes staged
git reset --soft HEAD~1

# Find lost commits
git reflog | grep "your message"

# Recover to previous state
git reset --hard HEAD@{1}

# Safe force push (feature branches only)
git push --force-with-lease
```

---

## Standard Workflow

```bash
# 1. Start fresh
git checkout main && git pull origin main
git checkout -b issue/123-my-feature

# 2. Work with atomic commits
git add -p
git commit -m "feat(#123): Add User model"

# 3. Stay updated
git fetch origin && git rebase origin/main

# 4. Push and PR
git push -u origin issue/123-my-feature
gh pr create --fill

# 5. Cleanup after merge
git checkout main && git pull
git branch -d issue/123-my-feature
```

---

## Anti-Patterns

```
Avoid:
- Long-lived branches (> 1 week)
- Merging main into feature (use rebase)
- Direct commits to main
- Force push to shared branches
- Commits that need "and" in message
- Committing broken code
```

---

## Best Practices Summary

1. **Branch from main** - Always start fresh
2. **Stage interactively** - Use `git add -p`
3. **One thing per commit** - If you say "and", split it
4. **Rebase, don't merge** - Keep history clean
5. **Check reflog first** - When something goes wrong
6. **Force-with-lease** - Safer than force push
7. **Delete after merge** - No stale branches

## Related Skills

- `commit` - Create commits with conventional format and pre-commit validation
- `git-recovery-command` - Quick recovery from common git mistakes using reflog operations
- `stacked-prs` - Multi-PR development for large features with dependent PRs
- `create-pr` - Comprehensive PR creation with proper formatting

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Branching model | GitHub Flow | Simple single-branch workflow, main is always deployable |
| Merge strategy | Rebase over merge | Keeps history clean and linear, easier to bisect |
| Branch naming | issue/<number>-<desc> | Links work to tracking, enables automation |
| Commit granularity | Atomic (one thing) | Independent revert, clear history, easier review |
| Force push | --force-with-lease only | Prevents overwriting others' work on shared branches |

## References

- [GitHub Flow Guide](references/github-flow.md)
- [Interactive Staging](references/interactive-staging.md)
- [Reflog Recovery](references/reflog-recovery.md)
- [Recovery Decision Tree](references/recovery-decision-tree.md)

## Checklists

- [Branch Checklist](checklists/branch-checklist.md) - Pre-flight checks before creating branches
- [Pre-Commit Checklist](checklists/pre-commit-checklist.md) - Validation before committing
