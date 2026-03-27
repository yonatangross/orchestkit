---
title: "Expect Skill Rules — Table of Contents"
---

# Rules Index

Prescriptive patterns for /ork:expect. Each rule file contains incorrect/correct code pairs.

## Categories

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Diff Targeting](#diff-targeting) | 2 | HIGH | Scoping test runs to changed code |
| [Execution Safety](#execution-safety) | 2 | CRITICAL | Preventing flaky/dangerous test runs |
| [Reporting](#reporting) | 1 | MEDIUM | Output format and artifact storage |

## Diff Targeting

- `diff-scope-boundaries.md` — Never test unrelated pages; always scope via route map
- `fingerprint-invalidation.md` — When to invalidate fingerprints (checkout, stash, merge)

## Execution Safety

- `no-parallel-browsers.md` — Sequential page testing to avoid port/state conflicts
- `timeout-and-retry.md` — Element wait, page load, and network timeout rules

## Reporting

- `artifact-storage.md` — Screenshot, report, and fingerprint file conventions
