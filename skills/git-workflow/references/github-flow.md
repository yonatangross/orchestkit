# GitHub Flow Guide

The recommended branching strategy for most teams in 2026.

## Core Principles

1. **main is always deployable**
2. **Branch for every change**
3. **Short-lived branches (< 3 days)**
4. **PR for all changes**
5. **Delete after merge**

## Workflow Diagram

```
main ─────●───────●───────●───────●───────●──────
           \     / \     / \     / \     /
            ●───●   ●───●   ●───●   ●───●
           issue/  fix/    feat/   hotfix/
           123     456     789     critical

           1-2     0.5     2-3     0.5
           days    days    days    days
```

## Daily Workflow

### Morning

```bash
git checkout main
git pull origin main
git checkout -b issue/123-my-task
```

### During Day

```bash
# Make changes, commit atomically
git add -p
git commit -m "feat(#123): Part 1"

# Stay updated with main
git fetch origin
git rebase origin/main
```

### End of Day (or when ready)

```bash
# Push and create PR
git push -u origin issue/123-my-task
gh pr create --fill
```

### After Merge

```bash
git checkout main
git pull origin main
git branch -d issue/123-my-task
```

## Why Not GitFlow?

| GitFlow | GitHub Flow |
|---------|-------------|
| develop + main + release + hotfix | Just main |
| Complex merging | Simple merging |
| Scheduled releases | Continuous deployment |
| Merge conflicts | Few conflicts |
| Weeks-long branches | Days-long branches |

## When to Use Release Branches

Only for:
- Supporting multiple versions (v1.x, v2.x)
- Regulatory compliance requiring sign-off
- Mobile apps with app store review cycles

```bash
# Create release branch only when needed
git checkout -b release/v1.2 main
# Cherry-pick specific fixes
git cherry-pick abc1234
```

## Feature Flags Integration

When feature takes > 3 days:

```typescript
// Merge incomplete work behind flag
if (process.env.FF_NEW_FEATURE) {
  return <NewFeature />;
}
return <CurrentFeature />;
```

This allows:
- Merging to main daily
- Testing in production (flag off)
- Gradual rollout (flag percentage)
- Instant rollback (disable flag)
