# Multi-Agent Task Coordination

## Overview

When multiple Claude Code instances or agents work on a shared codebase, the Task system provides coordination primitives.

## Coordination Patterns

### Task Assignment

Use `owner` field to track which agent owns a task:

```json
// Claim a task
{"taskId": "3", "owner": "backend-agent"}

// Release task
{"taskId": "3", "owner": ""}
```

### Finding Available Work

```python
# Pseudo-code for agent task selection
tasks = TaskList()
available = [t for t in tasks
             if t.status == "pending"
             and not t.owner
             and not t.blockedBy]
next_task = available[0] if available else None
```

### Work Distribution

```
┌─────────────────────────────────────────┐
│           Task Board                     │
├──────────────┬──────────────┬───────────┤
│   pending    │ in_progress  │ completed │
├──────────────┼──────────────┼───────────┤
│ #4 (blocked) │ #2 (agent-A) │ #1        │
│ #5 (ready)   │ #3 (agent-B) │           │
│ #6 (ready)   │              │           │
└──────────────┴──────────────┴───────────┘
```

## Agent Workflow

### 1. Check for Work

```json
// Agent startup: list all tasks
TaskList
```

### 2. Claim Task

```json
// Found unblocked, unowned task
{"taskId": "5", "status": "in_progress", "owner": "my-agent"}
```

### 3. Complete Work

```json
// After finishing work
{"taskId": "5", "status": "completed"}
// Check for newly unblocked tasks
TaskList
```

## Coordination with Worktrees

When using OrchestKit's worktree-coordination:

```bash
# Check coordination status
.claude/coordination/lib/coordination.sh status

# Task management complements file locks
# - Tasks track WHAT work is being done
# - Locks track WHICH files are being modified
```

## Handoff Patterns

### Sequential Handoff

```
Agent-A completes #1 → Agent-B unblocked for #2
```

### Parallel Fork

```
Agent-A completes #1
├→ Agent-B can start #2
├→ Agent-C can start #3
└→ Agent-D can start #4
```

### Merge Point

```
Agent-A completes #2 ─┐
Agent-B completes #3 ─┼→ Any agent can start #5
Agent-C completes #4 ─┘
```

## Best Practices

1. **Atomic task design**: Tasks should be completable by single agent
2. **Clear ownership**: Always set owner when starting work
3. **Timely completion**: Mark completed as soon as work is done
4. **Dependency awareness**: Check blockedBy before starting
5. **Communication via tasks**: Use description for context handoff

## Integration with OrchestKit

The task system integrates with:

- **worktree-coordination**: File-level locking
- **context-compression**: Task context in compressed summaries
- **agent handoff hooks**: Auto-document in decision log
