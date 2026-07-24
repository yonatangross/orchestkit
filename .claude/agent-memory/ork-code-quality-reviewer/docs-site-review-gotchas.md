---
name: docs-site-review-gotchas
description: Non-obvious review gotchas for docs/site (vitest config, cc-support policy field, fumadocs search bounding)
metadata:
  type: project
---

# docs/site review gotchas (verified 2026-06-08, PRs #2278/#2295)

## Test runner foot-gun
`docs/site/__tests__/*.test.ts` CANNOT run via bare `npx vitest` from docs/site — a root
workspace references `src/hooks` and crashes at startup ("non-existing file ... /docs/site/src/hooks").
MUST use `npx vitest run -c vitest.site.config.ts` (the package.json `test` script does this).
A reviewer/CI calling the default runner from that dir gets a FALSE red.
**Why:** stale root vitest.workspace resolution from docs/site cwd.
**How to apply:** always pass `-c vitest.site.config.ts` when running docs-site tests standalone.

## fumadocs search IS bounded (don't flag /api/search as unbounded)
`createSearchAPI("advanced")` route (docs/site/app/api/search/route.ts) looks unbounded (22 lines,
no explicit limit) but fumadocs `searchAdvanced` defaults `limit: 60` (node_modules/fumadocs-core/dist/advanced-*.js).
Only `query`+`tag` come from searchParams; no injection surface. Highlight is React-segment based
(search-highlight.tsx) — no dangerouslySetInnerHTML, genuinely XSS-safe.

## Orama 3.1.18 quirks confirmed
- `create({schema})` is SYNCHRONOUS in 3.x — orama-browser.ts:66 non-awaited assignment is CORRECT.
- enum[] fields reject `{in:[...]}` where-filters (need containsAny); agent-selector.tsx filters
  taskTypes in JS as a documented workaround. Not a bug.

## cc-support.json policy-field debt
After #2295 the merged shared/cc-support.json sets floor=latest=latest_known=2.1.168 (latest+0) but
KEEPS `"policy":"latest + 3 previous minors"` and points at cc-support-policy.md (floor=max-3).
The `policy` STRING now contradicts the config — only manual_override.reason reconciles it. When
`expires` passes, cc-support-window-bump.yml recomputes max-3 and will fight this. Flag the stale
policy string as debt on any future cc-support review. [[split-bundles.test.ts Pattern]]
