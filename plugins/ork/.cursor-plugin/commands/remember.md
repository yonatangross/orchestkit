---
description: "Formerly remember, now memory remember. Use when /ork:remember is typed to store a decision in the knowledge graph. Removed 2027-01-31."
argument-hint: "[decision-or-pattern]"
disable-model-invocation: true
user-invocable: true
name: remember
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Auto-generated from skills/remember/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Remember (alias)

`remember` is now the **remember verb of `memory`**. This file only keeps the typed command `/ork:remember` working. It holds no logic of its own, and the model never loads it on its own.

## When to Use

Only when someone types `/ork:remember`. Do these two things and nothing else:

1. Say in one line: "remember is now `memory remember`. Running that."
2. Run the merged skill with the same arguments:

```python
Skill(skill="ork:memory", args="remember $ARGUMENTS")
```

## What changed

- **Where the instructions live.** The remember text (flags, categories, graph steps, confirmation) moved, intact, into `memory/SKILL.md` under "Verb: remember". Its references and rules moved into `memory/references/` and `memory/rules/`.
- **Output.** Unchanged: entities and relations in the knowledge graph.

## Removal

This alias goes away after 2027-01-31. Update scripts, notes and muscle memory to `/ork:memory remember <text>`.

## Related Skills

- `memory`: the merged skill (remember, search and dream verbs)
- `dream`: the other alias, for the dream verb
