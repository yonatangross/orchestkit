---
name: design-ship
license: MIT
compatibility: "Claude Code 2.1.277+. Requires: design-to-code skill."
description: "Alias: runs design-to-code in ship mode (design export to an opened PR) for people who still type the earlier command. Use only when someone types /ork:design-ship."
argument-hint: "<export.zip | export.html | folder>"
user-invocable: true
disable-model-invocation: true
metadata:
  category: workflow-automation
  version: "2.0.0"
  author: "OrchestKit"
  complexity: "low"
  tags: "claude-design, design-ship, alias, deprecated"
---

# Design Ship (alias)

`design-ship` is now the **ship mode of `design-to-code`**. This file only keeps the typed command `/ork:design-ship` working. It holds no logic of its own, and the model never loads it on its own.

## When to Use

Only when someone types `/ork:design-ship`. Do these two things and nothing else:

1. Say in one line: "design-ship is now `design-to-code ship`. Running that."
2. Run the merged skill with the same arguments:

```python
Skill(skill="ork:design-to-code", args="ship $ARGUMENTS")
```

## What changed

- **Input.** Claude Design lives inside Claude now, so ship reads an exported file: a `.zip` ("Download as .zip"), a standalone `.html`, or the unpacked folder. A `claude.ai/design` handoff link still works until the standalone site closes on 2026-12-14.
- **Where the instructions live.** The full pipeline (import, `cover`, `expect`, open the PR, record it) moved, text intact, to `design-to-code/references/ship-mode.md`.
- **Output.** Unchanged: a reviewable PR with the component list, token changes, verification and screenshots. Never merged automatically.

## Removal

This alias goes away together with the handoff link input, after 2026-12-14. Update scripts, notes and muscle memory to `/ork:design-to-code ship <export>`.

## Related Skills

- `design-to-code`: the merged skill (import, ship, mockup and Storybook modes)
- `design-import`: the other alias, for import mode
