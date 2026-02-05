# Reflog Recovery

The reflog is Git's safety net. It tracks every HEAD movement for ~90 days.

## What Reflog Captures

Every time HEAD changes, reflog records it:
- Commits
- Checkouts
- Resets
- Rebases
- Merges
- Cherry-picks
- Pulls

## Reading the Reflog

```bash
$ git reflog

abc1234 HEAD@{0}: commit: feat: Add auth
def5678 HEAD@{1}: checkout: moving from main to feature
ghi9012 HEAD@{2}: pull: Fast-forward
jkl3456 HEAD@{3}: reset: moving to HEAD~3
mno7890 HEAD@{4}: rebase: (finish)
pqr2345 HEAD@{5}: rebase: (start)
```

### Format Explained

```
abc1234 HEAD@{0}: commit: feat: Add auth
───────  ────────  ─────── ──────────────
   │        │         │          │
   │        │         │          └── Description
   │        │         └───────────── Action type
   │        └─────────────────────── Position (0 = most recent)
   └──────────────────────────────── Commit SHA
```

## Common Recovery Patterns

### Find Lost Commit

```bash
# Search by message
git reflog | grep "important feature"

# Search by date
git reflog --since="2 hours ago"

# Search by author action
git reflog | grep "commit:"
```

### Recover After Bad Reset

```bash
$ git reflog
abc1234 HEAD@{0}: reset: moving to HEAD~5  # Bad reset!
def5678 HEAD@{1}: commit: Important work   # Lost commit

$ git reset --hard HEAD@{1}  # Recovered!
```

### Recover After Bad Rebase

```bash
$ git reflog
abc1234 HEAD@{0}: rebase (finish)
def5678 HEAD@{1}: rebase (pick)
ghi9012 HEAD@{2}: rebase (start)     # Find pre-rebase state
jkl3456 HEAD@{3}: commit: My work    # This is what we want

$ git reset --hard HEAD@{3}  # Back to pre-rebase
```

### Find Deleted Branch

```bash
# Find last commit on deleted branch
git reflog | grep "checkout: moving from deleted-branch"

# Recreate branch
git checkout -b recovered abc1234
```

## Branch-Specific Reflog

```bash
# Reflog for specific branch
git reflog show feature-branch

# Reflog for remote tracking
git reflog show origin/main
```

## Reflog Expiration

```bash
# Default: 90 days for reachable, 30 days for unreachable
git config gc.reflogExpire          # Default: 90.days
git config gc.reflogExpireUnreachable  # Default: 30.days

# Keep forever (not recommended)
git config gc.reflogExpire never
```

## Pro Tips

1. **Check reflog FIRST** when something goes wrong
2. **Use HEAD@{n}** syntax in any git command
3. **Branch before dangerous ops**: `git branch backup`
4. **Reflog is local only** - not pushed to remote
5. **Each repo has separate reflog**
