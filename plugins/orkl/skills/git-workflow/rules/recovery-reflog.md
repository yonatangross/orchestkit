---
title: Reflog Recovery
impact: HIGH
impactDescription: "Assuming commits are lost after reset or branch deletion wastes hours — reflog preserves all HEAD movements for 90 days"
tags: git, recovery, reflog, lost-commits, branch-recovery
---

## Reflog Recovery

Use `git reflog` to recover lost commits, deleted branches, and botched rebases.

**Incorrect — assuming commits are gone after reset:**
```bash
git reset --hard HEAD~3  # "Oh no, those commits are lost forever\!"
# Wrong — reflog still has them
```

**Correct — reflog finds everything:**
```bash
# View all recent HEAD movements
git reflog --date=relative

# Find lost commits by message
git reflog | grep "search-term"

# Show reflog for specific branch
git reflog show branch-name

# Once found (e.g., abc1234), recover:
git branch recovered-work abc1234
# Or cherry-pick specific commits:
git cherry-pick abc1234
```

**Recover deleted branch:**
```bash
# Find the branch last commit
git reflog | grep -i "branch-name"
# Or check all recent activity:
git reflog --all | head -30

# Recreate the branch at that commit
git checkout -b recovered-branch abc1234

# Verify
git log --oneline -5
```

**Undo a bad rebase:**
```bash
# Find the pre-rebase state in reflog
git reflog | head -20
# Look for: "rebase (start): checkout main"
# The entry BEFORE that is your pre-rebase state

# Alternative: ORIG_HEAD is set before rebase
git reset --hard ORIG_HEAD

# WARNING: ORIG_HEAD is overwritten by other operations
# Use reflog if ORIG_HEAD might be stale
```

**Key rules:**
- Reflog keeps entries for ~90 days by default — rarely truly "lost"
- Always check reflog before assuming data is gone
- `ORIG_HEAD` is a shortcut but can be overwritten — reflog is more reliable
- Reflog is local only — not shared with remotes
