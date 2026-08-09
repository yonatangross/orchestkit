# Git Worktree Workflow

Isolate feature work in dedicated worktrees for clean development and easy rollback.

## When to Use Worktrees

| Scenario | Worktree? | Reason |
|----------|-----------|--------|
| Large feature (5+ files) | YES | Isolation prevents pollution |
| Experimental/risky changes | YES | Easy to discard entirely |
| Parallel feature development | YES | Work on multiple features |
| Hotfix while mid-feature | YES | Don't stash incomplete work |
| Quick bug fix (1-2 files) | No | Overhead not worth it |

## Setup Commands

Put the worktree INSIDE the repo, at `.worktrees/<task>`. Never at a sibling
`../<repo>-<task>`: a sibling path sits outside the session's project directory, and the
harness bounces any `cd` that leaves it. The command appears to succeed, then every later
command runs in the PRIMARY tree. That is the failure behind platform#9870, where work was
committed onto another agent's branch (#3319).

```bash
# Create worktree with new branch — helper does the safety checks and prints the path
WT=$(~/.claude/hooks/worktree-new.sh <task> feature/feature-name) && cd "$WT"

# By hand, if you must — note the path is INSIDE the repo
git worktree add .worktrees/<task> -b feature/feature-name origin/main

# From an existing branch
git worktree add .worktrees/<task> existing-branch

# List all worktrees
git worktree list

# Confirm the move actually took — the cd reset is silent
pwd
```

## Workflow

```bash
# 1. Create worktree
WT=$(~/.claude/hooks/worktree-new.sh auth feature/user-auth) && cd "$WT"
pwd   # must be the worktree, NOT the repo root

# 2. Work in isolation
# ... make changes, commit normally ...

# 3. Merge back (from the primary tree)
cd /path/to/myapp
git checkout main
git merge feature/user-auth

# 4. Cleanup
git worktree remove .worktrees/auth
git branch -d feature/user-auth
```

## Merge Strategies

| Strategy | When to Use |
|----------|-------------|
| **Merge commit** | Default, preserves history |
| **Squash merge** | Many small commits, clean history wanted |
| **Rebase first** | Linear history preferred |

```bash
# Squash merge (single commit)
git merge --squash feature/user-auth
git commit -m "feat: Add user authentication"

# Rebase then merge (linear).
# Prefer `git -C <path>` over cd — it never depends on the cd sticking.
git -C .worktrees/auth rebase main
git merge feature/user-auth
```

## Cleanup with Uncommitted Changes

```bash
# Check for uncommitted changes
git -C .worktrees/auth status

# If changes exist, either:
# Option A: Commit them
git -C .worktrees/auth add . && git -C .worktrees/auth commit -m "WIP: save progress"

# Option B: Stash them
git -C .worktrees/auth stash push -m "feature-auth-wip"

# Option C: Discard (CAREFUL!)
git -C .worktrees/auth checkout -- .

# Then remove worktree (run from the primary tree)
git worktree remove .worktrees/auth
```

## Best Practices

1. **Location:** Always `.worktrees/<task>` inside the repo, never a sibling `../project-task`
2. **Short-lived:** Merge within 1-3 days
3. **One feature per worktree:** Don't mix concerns
4. **Regular sync:** Rebase from main frequently
5. **Clean before remove:** Always check `git status`
