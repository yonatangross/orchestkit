---
title: Always ExitWorktree after implementation — never leave orphaned worktrees
impact: HIGH
impactDescription: "Orphaned worktrees consume disk space, cause git lock conflicts, and confuse subsequent sessions that detect stale branches"
tags: [worktree, git, cleanup, exit, isolation]
---

## Worktree Cleanup

When the implement skill uses `EnterWorktree` for isolation, it MUST call `ExitWorktree` before completing — regardless of success or failure. Orphaned worktrees block future git operations and leak disk space.

### Problem

Claude enters a worktree for isolation but forgets to exit when the implementation finishes, errors out, or gets interrupted. The worktree directory and its lock file persist, causing `git worktree add` failures in the next session.

**Incorrect — enter worktree, finish, but never exit:**
```python
# Phase 3: Enter worktree
EnterWorktree(name="feat-user-auth")

# Phase 5: Implementation agents run in worktree
Agent(subagent_type="backend-system-architect", prompt="Implement auth...")

# Phase 9: Documentation
# "Done! Here's what was implemented..."
# ← MISSING: ExitWorktree never called
# Next session: "fatal: 'feat-user-auth' is already checked out"
```

**Correct — exit worktree in all code paths:**
```python
# Phase 3: Enter worktree
EnterWorktree(name="feat-user-auth")

# Phase 5-8: Implementation, verification, testing...
# (all work happens in worktree)

# Phase 9: Before documentation, merge and exit
Bash("git add -A && git commit -m 'feat: user auth implementation'")
ExitWorktree()  # Merges back to original branch and removes worktree

# Phase 10: Reflection (back in main working tree)
```

**Correct — exit worktree even on failure:**
```python
# Phase 3: Enter worktree
EnterWorktree(name="feat-user-auth")
worktree_active = True

# Phase 5: Implementation fails
try:
    Agent(subagent_type="backend-system-architect", prompt="...")
except:
    # STILL clean up the worktree
    if worktree_active:
        Bash("git stash")  # Save partial work
        ExitWorktree()
        worktree_active = False
    raise

# Normal exit path
if worktree_active:
    ExitWorktree()
```

### Verification

After `ExitWorktree`, confirm cleanup:

```bash
# Should NOT list the feature worktree
git worktree list
# Expected: only the main worktree
# /path/to/repo  abc1234 [main]
```

### Key Rules

- Every `EnterWorktree` must have a matching `ExitWorktree`
- Call `ExitWorktree` BEFORE Phase 10 (Reflection) so reflection runs in the main tree
- On error or early exit, still call `ExitWorktree` to prevent orphaning
- If resuming a session that has an active worktree, check `git worktree list` first
- Never assume the worktree will be cleaned up by a future session
- Include worktree status in handoff JSON: `"worktree_active": false` after cleanup
