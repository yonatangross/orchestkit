---
title: Create-PR Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. PR Title Format (title) — HIGH — 1 rule

Title conventions that enable automated changelogs and clear PR lists.

- `pr-title-format.md` — Under 70 chars, conventional prefixes, scope/issue reference

## 2. Pre-Flight Validation (preflight) — CRITICAL — 1 rule

Checks that must pass before creating a PR. Prevents wasted reviewer time.

- `preflight-validation.md` — Branch check, uncommitted changes, tests, lint, secrets

## 3. PR Body Structure (body) — HIGH — 1 rule

What every PR body must contain for reviewers and future archaeology.

- `pr-body-structure.md` — Required sections, closing keywords, generated-by footer

## 4. Branch Naming (branch) — MEDIUM — 1 rule

Branch name conventions that enable automated issue linking and PR categorization.

- `branch-naming.md` — Pattern, issue extraction, protected branches

## 5. Review Readiness (review) — HIGH — 1 rule

Criteria that determine whether a PR is ready for review or should be draft.

- `review-readiness.md` — Draft vs ready, self-review checklist, diff size limits

## 6. Diff Size Guidelines (size) — MEDIUM — 1 rule

Keep PRs small and reviewable. Large PRs get worse reviews and more bugs.

- `diff-size-guidelines.md` — Line limits, splitting strategies, exceptions
