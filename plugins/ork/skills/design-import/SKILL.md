---
name: design-import
license: MIT
compatibility: "Claude Code 2.1.328+. Requires: design-to-code skill."
description: "Old name of design-to-code import mode, kept so the typed command still works. Use when /ork:design-import is typed; new work calls design-to-code import."
argument-hint: "<export.zip | export.html | folder>"
user-invocable: true
disable-model-invocation: true
metadata:
  category: workflow-automation
  version: "2.0.0"
  author: "OrchestKit"
  complexity: "low"
  tags: "claude-design, design-import, alias, deprecated"
---

# Design Import (alias)

`design-import` is now the **import mode of `design-to-code`**. This file only keeps the typed command `/ork:design-import` working. It holds no logic of its own, and the model never loads it on its own.

## When to Use

Only when someone types `/ork:design-import`. Do these two things and nothing else:

1. Say in one line: "design-import is now `design-to-code import`. Running that."
2. Run the merged skill with the same arguments:

```python
Skill(skill="ork:design-to-code", args="import $ARGUMENTS")
```

## What changed

- **Input.** Claude Design lives inside Claude now, so import reads an exported file: a `.zip` ("Download as .zip"), a standalone `.html`, or the unpacked folder. A `claude.ai/design` handoff link still works until the standalone site closes on 2026-12-14.
- **Where the instructions live.** The full import pipeline (open, reconcile tokens, dedup, scaffold, provenance) moved, text intact, to `design-to-code/references/import-mode.md`.
- **Output.** Unchanged: components on disk plus `.claude/design-handoffs/<bundle_id>.json`. No tests, no PR.

## Removal

This alias goes away together with the handoff link input, after 2026-12-14. Update scripts, notes and muscle memory to `/ork:design-to-code import <export>`.

## Related Skills

- `design-to-code`: the merged skill (import, ship, mockup and Storybook modes)
- `design-ship`: the other alias, for ship mode
