---
title: Choose the right merge strategy for clean, bisectable commit history
impact: HIGH
impactDescription: "Wrong merge strategy creates noisy history that's hard to bisect and review"
tags: rebase, merge, conflict, strategy, history
---

## Merge Strategy Rules

Use rebase-first workflow to maintain clean, linear history on feature branches.

### Decision Table

| Scenario | Strategy | Command |
|----------|----------|---------|
| Update feature branch with main | Rebase | `git rebase origin/main` |
| Merge PR into main | Squash merge or merge commit | Via GitHub PR |
| Shared feature branch | Merge (preserve history) | `git merge origin/main` |

### Rebase-First Workflow

```bash
git fetch origin
git rebase origin/main

# If conflicts: resolve, stage, continue
git add <resolved-files>
git rebase --continue

# If rebase goes wrong
git rebase --abort
```

### Force Push Safety

```bash
# SAFE: Force push your own feature branch
git push --force-with-lease origin issue/123-feature

# DANGEROUS: Never force push protected branches
git push --force origin main  # NEVER DO THIS
```

**Incorrect — Merge main into feature:**
```bash
git checkout feature-branch
git merge origin/main  # Creates noisy merge commits
```

**Correct — Rebase onto main:**
```bash
git checkout feature-branch
git rebase origin/main
git push --force-with-lease
```

### Key Rules

- Rebase feature branches onto main — don't merge main into feature branches
- Use `--force-with-lease` instead of `--force` for rebased branches
- Resolve conflicts during rebase, not with merge commits
- Test after every conflict resolution
