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
```

- **pending**: Task created but not started
- **in_progress**: Actively being worked on
- **completed**: Work finished and verified

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

## Integration

Works with:
- `worktree-coordination` - Multi-instance task coordination
- `implement` - Implementation workflow with task tracking
- `verify` - Verification tasks and checklists

## References

- [Dependency Tracking](references/dependency-tracking.md)
- [Status Workflow](references/status-workflow.md)
- [Multi-Agent Coordination](references/multi-agent-coordination.md)
