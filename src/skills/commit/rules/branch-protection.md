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

### Branch Naming Convention

```bash
# Issue-linked (preferred)
issue/<number>-<brief-description>
issue/123-add-user-auth

# Type-based (when no issue exists)
feature/<description>
fix/<description>
hotfix/<description>
```

**Incorrect — Direct commit to main:**
```bash
git checkout main
git commit -m "quick fix"
git push origin main
```

**Correct — Feature branch workflow:**
```bash
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
