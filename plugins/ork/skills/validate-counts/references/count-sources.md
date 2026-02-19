---
title: Count Sources Overview
tags: [validation, architecture, orchestkit]
---

# Count Sources Overview

OrchestKit maintains component counts in multiple places. This explains why and what each source represents.

## Why Multiple Sources?

- **CLAUDE.md** — human-readable overview shown to Claude at session start; stale counts cause confusion
- **manifests/** — machine-read by Claude Code to determine what to load; wrong counts break plugin installation
- **hooks.json** — runtime source; the actual hook entries Claude Code executes

## Three-Tier Plugin Difference

The `ork` plugin includes all 63 skills. The `orkl` (lite) plugin excludes Python, React, and LLM-specific skills, resulting in ~46 skills. The agent counts also differ by 1 because `ork` includes the Python backend agent.

Both plugins share the same 87 hooks — hook count should always match between them.

## When Counts Get Out of Sync

Common causes:
1. Adding a skill to `src/skills/` but forgetting to run `npm run build`
2. Editing `hooks.json` without updating CLAUDE.md
3. A failed build that left `plugins/` incomplete — always re-run `npm run build` after any interrupted build
