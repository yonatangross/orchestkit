---
title: Sources of Truth for Count Validation
impact: HIGH
tags: [validation, counts, manifests]
---

# Sources of Truth

These are the authoritative sources checked when validating OrchestKit component counts.

## Actual Counts (Filesystem)

| Source | What to Count | Command |
|--------|---------------|---------|
| Skills | Subdirectories in `src/skills/` | `ls -d src/skills/*/` |
| Agents | `.md` files in `src/agents/` | `ls src/agents/*.md` |
| Hooks | Entries in `hooks` array in `src/hooks/hooks.json` | `jq '.hooks | length' src/hooks/hooks.json` |

## Declared Counts (Must Match Actual)

| File | Field | Notes |
|------|-------|-------|
| `CLAUDE.md` | Project Overview line ("63 skills, 37 agents, 87 hooks") | Update on every component add/remove |
| `CLAUDE.md` | Version section hook count | Must match hooks.json |
| `manifests/ork.json` | Skill/agent/hook count metadata | Full plugin — all components |
| `manifests/orkl.json` | Skill/agent/hook count metadata | Lite — excludes Python/React/LLM skills |

## Rules

- Filesystem counts are always the ground truth
- CLAUDE.md and manifests must be updated to match after any build
- `orkl` legitimately has fewer skills than `ork` — do not flag as mismatch
- Hook count breakdown: total = global + agent-scoped + skill-scoped; verify sum matches `hooks.json` length
