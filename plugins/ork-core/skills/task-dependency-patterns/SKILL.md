---
name: task-dependency-patterns
description: CC 2.1.16 Task Management patterns with TaskCreate, TaskUpdate, TaskGet, TaskList tools. Decompose complex work into trackable tasks with dependency chains. Use when managing multi-step implementations, coordinating parallel work, or tracking completion status.
context: fork
version: 1.0.0
author: OrchestKit
agent: workflow-architect
tags: [task-management, dependencies, orchestration, cc-2.1.16, workflow, coordination]
user-invocable: false
---

# Task Dependency Patterns

## Overview

Claude Code 2.1.16 introduces a native Task Management System with four tools:
- **TaskCreate**: Create new tasks with subject, description, and activeForm
- **TaskUpdate**: Update status (pending → in_progress → completed), set dependencies
- **TaskGet**: Retrieve full task details including blockers
- **TaskList**: View all tasks with status and dependency summary

Tasks enable structured work tracking, parallel coordination, and clear progress visibility.

## When to Use

- Breaking down complex multi-step implementations
- Coordinating parallel work across multiple files
- Tracking progress on large features
- Managing dependencies between related changes
- Providing visibility into work status

## Key Patterns

### 1. Task Decomposition

Break complex work into atomic, trackable units:

```
Feature: Add user authentication

Tasks:
#1. [pending] Create User model
#2. [pending] Add auth endpoints (blockedBy: #1)
#3. [pending] Implement JWT tokens (blockedBy: #2)
#4. [pending] Add auth middleware (blockedBy: #3)
#5. [pending] Write integration tests (blockedBy: #4)
```

### 2. Dependency Chains

Use `addBlockedBy` to create execution order:

```json
// Task #3 cannot start until #1 and #2 complete
{"taskId": "3", "addBlockedBy": ["1", "2"]}
```

### 3. Status Workflow

```
pending → in_progress → completed
   ↓           ↓
(unblocked)  (active)

pending/in_progress → deleted (CC 2.1.20)
```

- **pending**: Task created but not started
- **in_progress**: Actively being worked on
- **completed**: Work finished and verified
- **deleted**: Task removed (CC 2.1.20) - permanently removes the task

### Task Deletion (CC 2.1.20)

CC 2.1.20 adds `status: "deleted"` to permanently remove tasks:

```json
// Delete a task
{"taskId": "3", "status": "deleted"}
```

**When to delete:**
- Orphaned tasks whose blockers have all failed
- Tasks superseded by a different approach
- Duplicate tasks created in error
- Tasks from a cancelled pipeline

**When NOT to delete:**
- Tasks that might be retried later (keep as pending)
- Tasks with useful history (mark completed instead)
- Tasks blocked by in_progress work (wait for resolution)

### 4. activeForm Pattern

Provide present-continuous form for spinner display:

| subject (imperative) | activeForm (continuous) |
|---------------------|------------------------|
| Run tests | Running tests |
| Update schema | Updating schema |
| Fix authentication | Fixing authentication |

## Anti-Patterns

- Creating tasks for trivial single-step work
- Circular dependencies (A blocks B, B blocks A)
- Leaving tasks in_progress when blocked
- Not marking tasks completed after finishing

## Related Skills

- `worktree-coordination` - Multi-instance task coordination across git worktrees
- `implement` - Implementation workflow with task tracking and progress updates
- `verify` - Verification tasks and completion checklists
- `fix-issue` - Issue resolution with hypothesis-based RCA tracking
- `brainstorming` - Design exploration with parallel agent tasks

## References

- [Dependency Tracking](references/dependency-tracking.md)
- [Status Workflow](references/status-workflow.md)
- [Multi-Agent Coordination](references/multi-agent-coordination.md)
