# Status Workflow

## Overview

Tasks progress through a defined state machine: `pending` → `in_progress` → `completed`.

## Status States

### pending

- Task created but not started
- May be blocked by other tasks
- Available for claiming if no blockers

### in_progress

- Actively being worked on
- Only one task should typically be in_progress per worker
- Mark immediately when starting work

### completed

- Work finished and verified
- Unblocks dependent tasks
- Cannot be modified further

## State Transitions

```
┌─────────┐     start     ┌─────────────┐    finish    ┌───────────┐
│ pending │ ────────────→ │ in_progress │ ───────────→ │ completed │
└─────────┘               └─────────────┘              └───────────┘
     ↑                           │
     └───── revert ──────────────┘
           (if blocked)
```

## Valid Transitions

| From | To | When |
|------|-----|------|
| pending | in_progress | Starting work, no blockers |
| in_progress | completed | Work verified complete |
| in_progress | pending | Discovered blocker, need to wait |

## Status Update Examples

```json
// Start work
{"taskId": "1", "status": "in_progress"}

// Mark complete
{"taskId": "1", "status": "completed"}

// Revert if blocked
{"taskId": "1", "status": "pending"}
```

## Completion Criteria

Before marking completed, verify:

1. **Implementation done**: All code changes complete
2. **Tests passing**: Related tests succeed
3. **No blockers**: Nothing prevents dependent tasks
4. **Documentation updated**: If applicable

## Anti-Patterns

### Premature Completion

```json
// DON'T: Mark complete with failing tests
{"taskId": "1", "status": "completed"}
```

### Abandoned in_progress

```json
// DON'T: Leave task in_progress when blocked
// DO: Revert to pending, create blocker task
{"taskId": "1", "status": "pending"}
```

### Skipping States

```json
// DON'T: Go directly from pending to completed
// DO: Always transition through in_progress
{"taskId": "1", "status": "in_progress"}
// ... do work ...
{"taskId": "1", "status": "completed"}
```

## activeForm Display

The `activeForm` field displays during in_progress status:

```
[#1 in_progress] Running tests... ⣾
```

Provide meaningful present-continuous descriptions:
- "Creating database schema"
- "Updating API endpoints"
- "Writing integration tests"
