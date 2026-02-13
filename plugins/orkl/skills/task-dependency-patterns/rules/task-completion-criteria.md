---
title: "Tasks: Completion Criteria"
category: task
impact: HIGH
impactDescription: "Premature completion unblocks dependent tasks that rely on incomplete work, cascading failures through the dependency chain"
tags: [completion, verification, status-workflow, anti-patterns, follow-up]
---

## Tasks: Completion Criteria

A task must only be marked `completed` when all implementation is done, tests pass, and nothing blocks dependent tasks from proceeding safely. Premature completion cascades errors: downstream agents start work assuming a solid foundation that does not exist.

**Incorrect:**
```json
// Marking complete when tests are failing
// Agent implements feature but 2 of 8 tests fail
TaskUpdate(taskId: "3", status: "completed")  // BAD: tests not passing
// Dependent task #4 starts, builds on broken code — compounds the failure
```

**Correct:**
```json
// Verify all criteria before marking complete
// 1. Implementation done — all code changes committed
// 2. Tests passing — ran test suite, all green
// 3. No blockers for dependents — output matches expected interface
// 4. Documentation updated (if applicable)
TaskUpdate(taskId: "3", status: "completed")  // GOOD: fully verified
TaskList  // Check if #4 is now unblocked and ready
```

**Incorrect:**
```json
// Leaving a task in_progress when blocked by a discovered issue
// Agent hits unexpected blocker mid-work
// Task sits as in_progress indefinitely — no one else can pick it up
// Other agents wait for dependent tasks that will never unblock
```

**Correct:**
```json
// Revert to pending and create a blocker task for the discovered issue
TaskUpdate(taskId: "3", status: "pending")  // Revert — not abandonable as in_progress
TaskCreate(
  subject: "Fix database connection pooling",
  description: "Discovered during #3: pool exhaustion under load. Must fix before #3 can proceed.",
  activeForm: "Fixing connection pooling"
)
// New task #7 created
TaskUpdate(taskId: "3", addBlockedBy: ["7"])  // #3 now properly blocked
```

**Incorrect:**
```json
// Skipping in_progress — going directly from pending to completed
TaskUpdate(taskId: "1", status: "completed")  // BAD: skipped in_progress
// No visibility that work was happening; no activeForm spinner shown
```

**Correct:**
```json
// Always transition through in_progress for visibility
TaskUpdate(taskId: "1", status: "in_progress", activeForm: "Creating user model")
// ... do work, verify results ...
TaskUpdate(taskId: "1", status: "completed")
```

**Key rules:**
- Verify all four completion criteria before marking done: implementation complete, tests passing, no blockers for dependents, documentation updated if applicable
- Never skip `in_progress` — always transition `pending` to `in_progress` to `completed` for proper visibility
- If blocked mid-work, revert to `pending` and create a new blocker task with `addBlockedBy` linking
- When partial work is done but scope remains, create follow-up tasks for the remaining items rather than leaving one large task incomplete
- After completing a task, run `TaskList` to identify newly unblocked dependents

Reference: [Status Workflow](../references/status-workflow.md) — Completion Criteria (lines 71-78), Anti-Patterns (lines 80-105)
