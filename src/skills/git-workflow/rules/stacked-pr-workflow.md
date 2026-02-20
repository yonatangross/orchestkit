---
title: Split large features into small, reviewable, independently mergeable stacked PRs
impact: HIGH
impactDescription: "Large PRs over 400 lines slow reviews and increase merge risk — stacked PRs break features into small, reviewable, independently mergeable chunks"
tags: stacked-prs, pull-request, code-review, workflow, git
---

## Stacked PR Workflow

Break large features into small, dependent PRs that merge in sequence for faster reviews and cleaner history.

**Incorrect — single massive PR:**
```bash
# WRONG: One 1500-line PR that takes days to review
git checkout -b feature/auth
# ... 3 days of work, 40 files changed ...
gh pr create --title "feat: Add complete auth system"
# Reviewer: "This is too large to review effectively"
```

**Correct — stacked PRs with clear dependencies:**
```bash
# PR 1: User model (base) — targets main
git checkout main && git pull origin main
git checkout -b feature/auth-base
git add -p && git commit -m "feat(#100): Add User model"
git push -u origin feature/auth-base
gh pr create --base main --title "feat(#100): Add User model [1/3]" \
  --body "## Stack
- **PR 1/3: User model (this PR)**
- PR 2/3: Auth service (depends on this)
- PR 3/3: Login UI (depends on #2)

## Changes
- Add User model with validation
- Add database migrations"

# PR 2: Auth service — targets PR 1's branch
git checkout -b feature/auth-service  # branches from auth-base
git add -p && git commit -m "feat(#100): Add auth service"
git push -u origin feature/auth-service
gh pr create --base feature/auth-base \
  --title "feat(#100): Add auth service [2/3]" \
  --body "**Depends on #101** — merge that first"

# PR 3: Login UI — targets PR 2's branch
git checkout -b feature/auth-ui
git commit -m "feat(#100): Add login form"
git push -u origin feature/auth-ui
gh pr create --base feature/auth-service \
  --title "feat(#100): Add login UI [3/3]"
```

**Stack visualization in PR body:**
```markdown
## PR Stack for Auth Feature (#100)

| Order | PR | Status | Branch |
|-------|-----|--------|--------|
| 1 | #101 | Merged | feature/auth-base |
| 2 | #102 | Review | feature/auth-service |
| 3 | #103 | Draft | feature/auth-ui |

**Merge order**: #101 -> #102 -> #103
```

**Key rules:**
- Keep each PR under 400 lines for effective review
- Number PRs clearly: `[1/3]`, `[2/3]`, `[3/3]`
- Each PR should be independently reviewable and leave tests passing
- Use draft PRs for incomplete stack items
- Do not stack more than 4-5 PRs deep
- Never merge out of order
