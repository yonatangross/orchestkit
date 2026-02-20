---
title: Read from authoritative count sources to prevent false-positive drift detection
impact: HIGH
impactDescription: "Reading wrong sources produces false-positive drift and wastes debugging time"
tags: hooks, skills, agents, counts, sources
---

## Authoritative Count Sources

Each count has exactly one authoritative source (the filesystem/JSON) and multiple derived sources (docs/manifests) that must stay in sync.

### Hooks

**Authoritative**: `src/hooks/hooks.json` — count entries in the top-level `hooks` array.

```bash
# Count hook entries
jq '.hooks | length' src/hooks/hooks.json
```

Derived sources to check against:
- `CLAUDE.md` Project Overview line: "N hooks (X global + Y agent-scoped + Z skill-scoped)"
- `CLAUDE.md` Version section: "N entries (X global + Y agent-scoped + Z skill-scoped, ...)"
- `src/hooks/hooks.json` top-level `description` field (may embed count)
- `manifests/ork.json` and `manifests/orkl.json` — hook count in metadata

### Skills

**Authoritative**: `src/skills/` — count subdirectories (each directory = one skill).

```bash
# Count skill directories
ls -d src/skills/*/ | wc -l
```

Derived sources:
- `CLAUDE.md` Project Overview: "N skills"
- `manifests/ork.json` — skill list length
- `manifests/orkl.json` — skill list length (legitimately lower — excludes Python/React/LLM skills)

### Agents

**Authoritative**: `src/agents/` — count `.md` files.

```bash
# Count agent files
ls src/agents/*.md | wc -l
```

Derived sources:
- `CLAUDE.md` Project Overview: "N agents"
- `manifests/ork.json` — agent list length
- `manifests/orkl.json` — agent list length

**Incorrect:**

```bash
# Counting from generated plugins/ — stale if build was interrupted
ls -d plugins/ork/skills/*/ | wc -l
```

**Correct:**

```bash
# Always count from src/ — the authoritative source
ls -d src/skills/*/ | wc -l
```

### Key Rules

- Never count `plugins/` — it's generated from `src/` and may be stale if build was interrupted
- `orkl` skill/agent counts WILL differ from `ork` — this is expected, not drift
- Hook breakdown (global + agent-scoped + skill-scoped) must sum to the total count
