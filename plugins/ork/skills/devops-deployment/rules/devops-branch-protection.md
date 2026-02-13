---
title: "CI/CD: Branch Protection"
category: cicd
impact: HIGH
impactDescription: "Unprotected branches allow direct pushes to production — bypassing code review, CI checks, and audit trails"
tags: [cicd, git, branch-protection, code-review]
---

## CI/CD: Branch Protection

Configure branch protection rules to enforce code review, passing CI checks, and linear history on critical branches. This prevents untested or unreviewed code from reaching production.

**Incorrect:**
```bash
# Direct push to main — no review, no CI checks
git checkout main
git commit -m "quick fix"
git push origin main

# Force push overwrites history
git push --force origin main
```

```yaml
# CI workflow with no branch restrictions
on:
  push:
    branches: ['*']
```

**Correct:**
```
Branch strategy with protection rules:

main (production) ─────●────────●──────>
                       |        |
dev (staging)  ─────●──●────●──●──────>
                    |        |
feature/*  ─────────●────────┘
                    ^
                    └─ PR required, CI checks, code review
```

**GitHub branch protection settings:**
```
main branch:
  - Require pull request before merging
  - Required approving reviews: 2
  - Require status checks to pass (lint, test, security)
  - Require branches to be up to date before merging
  - Do not allow force pushes
  - Do not allow deletions

dev branch:
  - Require pull request before merging
  - Required approving reviews: 1
  - Require status checks to pass (lint, test)
```

**Key rules:**
- `main` requires PR + 2 approvals + all status checks passing before merge
- `dev` requires PR + 1 approval + all status checks passing
- Never allow direct commits or force pushes to `main` or `dev`
- Feature branches must be created from `dev` and merged back via PR
- Require branches to be up-to-date before merging to prevent integration gaps
- Enable "Require linear history" to keep the commit graph clean and auditable

Reference: `references/ci-cd-pipelines.md` (lines 5-21)
