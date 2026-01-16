---
description: Manage multiple Claude Code instances across git worktrees
allowed-tools: Bash, Read, Write, Edit
---

# Worktree Coordination

Load and follow the skill instructions from the `skills/worktree-coordination/SKILL.md` file.

Manage multiple Claude Code instances working in parallel across git worktrees.

## Commands
- `/worktree-status` - Show status of all active instances
- `/worktree-claim <file>` - Lock a file for this instance
- `/worktree-release <file>` - Release lock on a file
- `/worktree-sync` - Sync shared context and check for conflicts
- `/worktree-decision <decision>` - Log architectural decision visible to all

## Features
- Automatic file locking (PreToolUse hook)
- Heartbeat monitoring (30s intervals)
- Stale instance cleanup (>5 min without heartbeat)
- Conflict detection before commits

## Arguments
- Subcommand: One of the commands above
