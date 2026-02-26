---
title: Rebase dependent PRs systematically after base branch changes to prevent conflicts
impact: HIGH
impactDescription: "Failing to rebase dependent PRs after base changes causes merge conflicts and broken CI — systematic rebase keeps the entire stack clean"
tags: stacked-prs, rebase, force-with-lease, git, merge-conflicts
---

## Stacked PR Rebase Management

Keep stacked PR branches synchronized after feedback, merges, or base branch changes.

**Incorrect — merging main into feature branches:**
```bash
# WRONG: Merge commits pollute history
git checkout feature/auth-service
git merge main  # Creates unnecessary merge commit
git merge feature/auth-base  # More merge commits
# History becomes unreadable mess
```

**Correct — rebase after base PR feedback:**
```bash
# When base PR (auth-base) gets review feedback:
git checkout feature/auth-base
git add -p && git commit -m "fix: Address review feedback"
git push

# Rebase dependent branches in order:
git checkout feature/auth-service
git rebase feature/auth-base
git push --force-with-lease  # Safe: won't overwrite others' work

git checkout feature/auth-ui
git rebase feature/auth-service
git push --force-with-lease
```

**After base PR merges to main:**
```bash
# PR #1 merged to main
git checkout main && git pull origin main

# Retarget PR #2 to main (via GitHub CLI)
gh pr edit 102 --base main

# Rebase PR #2 on updated main
git checkout feature/auth-service
git rebase main
git push --force-with-lease

# After PR #2 merges, repeat for PR #3
```

**Automation script for rebasing entire stack:**
```bash
#!/bin/bash
# stack-rebase.sh — Rebase entire stack in sequence
STACK=(
  "feature/auth-base"
  "feature/auth-service"
  "feature/auth-ui"
)

BASE="main"
for branch in "${STACK[@]}"; do
  echo "Rebasing $branch onto $BASE..."
  git checkout "$branch"
  git rebase "$BASE" || { echo "Conflict in $branch! Resolve and re-run."; exit 1; }
  git push --force-with-lease
  BASE="$branch"
done
echo "Stack rebased successfully!"
```

**Key rules:**
- Always rebase, never merge main into feature branches
- Use `--force-with-lease` (never `--force`) to prevent overwriting others' work
- Rebase in dependency order: base first, then each dependent branch
- After a base PR merges, retarget the next PR to `main` via `gh pr edit`
- If rebase conflicts occur, resolve in the lowest branch first, then cascade
- Never force push to already-approved PRs without re-requesting review
