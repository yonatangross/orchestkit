# Worktree Isolation Mode

## When to Use

- Feature touches 5+ files across multiple directories
- Multiple developers working on same branch
- Risky refactoring that may need rollback
- Agent Teams mode with parallel agents editing overlapping files

## Workflow

### 1. Enter Worktree

```python
# CC 2.1.49: Native worktree support
EnterWorktree(name="feat-{feature-slug}")
```

This creates:
- New branch `feat-{feature-slug}` from HEAD
- Working directory at `.claude/worktrees/feat-{feature-slug}/`
- Session CWD switches to the worktree automatically

### 2. Implement in Isolation

All implementation phases (4-8) run in the worktree. Benefits:
- Main branch stays clean — no partial changes
- Multiple agents can work without stepping on each other
- Easy rollback: just delete the worktree branch

### 3. Merge Back

After Phase 8 (E2E Verification) passes:

```bash
# Return to original branch
git checkout {original-branch}

# Merge the feature
git merge feat-{feature-slug}

# Clean up worktree (prompted on session exit)
```

### 4. Conflict Resolution

If merge conflicts arise:
1. Show conflicting files to user
2. Present diff with `AskUserQuestion` for resolution choices
3. Apply user's chosen resolution
4. Re-run Phase 6 verification on merged result

## Context Gate Integration

When running in a worktree, the `context-gate` SubagentStart hook raises concurrency limits:
- `MAX_CONCURRENT_BACKGROUND`: 6 → 10 (worktree isolation reduces contention)
- `MAX_AGENTS_PER_RESPONSE`: 8 → 12

This is safe because worktree agents operate on an isolated file tree.

## Config Sharing (CC 2.1.63+)

Since CC 2.1.63, project configs and auto-memory are **automatically shared** across git worktrees. No manual copying needed:

- `.claude/settings.json` — shared across all worktrees
- `.claude/memory/` — auto-memory persists across worktrees
- `CLAUDE.md` — project instructions available in every worktree
- Plugin configs — plugins discovered from any worktree

For CC < 2.1.63, configs must be manually copied to each worktree directory.

## CLI Alternative

Users can also start worktrees manually:

```bash
claude --worktree    # or -w
```

This creates the worktree before the session starts, equivalent to `EnterWorktree` but at CLI level.

## Limitations

- Cannot nest worktrees (worktree inside worktree)
- Session exit prompts to keep or remove the worktree
- Some git operations (rebase, bisect) may behave differently in worktrees
