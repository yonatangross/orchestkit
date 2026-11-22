---
name: ci-sentinel
license: MIT
compatibility: "Claude Code 2.1.327+. Requires: ci-debug skill."
description: "Formerly ci-sentinel, now ci-debug sweep. Use when /ork:ci-sentinel is typed to install or check the red-PR sweep. Removed 2027-01-31."
argument-hint: "[install|status|enable|disable]"
user-invocable: true
disable-model-invocation: true
metadata:
  category: workflow-automation
  version: "1.0.0"
  author: "OrchestKit"
  complexity: "low"
  tags: "ci, sentinel, alias, deprecated"
---

# CI Sentinel (alias)

`ci-sentinel` is now the **sweep mode of `ci-debug`**. This file only keeps the typed command `/ork:ci-sentinel` working. It holds no logic of its own, and the model never loads it on its own.

## When to Use

Only when someone types `/ork:ci-sentinel`. Do these two things and nothing else:

1. Say in one line: "ci-sentinel is now `ci-debug sweep`. Running that."
2. Run the merged skill with the same arguments:

```python
Skill(skill="ork:ci-debug", args="sweep $ARGUMENTS")
```

## What changed

- **Where the instructions live.** The full sentinel text moved, intact, to `ci-debug/references/sweep-mode.md`; `ci-debug/SKILL.md` carries the sweep section.
- **Unchanged.** The workflow `.github/workflows/ci-sentinel.yml` and its PR comment marker keep their names.

## Removal

This alias goes away after 2027-01-31. Update scripts, notes and muscle memory to `/ork:ci-debug sweep <install|status|enable|disable>`.

## Related Skills

- `ci-debug`: the merged skill (one failing run, or sweep mode for every red PR)
