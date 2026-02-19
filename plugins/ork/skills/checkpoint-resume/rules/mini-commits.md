---
title: Mini-Commit Checkpoints
impact: MEDIUM
tags: [checkpoint, commits, git]
---

# Mini-Commit Checkpoints

## Rule

Every 3 completed phases, create a mini-commit:

```bash
git add -A
git commit -m "checkpoint: phases N-M complete"
```

## Why

- Keeps git history granular — easier to inspect what was done when
- Reduces work lost if something goes wrong after the state file write
- Provides a concrete recovery point: `git log --oneline` shows progress

## Commit Message Format

```
checkpoint: phases <first>-<last> complete

Completed:
- Phase N: <name>
- Phase N+1: <name>
- Phase N+2: <name>
```

## When Not to Mini-Commit

- During parallel phases — wait until all parallel phases in the group are done
- If the phase work is not yet in a committable state (e.g., mid-feature)
- If the branch has a pre-commit hook that would fail on partial work
