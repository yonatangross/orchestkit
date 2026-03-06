---
paths:
  - "manifests/**"
  - "src/hooks/hooks.json"
  - "src/skills/**/SKILL.md"
  - "src/agents/**"
  - "CLAUDE.md"
---

# Component Count & Manifest Sync

## When adding or removing skills, agents, or hooks:
1. Update `manifests/ork.json` (add/remove entry)
2. Update count in **CLAUDE.md Version section** (skills, agents, hooks)
3. Update count in **hooks.json description field** (hooks only)
4. Run `npm run test:manifests` — catches count drift, orphans, ordering
5. Commit manifest + CLAUDE.md + hooks.json together in same commit

## Manifest Ordering
- Skills listed in **dependency order** (dependencies first)
- Alphabetical within category groups
- No orphans: every manifest entry must have a `src/` file

## Common Mistake
Count drift across files is the #1 manifest bug. If `test:manifests` fails, search all three locations and reconcile.
