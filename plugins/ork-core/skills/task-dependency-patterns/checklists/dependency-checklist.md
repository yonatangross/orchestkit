# Dependency Validation Checklist

## Before Adding Dependencies

- [ ] Is there a true execution order requirement?
- [ ] Would parallel execution cause conflicts?
- [ ] Is the dependency on task completion (not just start)?

## Dependency Types

### Code Dependencies

- [ ] Task B modifies files created by Task A
- [ ] Task B imports modules defined in Task A
- [ ] Task B extends patterns established in Task A

### Schema Dependencies

- [ ] Task B uses database schema from Task A
- [ ] Task B consumes API contracts from Task A
- [ ] Task B references types defined in Task A

### Test Dependencies

- [ ] Task B tests functionality from Task A
- [ ] Task B requires fixtures from Task A
- [ ] Task B extends test suites from Task A

## Dependency Anti-Patterns

### Circular Dependencies

```
Task A blockedBy [B]
Task B blockedBy [A]
```

**Fix:** Identify shared prerequisite, extract to Task C

### Over-Specification

```
Task D blockedBy [A, B, C]
# But really only needs C
```

**Fix:** Remove unnecessary dependencies, rely on transitive blocking

### Under-Specification

```
Task B has no blockedBy
# But actually needs Task A's output
```

**Fix:** Add explicit dependency to prevent race conditions

## Validation Steps

### 1. Trace Dependency Chain

```
For each task with blockedBy:
  - Can the blocking task(s) actually complete?
  - Is there a path from START to this task?
  - Is there a path from this task to END?
```

### 2. Check for Cycles

```
For each task T:
  visited = {}
  queue = [T.blockedBy]
  while queue:
    current = queue.pop()
    if current == T: ERROR: Cycle detected
    if current in visited: continue
    visited.add(current)
    queue.extend(current.blockedBy)
```

### 3. Verify Parallelism

```
Tasks without mutual dependencies CAN run in parallel.
Verify: No shared file writes, no ordering requirement.
```

## Updating Dependencies

When modifying existing dependencies:

- [ ] Reviewed impact on blocked tasks
- [ ] No orphaned tasks (tasks that can never unblock)
- [ ] Critical path still reasonable
- [ ] Notified other agents/workers if relevant

## Documentation

For complex dependency chains:

- [ ] Diagram in task description or PR
- [ ] Rationale for non-obvious dependencies
- [ ] Expected execution order documented
