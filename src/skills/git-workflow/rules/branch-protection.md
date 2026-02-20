---
title: Configure branch protection rules to prevent direct commits to protected branches
impact: CRITICAL
impactDescription: "Direct commits to protected branches can break deployments and overwrite team work"
tags: branch, protection, main, dev, workflow
---

## Branch Protection Rules

Protected branches are the deployment pipeline. Never commit or push directly to them.

### Protected Branches

| Branch | Purpose | Direct Commit | Force Push |
|--------|---------|---------------|------------|
| `main` | Production-ready code | BLOCKED | BLOCKED |
| `master` | Legacy production | BLOCKED | BLOCKED |
| `dev` | Integration branch | BLOCKED | BLOCKED |
| `release/*` | Release candidates | BLOCKED | BLOCKED |

### Required Workflow

```bash
# 1. Create feature branch FROM main
git checkout main && git pull
git checkout -b issue/123-add-feature

# 2. Work on feature branch
git add -p && git commit -m "feat(#123): Add feature"

# 3. Push feature branch
git push -u origin issue/123-add-feature

# 4. Create PR targeting main (or dev)
gh pr create --base main

# 5. Merge via PR only (after review + CI)
```

### Branch Naming Convention

```bash
# Issue-linked (preferred)
issue/<number>-<brief-description>
issue/123-add-user-auth

# Type-based (when no issue exists)
feature/<description>
fix/<description>
hotfix/<description>        # For urgent production fixes
docs/<description>
refactor/<description>
test/<description>
chore/<description>
```

### Emergency Procedures

For production hotfixes that need to bypass normal flow:

```bash
# Create hotfix branch from main
git checkout main && git pull
git checkout -b hotfix/critical-fix

# Fix, test, push
git add . && git commit -m "fix: Resolve critical auth bypass"
git push -u origin hotfix/critical-fix

# Create PR with expedited review
gh pr create --base main --title "HOTFIX: Critical auth bypass"
```

**Incorrect — Direct commit to main:**
```bash
# Bypasses code review and CI
git checkout main
git commit -m "quick fix"
git push origin main
```

**Correct — Feature branch workflow:**
```bash
# PR-based deployment
git checkout -b fix/issue-123
git commit -m "fix(#123): Resolve auth bug"
git push -u origin fix/issue-123
gh pr create --base main
```

### Key Rules

- Never commit directly to main, dev, or release branches
- Always use feature branches with descriptive names
- All changes reach protected branches through PRs only
- Force push is only allowed on your own feature branches with `--force-with-lease`
- Delete feature branches after merge
