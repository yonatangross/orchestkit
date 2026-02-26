# Count Locations in OrchestKit

Overview of every place counts appear and what they represent.

## Where Counts Live

### Source of Truth (filesystem)

| What | Path | How to Count |
|------|------|-------------|
| Skills | `src/skills/*/` | Subdirectory count |
| Agents | `src/agents/*.md` | `.md` file count |
| Hooks | `src/hooks/hooks.json` → `.hooks[]` | Array length |

### Derived Counts (must stay in sync)

| File | Field | Example |
|------|-------|---------|
| `CLAUDE.md` | Project Overview line | "69 skills, 38 agents, 78 hooks" |
| `CLAUDE.md` | Version section | "85 entries (63 global + 22 agent-scoped...)" |
| `src/hooks/hooks.json` | top-level `description` | May embed hook count |
| `manifests/ork.json` | `skills[]` length, `agents[]` length | Counted from arrays |
| `manifests/orkl.json` | `skills[]` length, `agents[]` length | Subset of ork |

## Why Counts Drift

Counts in documentation and manifests must be updated manually after adding or removing components. Common drift scenarios:

1. **Added a skill** — `src/skills/` count increases, but `CLAUDE.md` and manifests may not be updated until `npm run build` is run and CLAUDE.md is manually edited.
2. **Added a hook** — `hooks.json` entry count increases, but the `description` field and CLAUDE.md still show the old count.
3. **Interrupted build** — `plugins/` is emptied at build start; if build fails mid-run, plugins are gone but src counts are fine.

## Hook Breakdown

CLAUDE.md tracks hooks with a breakdown: `N hooks (X global + Y agent-scoped + Z skill-scoped)`.

- **Global**: hooks that run on all Claude Code sessions
- **Agent-scoped**: hooks only active during named agent sessions
- **Skill-scoped**: hooks only active when a specific skill is running

The three numbers must sum to the total. The authoritative breakdown comes from `src/hooks/hooks.json` — each entry has a `scope` field or equivalent.
