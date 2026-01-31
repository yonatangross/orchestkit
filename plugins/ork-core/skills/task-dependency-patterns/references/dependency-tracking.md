# Dependency Tracking

## Overview

Task dependencies ensure correct execution order through `blocks` and `blockedBy` relationships.

## Dependency Fields

| Field | Description |
|-------|-------------|
| `blocks` | Tasks that cannot start until this task completes |
| `blockedBy` | Tasks that must complete before this task can start |

## Creating Dependencies

```json
// During task update
{
  "taskId": "3",
  "addBlockedBy": ["1", "2"],
  "addBlocks": ["4", "5"]
}
```

## Dependency Patterns

### Sequential Chain

```
#1 → #2 → #3 → #4
```

```json
// Task #2 blocked by #1
{"taskId": "2", "addBlockedBy": ["1"]}
// Task #3 blocked by #2
{"taskId": "3", "addBlockedBy": ["2"]}
```

### Fan-Out Pattern

```
     ┌→ #2
#1 ──┼→ #3
     └→ #4
```

All depend on #1, but can run in parallel after #1 completes.

### Fan-In Pattern

```
#1 ──┐
#2 ──┼→ #4
#3 ──┘
```

```json
{"taskId": "4", "addBlockedBy": ["1", "2", "3"]}
```

### Diamond Pattern

```
     #1
    ↙  ↘
  #2    #3
    ↘  ↙
     #4
```

## Validation Rules

1. **No circular dependencies**: A → B → A is invalid
2. **Blocked tasks cannot start**: Check `blockedBy` before setting `in_progress`
3. **Completing unblocks dependents**: When #1 completes, #2 becomes available

## Querying Dependencies

```bash
# List tasks to see blockedBy summary
TaskList

# Get full dependency details
TaskGet taskId="3"
# Returns: blockedBy: ["1", "2"], blocks: ["4"]
```

## Best Practices

- Keep dependency chains shallow (3-4 levels max)
- Use fan-out for parallelizable work
- Document why dependencies exist in task description
- Review blocked tasks when completing work
