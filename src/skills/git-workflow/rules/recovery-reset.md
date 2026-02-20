---
title: Use git reset and restore safely by saving a backup reference first
impact: HIGH
impactDescription: "Using reset with hard flag without a backup reference destroys work permanently — always save a ref first"
tags: git, recovery, reset, restore, undo, soft-reset, hard-reset
---

## Reset and Restore

Undo commits and restore files safely using the right reset mode.

**Incorrect — hard reset without backup:**
```bash
git reset --hard HEAD~1  # Changes gone, no backup reference saved
# If this was wrong, recovery requires digging through reflog
```

**Correct — always save a backup reference first:**
```bash
# Save backup before destructive operation
BACKUP_REF=$(git rev-parse HEAD)
echo "Backup ref: $BACKUP_REF"

# Show what will be lost
git show HEAD --stat

# Then execute
git reset --hard HEAD~1

# Recovery if needed:
git reset --hard $BACKUP_REF
```

**Reset modes — choose carefully:**

| Mode | Commits | Staging | Working Dir | Use Case |
|------|---------|---------|-------------|----------|
| `--soft` | Undo | Keep staged | Keep | Amend/recombine commits |
| `--mixed` (default) | Undo | Unstage | Keep | Re-stage selectively |
| `--hard` | Undo | Discard | Discard | Throw everything away |

**Undo last commit, keep changes:**
```bash
git reset --soft HEAD~1
git status  # Changes are still staged
```

**Restore single file (non-destructive to other files):**
```bash
# Show changes to file first
git diff path/to/file

# Restore using modern git (2.23+)
git restore path/to/file

# Or older syntax
git checkout HEAD -- path/to/file
```

**Unstage files (keep changes in working directory):**
```bash
# Modern syntax
git restore --staged path/to/file

# Older syntax
git reset HEAD path/to/file
```

**Pushed vs not-pushed decision:**

| Scenario | Not Pushed | Already Pushed |
|----------|------------|----------------|
| Undo commit | `git reset --soft HEAD~1` | `git revert HEAD` |
| Wrong branch | cherry-pick + reset | cherry-pick + revert |
| Bad merge | `git reset --hard ORIG_HEAD` | `git revert -m 1 <merge>` |

**Key rules:**
- Always save a backup ref before `--hard` reset
- Prefer `--soft` when you want to re-commit differently
- Use `git revert` (not reset) for commits already pushed to shared branches
- `git restore` is the modern replacement for `git checkout -- file`
