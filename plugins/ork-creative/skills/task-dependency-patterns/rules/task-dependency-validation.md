---
title: Validate task dependencies before starting to avoid wasted work on blocked tasks
category: task
impact: HIGH
impactDescription: "Starting blocked tasks causes wasted work, merge conflicts, and broken assumptions about prerequisite state"
tags: [dependencies, validation, blockers, circular-detection]
---

## Tasks: Dependency Validation

Always validate that a task's dependencies are fully resolved before transitioning it to `in_progress`. Skipping validation leads to wasted effort, incorrect assumptions about system state, and potential circular dependency deadlocks.

**Incorrect:**
```json
// Starting a task without checking if blockers are resolved
TaskList  // shows #3 has blockedBy: ["1", "2"]
// Task #1 is completed but #2 is still in_progress
TaskUpdate(taskId: "3", status: "in_progress")  // BAD: #2 not done yet
// Agent now works against incomplete prerequisite state
```

**Correct:**
```json
// Always verify blockedBy is empty before starting work
TaskGet(taskId: "3")
// Returns: blockedBy: ["1", "2"], status: "pending"
// Check: #1 = completed, #2 = completed? No — #2 still in_progress
// Result: Do NOT start #3. Pick a different unblocked task instead.

// Later, when #2 completes:
TaskGet(taskId: "3")
// Returns: blockedBy: [] (all resolved), status: "pending"
TaskUpdate(taskId: "3", status: "in_progress", owner: "my-agent")  // GOOD
```

**Incorrect:**
```json
// Creating circular dependencies
TaskUpdate(taskId: "2", addBlockedBy: ["3"])
TaskUpdate(taskId: "3", addBlockedBy: ["2"])
// Deadlock: neither task can ever start
```

**Correct:**
```json
// Keep dependency chains acyclic — review the full chain before adding
// If #2 depends on #3 output, restructure:
TaskCreate(subject: "Extract shared interface", ...)  // New task #6
TaskUpdate(taskId: "2", addBlockedBy: ["6"])
TaskUpdate(taskId: "3", addBlockedBy: ["6"])
// Both #2 and #3 depend on #6, no cycle
```

**Key rules:**
- Call `TaskGet` and verify `blockedBy` is empty before setting any task to `in_progress`
- Never add a dependency that creates a cycle (A blocks B blocks A); restructure with a shared prerequisite task instead
- Keep dependency chains shallow (3-4 levels max) to avoid long critical paths
- When completing a task, call `TaskList` to check if dependent tasks are now unblocked
- Document why each dependency exists in the task description so future agents understand the ordering

Reference: [Dependency Tracking](../references/dependency-tracking.md) — Validation Rules (lines 72-77), Best Practices (lines 89-94)
