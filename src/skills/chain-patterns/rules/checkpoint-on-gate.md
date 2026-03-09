---
title: Checkpoint on Gate
impact: MEDIUM
impactDescription: Ensures progress is saved before user interaction pauses
tags: [checkpoint, gate, state]
---

# Checkpoint on Gate

Update `state.json` before every user gate (AskUserQuestion). User may close the session during a gate.

## Incorrect

```python
# BAD: State not saved before asking user
AskUserQuestion(questions=[{
  "question": "Approve this fix?", ...
}])
# If user closes session: state.json still shows Phase 3
```

## Correct

```python
# GOOD: Save state BEFORE the gate
Write(".claude/chain/state.json", {
  ...existing,
  "current_phase": 5,
  "completed_phases": [1, 2, 3, 4],
  "last_handoff": "04-rca.json",
  "updated": now()
})

# THEN ask user
AskUserQuestion(questions=[{
  "question": "Approve this fix?", ...
}])
```

## Why

Users may:
- Close the terminal during a gate prompt
- Walk away and session times out
- Switch to a different task

In all cases, the completed work is preserved in state.json + handoff files.
