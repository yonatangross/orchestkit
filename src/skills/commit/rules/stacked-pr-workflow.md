---
title: Split large features into small, reviewable, independently mergeable stacked PRs
impact: HIGH
impactDescription: "Large PRs over 400 lines slow reviews and increase merge risk — stacked PRs break features into small, reviewable, independently mergeable chunks"
tags: stacked-prs, pull-request, code-review, workflow, git
---

## Stacked PR Workflow

Break large features into small, dependent PRs that merge in sequence.

**Incorrect — single massive PR:**
```bash
# One 1500-line PR that takes days to review
git checkout -b feature/auth
gh pr create --title "feat: Add complete auth system"
```

**Correct — stacked PRs with clear dependencies:**
```bash
# PR 1: User model (base) — targets main
git checkout -b feature/auth-base
gh pr create --base main --title "feat(#100): Add User model [1/3]"

# PR 2: Auth service — targets PR 1's branch
git checkout -b feature/auth-service
gh pr create --base feature/auth-base --title "feat(#100): Add auth service [2/3]"

# PR 3: Login UI — targets PR 2's branch
git checkout -b feature/auth-ui
gh pr create --base feature/auth-service --title "feat(#100): Add login UI [3/3]"
```

**Key rules:**
- Keep each PR under 400 lines for effective review
- Number PRs clearly: `[1/3]`, `[2/3]`, `[3/3]`
- Each PR should be independently reviewable and leave tests passing
- Use draft PRs for incomplete stack items
- Do not stack more than 4-5 PRs deep
- Never merge out of order
