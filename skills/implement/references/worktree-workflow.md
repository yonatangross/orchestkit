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

```bash
# Create worktree with new branch
git worktree add ../project-feature feature/feature-name

# Create worktree from existing branch
git worktree add ../project-feature existing-branch

# List all worktrees
git worktree list

# Navigate to worktree
cd ../project-feature
```

## Workflow

```bash
# 1. Create worktree
git worktree add ../myapp-auth feature/user-auth

# 2. Work in isolation
cd ../myapp-auth
# ... make changes, commit normally ...

# 3. Merge back (from main worktree)
cd ../myapp
git checkout main
git merge feature/user-auth

# 4. Cleanup
git worktree remove ../myapp-auth
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

# Rebase then merge (linear)
cd ../myapp-auth
git rebase main
cd ../myapp
git merge feature/user-auth
```

## Cleanup with Uncommitted Changes

```bash
# Check for uncommitted changes
cd ../myapp-auth
git status

# If changes exist, either:
# Option A: Commit them
git add . && git commit -m "WIP: save progress"

# Option B: Stash them
git stash push -m "feature-auth-wip"

# Option C: Discard (CAREFUL!)
git checkout -- .

# Then remove worktree
cd ../myapp
git worktree remove ../myapp-auth
```

## Best Practices

1. **Naming:** Use `../project-featurename` pattern
2. **Short-lived:** Merge within 1-3 days
3. **One feature per worktree:** Don't mix concerns
4. **Regular sync:** Rebase from main frequently
5. **Clean before remove:** Always check `git status`
