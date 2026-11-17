---
description: "Formerly dream, now memory dream. Use when /ork:dream is typed to tidy and prune memory entries. Removed 2027-01-31."
argument-hint: "[--dry-run]"
disable-model-invocation: true
user-invocable: true
name: dream
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Auto-generated from skills/dream/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Dream (alias)

`dream` is now the **dream verb of `memory`**. This file only keeps the typed command `/ork:dream` working. It holds no logic of its own, and the model never loads it on its own.

## When to Use

Only when someone types `/ork:dream`. Do these two things and nothing else:

1. Say in one line: "dream is now `memory dream`. Running that."
2. Run the merged skill with the same arguments:

```python
Skill(skill="ork:memory", args="dream $ARGUMENTS")
```

## What changed

- **Where the instructions live.** The full dream procedure moved, text intact, to `memory/references/verb-dream.md`, with its housekeeping, index-budget and safe-delete references and the `index-budget.mjs` script beside it.
- **Output.** Unchanged: consolidated memory files and a rebuilt `MEMORY.md`. The `--dry-run` flag works as before.

## Removal

This alias goes away after 2027-01-31. Update scripts, notes and muscle memory to `/ork:memory dream`.

## Related Skills

- `memory`: the merged skill (remember, search and dream verbs)
- `remember`: the other alias, for the remember verb
