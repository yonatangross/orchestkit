---
name: validate-counts
description: Validates hook, skill, and agent counts are consistent across CLAUDE.md, hooks.json, manifests, and source directories. Use when counts may be stale after adding or removing components, before releases, or when CLAUDE.md Project Overview looks wrong.
tags: [validation, consistency, orchestkit]
version: 2.0.0
author: OrchestKit
user-invocable: true
complexity: low
---

# Validate Counts

Checks that hook, skill, and agent counts are consistent across all authoritative sources in OrchestKit. Outputs a comparison table and flags drift with precise file references.

## Quick Start

```bash
# Full validation: counts src/ vs CLAUDE.md and manifests (run from repo root)
bash src/skills/validate-counts/scripts/validate-counts.sh

# Just get raw counts from src/
bash src/skills/validate-counts/scripts/count-all.sh
```

## Rules

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| Count Sources | `rules/sources-authoritative.md` | HIGH | Filesystem is authoritative; derived sources must match |
| Drift Detection | `rules/drift-reporting.md` | HIGH | Comparison table + flag with file:field references |

**Total: 2 rules across 2 categories**

## Workflow

1. Run `scripts/validate-counts.sh` for full validation (counts + drift comparison), or `scripts/count-all.sh` for raw counts only
2. Read `CLAUDE.md` — extract counts from Project Overview and Version section
3. Read `manifests/ork.json` and `manifests/orkl.json` — check skill/agent/hook array lengths
4. Build the comparison table (see `rules/drift-reporting.md` for format)
5. Flag any mismatches with file + field references; otherwise output "All counts consistent."

## References

- [Count Locations](references/count-locations.md) — Where every count lives and why drift happens

## Related Skills

- `release-checklist` — Uses validate-counts as step 5 of the release gate
- `doctor` — Broader health check that includes count validation
- `audit-skills` — Quality audit for skill structure and completeness

## Common Mistakes

1. Counting from `plugins/` instead of `src/` — plugins/ may be empty after an interrupted build
2. Flagging `orkl` vs `ork` skill differences as drift — `orkl` intentionally excludes some skills
3. Forgetting the hook breakdown: global + agent-scoped + skill-scoped must sum to total
