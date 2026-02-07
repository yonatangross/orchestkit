# Team Worktree Setup

Per-teammate git worktree management for Agent Teams. Extends the general [Worktree Workflow](worktree-workflow.md) with team-specific patterns.

---

## Branch Naming Convention

```
feat/{feature}/{role}
```

Examples:
- `feat/user-auth/backend`
- `feat/user-auth/frontend`
- `feat/user-auth/tests`
- `feat/dashboard/backend`
- `feat/dashboard/frontend`

All branches are created from the feature branch (not main):

```bash
# Start from the feature branch
git checkout feat/{feature}

# Create role branches
git branch feat/{feature}/backend
git branch feat/{feature}/frontend
git branch feat/{feature}/tests
```

---

## Worktree Setup Commands

The **lead** creates worktrees before spawning teammates:

```bash
# Create worktrees — one per implementing teammate
git worktree add ../{project}-backend feat/{feature}/backend
git worktree add ../{project}-frontend feat/{feature}/frontend
git worktree add ../{project}-tests feat/{feature}/tests

# Verify
git worktree list
```

**Directory layout after setup:**

```
../
├── {project}/              ← Main worktree (lead + code-reviewer)
├── {project}-backend/      ← backend-architect works here
├── {project}-frontend/     ← frontend-dev works here
└── {project}-tests/        ← test-engineer works here
```

---

## Teammate Assignment

Include the worktree path in each teammate's spawn prompt:

| Teammate | Worktree | Working Directory |
|----------|----------|-------------------|
| backend-architect | `../{project}-backend/` | Full project access, writes to backend dirs |
| frontend-dev | `../{project}-frontend/` | Full project access, writes to frontend dirs |
| test-engineer | `../{project}-tests/` | Full project access, writes to test dirs |
| code-reviewer | Main worktree | Read-only, reviews across all worktrees |

**Spawn prompt addition:**

```
## Your Working Directory
Work EXCLUSIVELY in: /path/to/{project}-backend/
Do NOT modify files in other worktrees.
Commit your changes to the feat/{feature}/backend branch.
```

---

## Merge Strategy

After all teammates complete, the lead merges each role branch:

### Squash Merge Per Role (Recommended)

```bash
# Switch to feature branch
git checkout feat/{feature}

# Merge each role as a single commit
git merge --squash feat/{feature}/backend
git commit -m "feat({feature}): backend implementation"

git merge --squash feat/{feature}/frontend
git commit -m "feat({feature}): frontend implementation"

git merge --squash feat/{feature}/tests
git commit -m "test({feature}): complete test suite"
```

### Handling Merge Conflicts

Conflicts typically occur in shared files:
- **Type definitions** — backend and frontend may define overlapping types
- **Package files** — both may add dependencies
- **Config files** — shared configuration

Resolution priority:
1. Backend types are authoritative (they own the API contract)
2. For package conflicts, combine both additions
3. For config conflicts, merge manually

---

## Cleanup

After successful merge and verification:

```bash
# Remove worktrees
git worktree remove ../{project}-backend
git worktree remove ../{project}-frontend
git worktree remove ../{project}-tests

# Delete role branches
git branch -d feat/{feature}/backend
git branch -d feat/{feature}/frontend
git branch -d feat/{feature}/tests

# Verify cleanup
git worktree list
git branch --list "feat/{feature}/*"
```

---

## When to Skip Worktrees

Not every Agent Teams session needs worktrees. Skip when:

| Condition | Skip Worktrees? | Reason |
|-----------|-----------------|--------|
| Read-only roles only (audit, review) | Yes | No file writes = no conflicts |
| Small feature (< 5 files) | Yes | File overlap unlikely |
| Teammates work in non-overlapping directories | Yes | Natural isolation |
| Single-stack scope (backend-only or frontend-only) | Yes | One writer, others are reviewers |
| Research/debugging task | Yes | Exploration, not implementation |

When skipping worktrees, teammates work in the same directory. The lead should assign **clear file ownership** in spawn prompts to prevent conflicts:

```
## File Ownership
You own: src/api/, src/models/, src/services/
Do NOT modify: src/components/, src/features/, src/hooks/
```

---

## Worktree + Agent Teams Checklist

Before spawning teammates:

- [ ] Feature branch exists (`feat/{feature}`)
- [ ] Role branches created from feature branch
- [ ] Worktrees added for each implementing teammate
- [ ] Each teammate's spawn prompt includes worktree path
- [ ] Code-reviewer assigned to main worktree (read-only)

After all teammates complete:

- [ ] All role branches have commits
- [ ] Squash merge each role into feature branch
- [ ] Merge conflicts resolved
- [ ] Integration tests pass on merged branch
- [ ] Worktrees removed
- [ ] Role branches deleted
