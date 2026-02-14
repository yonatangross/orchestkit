---
title: "Tasks: Agent Coordination"
category: task
impact: HIGH
impactDescription: "Without clear ownership and coordination, multiple agents duplicate work, overwrite each other's changes, or leave tasks orphaned"
tags: [coordination, ownership, multi-agent, messaging, duplicate-work]
---

## Tasks: Agent Coordination

In multi-agent workflows, every in-progress task must have a clear owner, and agents must coordinate through the task list and messaging tools. Without ownership, two agents may silently work on the same task, causing merge conflicts and wasted effort.

**Incorrect:**
```json
// Two agents both start the same task without claiming ownership
// Agent-A:
TaskUpdate(taskId: "5", status: "in_progress")  // No owner set
// Agent-B (simultaneously):
TaskUpdate(taskId: "5", status: "in_progress")  // No owner set
// Both agents now work on #5 — duplicate effort, likely merge conflict
```

**Correct:**
```json
// Agent-A claims the task atomically with owner field
TaskList  // Review available tasks
// Found #5: pending, no owner, blockedBy: []
TaskUpdate(taskId: "5", status: "in_progress", owner: "agent-a")

// Agent-B sees #5 is owned
TaskList  // #5 shows owner: "agent-a", in_progress
// Agent-B picks a different unblocked, unowned task instead
TaskUpdate(taskId: "6", status: "in_progress", owner: "agent-b")
```

**Incorrect:**
```json
// Agent completes work silently — no one knows the output or context
TaskUpdate(taskId: "5", status: "completed")
// Downstream agent starts #7 (blocked by #5) with no context about what was done
```

**Correct:**
```json
// Agent communicates completion context to dependent agent
TaskUpdate(taskId: "5", status: "completed")
SendMessage(
  type: "message",
  recipient: "frontend-dev",
  content: "Task #5 done: API returns { users: User[], total: number }. Schema in src/types/user.ts.",
  summary: "API contract ready for frontend"
)
// Downstream agent has full context to start dependent work
```

**Key rules:**
- Always set `owner` when transitioning a task to `in_progress` — this prevents duplicate work
- Use `TaskList` to find unblocked, unowned tasks before claiming one
- Design tasks to be completable by a single agent — avoid tasks that require two agents to collaborate mid-execution
- Use `SendMessage` to share completion context (output formats, file locations, decisions made) with agents who own dependent tasks
- Mark tasks `completed` promptly after finishing — delayed completion blocks dependent agents unnecessarily
- Release ownership (`owner: ""`) if you cannot finish a task, reverting it to `pending` so another agent can pick it up

Reference: [Multi-Agent Coordination](../references/multi-agent-coordination.md) — Best Practices (lines 110-116), Agent Workflow (lines 47-70)
