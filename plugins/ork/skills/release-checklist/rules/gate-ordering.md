---
title: Release Gate Ordering
impact: CRITICAL
impactDescription: "Skipping gates can release broken or insecure code"
tags: [release, gates, ordering]
---

# Release Gate Ordering

## Rule

Release gates must run **in sequence**. Stop at the first FAIL and do not proceed until it is resolved.

## Gate Sequence

```
1. Build → 2. Tests → 3. Security → 4. TypeScript → 5. Counts
  → 6. Changelog → 7. Version → 8. Diff → 9. Stage → 10. Commit → 11. Tag → 12. Push
```

## Stop on Failure

| Gate | On FAIL |
|------|---------|
| Build | Fix src/ errors, re-run `npm run build` |
| Tests | Fix failing tests before proceeding |
| Security | MUST fix — no exceptions, no skipping |
| TypeScript | Fix type errors in `src/hooks/src/` |
| Counts | Update manifests or re-run `npm run build` |
| Changelog | Add entry to CHANGELOG.md |
| Version | Update both package.json and CLAUDE.md |

## Why Sequential?

A failed build means tests run against stale plugins/. A failed security test means the release is unsafe. Order matters because each gate depends on the previous one passing.
