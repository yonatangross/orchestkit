---
title: Commit Splitting Strategies
impact: HIGH
impactDescription: "Large mixed commits create unreviewable PRs and make git history useless for debugging"
tags: splitting, interactive-staging, hunk, git-add-p
---

## Commit Splitting Strategies

When you have mixed changes in your working directory, use these strategies to create atomic commits.

### Strategy 1: Interactive Staging (`git add -p`)

Stage changes hunk-by-hunk to separate concerns:

```bash
# Stage changes interactively
git add -p

# Options at each hunk:
# y - stage this hunk
# n - skip this hunk
# s - split into smaller hunks (if hunk has gaps)
# e - manually edit the hunk boundaries
# q - quit, leave remaining unstaged

# Review what's staged vs unstaged
git diff --staged    # Will be committed
git diff             # Won't be committed

# Commit the staged portion
git commit -m "feat(#123): Add user validation"

# Repeat for next logical change
git add -p
git commit -m "fix(#456): Resolve timeout in auth"
```

### Strategy 2: File-Based Splitting

When changes are in separate files, stage by file:

```bash
# Stage only auth-related files
git add src/auth/login.ts src/auth/login.test.ts
git commit -m "feat(#123): Add login validation"

# Stage only billing-related files
git add src/billing/invoice.ts src/billing/invoice.test.ts
git commit -m "feat(#124): Add invoice generation"
```

### Strategy 3: Stash-Based Splitting

For complex mixed changes, use stash to isolate:

```bash
# Stash everything
git stash

# Apply and stage only what you need
git stash pop
git add -p  # Stage only feature A
git stash   # Re-stash the rest
git commit -m "feat: Feature A"

# Recover remaining changes
git stash pop
git add -p  # Stage feature B
git commit -m "feat: Feature B"
```

### Strategy 4: Pre-Commit Formatting Split

Always format BEFORE making logical changes:

```bash
# Step 1: Format first (separate commit)
npx prettier --write src/
git add -A
git commit -m "style: Format files with prettier"

# Step 2: Now make your logical changes
# ... edit files ...
git add -p
git commit -m "feat(#123): Add user dashboard"
```

### When to Split

| Signal | Action |
|--------|--------|
| `git diff --staged` shows > 10 files | Review if all related |
| Commit message needs "and" | Split into separate commits |
| Changes span > 3 unrelated directories | Split by directory/concern |
| Mix of feat + fix + chore | One commit per type |
| Formatting mixed with logic changes | Format first, then logic |

### Key Rules

- Use `git add -p` as the default — stage interactively, not `git add .`
- Format changes always go in their own commit
- Test files go with the code they test, not in separate commits
- When in doubt, split — smaller commits are always safer
- Each commit should pass tests independently
