---
title: Manifest Registration Requirement
impact: HIGH
impactDescription: "Unregistered skills are never loaded by Claude Code"
tags: [audit, manifest, skill-quality]
---

# Manifest Registration

## Rule

Every skill in `src/skills/` must be registered in at least one manifest:
- `manifests/ork.json` — full plugin (all skills)
- `manifests/orkl.json` — lite plugin (excludes Python/React/LLM skills)

## Check Method

If `manifests/ork.json` uses `"skills": "all"`, every skill in `src/skills/` is automatically included — mark all as registered.

Otherwise, verify the skill name appears in the `skills` array of at least one manifest.

## Severity

| Condition | Status |
|-----------|--------|
| In ork.json OR orkl.json | PASS |
| In neither manifest | FAIL |

## Fix

Add the skill name to the appropriate manifest `skills` array, then run `npm run build`.

Note: Skills that are ork-only (Python, React, LLM) intentionally appear only in `manifests/ork.json` — this is correct, not a bug.
