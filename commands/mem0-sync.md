---
description: Auto-sync session context, decisions, and patterns to Mem0 for cross-session continuity
allowed-tools: Read, Bash, mcp__mem0__add_memory, mcp__mem0__search_memories
---

# Mem0 Auto-Sync

Load and follow the skill instructions from the `skills/mem0-sync/SKILL.md` file.

Execute the `/mem0-sync` command to force synchronize session context to Mem0 mid-session.

This command:
1. Reads current session state and decision log
2. Syncs session summaries, decisions, patterns, and best practices
3. Tracks synced items to prevent duplicates
4. Outputs sync summary

## Usage

- `/mem0-sync` - Force sync session to Mem0 immediately
- `/mem0-sync --summary` - Sync only session summary
- `/mem0-sync --decisions` - Sync only pending decisions
- `/mem0-sync --patterns` - Sync only learned patterns

## Arguments

- No required arguments; optional flags to filter sync scope
