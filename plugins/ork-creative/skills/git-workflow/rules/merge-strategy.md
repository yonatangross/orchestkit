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
| Resolve diverged branches | Rebase onto target | `git rebase origin/main` |
| Shared feature branch | Merge (preserve history) | `git merge origin/main` |
| Release branch | Merge commit | Via GitHub PR |

### Rebase-First Workflow

```bash
# Keep feature branch up to date
git fetch origin
git rebase origin/main

# If conflicts arise
# 1. Resolve conflicts in each file
# 2. Stage resolved files
git add <resolved-files>
# 3. Continue rebase
git rebase --continue

# If rebase goes wrong
git rebase --abort  # Start over
```

### When NOT to Rebase

```
DO NOT rebase if:
- Branch is shared with other developers (changes published history)
- You've already pushed and others have pulled
- Working on a release branch

USE merge instead:
git merge origin/main
```

### Conflict Resolution

```bash
# 1. Understand the conflict
git diff  # Shows conflict markers

# 2. Resolve by choosing correct code
# <<<<<<< HEAD       ← your changes
# ...
# =======
# ...                ← incoming changes
# >>>>>>> main

# 3. Test after resolution
npm test  # Verify nothing broke

# 4. Continue
git add <resolved-files>
git rebase --continue
```

### Force Push Safety

```bash
# SAFE: Force push your own feature branch
git push --force-with-lease origin issue/123-feature

# DANGEROUS: Never force push protected branches
git push --force origin main  # NEVER DO THIS

# --force-with-lease prevents overwriting others' pushes
# It fails if remote has commits you don't have locally
```

**Incorrect — Merge main into feature:**
```bash
# Creates noisy merge commits
git checkout feature-branch
git merge origin/main  # Creates "Merge branch 'main' into feature" commit
```

**Correct — Rebase onto main:**
```bash
# Linear history
git checkout feature-branch
git rebase origin/main  # Replays feature commits on top of main
git push --force-with-lease
```

### Key Rules

- Rebase feature branches onto main — don't merge main into feature branches
- Use `--force-with-lease` instead of `--force` for rebased branches
- Resolve conflicts during rebase, not with merge commits
- Test after every conflict resolution
- Abort rebase if unsure — you can always start over
