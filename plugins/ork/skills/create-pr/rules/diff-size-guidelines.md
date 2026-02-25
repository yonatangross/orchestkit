---
title: "Diff Size Guidelines"
impact: "MEDIUM"
impactDescription: "Large PRs get rubber-stamped, hide bugs, and are harder to revert"
tags: [pr, size, review, splitting]
---

## Diff Size Guidelines

Smaller PRs get better reviews, merge faster, and are easier to revert.

**Size thresholds:**

| Lines changed | Category | Action |
|---------------|----------|--------|
| < 50 | Tiny | Merge quickly |
| 50-200 | Small | Ideal PR size |
| 200-400 | Medium | Acceptable, consider splitting |
| 400-800 | Large | Split if possible |
| > 800 | Too large | Must split (except generated/vendored files) |

**Key rules:**
- Aim for under 400 lines of meaningful change
- Generated files (lockfiles, build output) don't count toward the limit
- One logical change per PR (same principle as atomic commits)
- If a feature requires 800+ lines, split into stacked PRs

**Splitting strategies:**
- Separate infrastructure/config changes from feature code
- Split backend and frontend into separate PRs
- Extract refactoring into a prep PR, then add the feature
- Split by module/domain boundary

**When large PRs are acceptable:**
- Auto-generated code (migrations, protobuf, lockfiles)
- Bulk renames or reformatting (use a dedicated PR with no logic changes)
- Initial project scaffolding
- Dependency updates with lockfile changes

**Checking diff size:**
```bash
git diff dev...HEAD --stat          # File-level summary
git diff dev...HEAD --shortstat     # One-line total
```
