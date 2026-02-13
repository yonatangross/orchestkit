---
title: Stash Recovery
impact: MEDIUM
impactDescription: "Lost stash entries cannot be recovered after garbage collection — name stashes and check reflog promptly"
tags: git, recovery, stash, save, pop, lost-work
---

## Stash Recovery

Save and recover work-in-progress using git stash safely.

**Incorrect — unnamed stash that gets lost:**
```bash
git stash        # Generic "WIP on main" message
git stash        # Another generic stash
git stash pop    # Which one was it? Wrong one applied
git stash drop   # Lost the other one
```

**Correct — named stashes with safe recovery:**
```bash
# Save with descriptive name
git stash push -m "auth-flow: halfway through token refresh"

# List stashes to find the right one
git stash list
# stash@{0}: On main: auth-flow: halfway through token refresh
# stash@{1}: On main: fix: database connection pooling

# Apply specific stash (keeps it in stash list)
git stash apply stash@{1}

# Apply and remove from list
git stash pop stash@{0}
```

**Recover a dropped stash:**
```bash
# Stash entries appear in reflog briefly
git fsck --no-reflog | grep commit

# Once found, apply it:
git stash apply <commit-hash>
```

**Stash specific files:**
```bash
# Stash only specific files
git stash push -m "partial work" -- path/to/file1 path/to/file2

# Stash including untracked files
git stash push -u -m "including new files"
```

**Key rules:**
- Always use `-m` with a descriptive message when stashing
- Prefer `git stash apply` over `pop` until you verify the result is correct
- Dropped stashes can be recovered via `git fsck` but only before garbage collection
- Use `git stash push -- <files>` to stash specific files, not everything
- Stash includes staged changes by default; use `--keep-index` to stash only unstaged
