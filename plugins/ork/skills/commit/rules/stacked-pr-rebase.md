---
title: Rebase dependent PRs systematically after base branch changes to prevent conflicts
impact: HIGH
impactDescription: "Failing to rebase dependent PRs after base changes causes merge conflicts and broken CI"
tags: stacked-prs, rebase, force-with-lease, git, merge-conflicts
---

## Stacked PR Rebase Management

Keep stacked PR branches synchronized after feedback, merges, or base branch changes.

**Incorrect — merging main into feature branches:**
```bash
git checkout feature/auth-service
git merge main  # Creates unnecessary merge commit
```

**Correct — rebase after base PR feedback:**
```bash
# Rebase dependent branches in order:
git checkout feature/auth-service
git rebase feature/auth-base
git push --force-with-lease

git checkout feature/auth-ui
git rebase feature/auth-service
git push --force-with-lease
```

**After base PR merges to main:**
```bash
git checkout main && git pull origin main

# Retarget PR #2 to main
gh pr edit 102 --base main

# Rebase PR #2 on updated main
git checkout feature/auth-service
git rebase main
git push --force-with-lease
```

**Key rules:**
- Always rebase, never merge main into feature branches
- Use `--force-with-lease` (never `--force`) to prevent overwriting others' work
- Rebase in dependency order: base first, then each dependent branch
- After a base PR merges, retarget the next PR to `main` via `gh pr edit`
