# Recovery Decision Tree

Quick reference for choosing the right recovery approach.

## Decision Tree

```
What happened?
│
├─ Committed to wrong branch?
│  ├─ Not pushed → cherry-pick + reset
│  └─ Pushed → cherry-pick + revert
│
├─ Need to undo commit?
│  ├─ Keep changes → git reset --soft HEAD~1
│  ├─ Discard changes → git reset --hard HEAD~1
│  └─ Already pushed → git revert HEAD
│
├─ Lost commits?
│  └─ Check reflog → git reset --hard HEAD@{N}
│
├─ Deleted branch?
│  └─ Check reflog → git checkout -b name SHA
│
├─ Bad merge?
│  ├─ Not pushed → git reset --hard HEAD~1
│  └─ Pushed → git revert -m 1 SHA
│
└─ Rebase disaster?
   ├─ Still rebasing → git rebase --abort
   └─ Completed → reflog → reset
```

## Detailed Recovery Commands

### Undo Last Commit

```bash
# Keep changes staged
git reset --soft HEAD~1

# Keep changes unstaged
git reset --mixed HEAD~1

# Discard changes completely (DANGER)
git reset --hard HEAD~1

# Already pushed - create reverting commit
git revert HEAD
```

### Committed to Wrong Branch

**Not pushed:**
```bash
# Note the commit SHA
git log -1  # abc1234

# Undo on wrong branch
git reset --hard HEAD~1

# Apply to correct branch
git checkout correct-branch
git cherry-pick abc1234
```

**Already pushed:**
```bash
# Cherry-pick to correct branch
git checkout correct-branch
git cherry-pick abc1234
git push origin correct-branch

# Revert on wrong branch
git checkout wrong-branch
git revert abc1234
git push origin wrong-branch
```

### Recover Lost Commits

```bash
# Find in reflog
git reflog

# Reset to before the bad operation
git reset --hard HEAD@{N}

# Or cherry-pick specific commits
git cherry-pick abc1234
```

### Recover Deleted Branch

```bash
# Find branch's last commit
git reflog | grep "checkout: moving from deleted-branch"

# Recreate branch
git checkout -b recovered-branch abc1234
```

### Fix Rebase Disasters

**Mid-rebase:**
```bash
# Abort and start over
git rebase --abort

# Skip problematic commit
git rebase --skip

# Continue after fixing conflicts
git add .
git rebase --continue
```

**After rebase completed:**
```bash
# Find pre-rebase state in reflog
git reflog

# Reset to before rebase
git reset --hard HEAD@{N}

# Force push if needed (feature branches only!)
git push --force-with-lease
```

### Undo Merge

**Not pushed:**
```bash
git reset --hard HEAD~1
```

**Already pushed:**
```bash
# -m 1 keeps first parent (your branch)
git revert -m 1 <merge-commit-sha>
git push
```

### Recover Stashed Changes

```bash
# List stashes
git stash list

# Apply most recent
git stash pop

# Apply specific stash
git stash apply stash@{2}

# Recover dropped stash (search reflog)
git reflog | grep "WIP on"
```

## Prevention Tips

```bash
# Backup before dangerous operations
git branch backup-before-rebase

# Use safer force push
git push --force-with-lease

# Commit early, commit often
# More recovery points = easier recovery
```

## Key Principle

**Stay calm** - Git almost never loses data permanently. The reflog keeps everything for 90 days.
