---
name: audit-skills
description: Audits all OrchestKit skills for quality, completeness, and compliance with authoring standards. Use when checking skill health, before releases, or after bulk skill edits to surface SKILL.md files that are too long, have missing frontmatter, lack rules/references, or are unregistered in manifests.
tags: [audit, quality, skills, orchestkit]
version: 2.0.0
author: OrchestKit
user-invocable: true
complexity: medium
---

# audit-skills

Scans all `src/skills/*/SKILL.md` files and reports compliance with OrchestKit authoring standards. Each category has individual files in `rules/` and `references/` loaded on-demand.

## Quick Reference

| Category | File | Impact | When to Use |
|----------|------|--------|-------------|
| Audit Checks | `rules/audit-checks.md` | HIGH | What to validate per skill |
| Status Rules | `rules/audit-status.md` | MEDIUM | PASS/WARN/FAIL classification |
| Output Format | `references/output-format.md` | MEDIUM | Table layout and column definitions |
| Edge Cases | `references/edge-cases.md` | LOW | Manifest "all", orchestration skills |

**Total: 2 rules across 2 categories**

## Workflow

1. **Discover** — Glob `src/skills/*/SKILL.md` to get full skill list
2. **Check each skill** — Run all checks from `rules/audit-checks.md` in parallel
3. **Classify** — Apply status rules from `rules/audit-status.md`
4. **Render** — Output table using format from `references/output-format.md`
5. **Totals** — Show `X pass, Y warn, Z fail` at bottom

## Quick Start

```bash
bash src/skills/audit-skills/scripts/run-audit.sh
```

Or invoke manually — Claude scans `src/skills/`, applies checks, and renders the summary table.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Manifest check | `"skills": "all"` in ork.json means ALL skills qualify — mark YES |
| 0 rules + refs | WARN only — some orchestration skills are legitimately rules-free |
| Broken refs | WARN (not FAIL) — file may exist under a different path |

## Related Skills

- `ork:skill-evolution` — Guidance on iterating and improving skills
- `ork:quality-gates` — Broader codebase quality checks
