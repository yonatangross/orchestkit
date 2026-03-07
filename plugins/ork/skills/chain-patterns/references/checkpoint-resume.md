# Checkpoint-Resume Protocol

Enables pipeline skills to survive rate limits, context compaction, and session crashes by persisting progress to disk.

## State Schema

```json
{
  "skill": "fix-issue",
  "args": "456",
  "started": "2026-03-07T16:30:00Z",
  "current_phase": 5,
  "completed_phases": [1, 2, 3, 4],
  "capabilities": {
    "memory": true,
    "context7": true,
    "sequential": false
  },
  "last_handoff": "04-rca.json",
  "updated": "2026-03-07T16:45:00Z"
}
```

## Resume Flow

```python
# FIRST instructions in any pipeline skill:

# 1. Check for existing state
Read(".claude/chain/state.json")

# 2a. If state exists AND matches current skill:
if state.skill == current_skill:
    # Read last handoff for context
    Read(f".claude/chain/{state.last_handoff}")

    # Skip completed phases
    # Start from state.current_phase
    # Tell user: "Resuming from Phase {N} — {phase_name}"
    # "Previous session completed: {completed_phases}"

# 2b. If state exists but DIFFERENT skill:
    # Ask user: "Found state from /ork:{state.skill}. Start fresh?"
    # If yes: overwrite state.json
    # If no: let user switch to that skill

# 2c. If no state exists:
    # Fresh start — write initial state
    Write(".claude/chain/state.json", { skill, current_phase: 1, ... })
```

## Update Protocol

```python
# After completing each major phase:
Read(".claude/chain/state.json")  # read current
# Update with new phase info:
Write(".claude/chain/state.json", {
    ...existing,
    "current_phase": next_phase,
    "completed_phases": [...existing.completed_phases, current_phase],
    "last_handoff": f"{phase_number:02d}-{phase_name}.json",
    "updated": now()
})
```

## When to Checkpoint

- After every numbered phase completes
- Before every AskUserQuestion gate
- Before spawning long-running parallel agents
- The `PreCompact` hook auto-saves if context is about to compact

## Edge Cases

- **Rate limit mid-phase**: Phase is NOT marked complete. On resume, the phase restarts from scratch.
- **Multiple skills**: Only one skill's state lives in `state.json` at a time. Starting a new skill overwrites.
- **Stale state**: If `state.updated` is older than 24 hours, warn user and offer fresh start.
