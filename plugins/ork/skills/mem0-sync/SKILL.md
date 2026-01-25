---
name: mem0-sync
description: Auto-sync session context, decisions, and patterns to Mem0 for cross-session continuity. Use when persisting session memory or syncing decisions.
tags: [mem0, sync, session, memory, continuity, persistence]
user-invocable: true
allowedTools: [Read, Grep, Glob]
auto-invoke: session-end
context: inherit
skills: [recall, remember]
---

# Mem0 Auto-Sync

Automatically synchronize session context to Mem0 for seamless cross-session continuity. This skill executes Python SDK scripts to persist decisions, patterns, and session summaries.

## Overview

- **Automatically**: Invoked at session end by `mem0-pre-compaction-sync.sh` hook
- **Manually**: Run `/mem0-sync` to force sync mid-session
- **After major decisions**: Sync important architectural decisions immediately

## Quick Sync

Execute these script commands based on the sync context provided:

### 1. Session Summary (Always)

```bash
!bash skills/mem0-memory/scripts/crud/add-memory.py \
  --text "Session Summary: {task_summary}" \
  --user-id "{project}-continuity" \
  --metadata '{"type":"session_summary","status":"{status}","has_blockers":{has_blockers},"has_next_steps":{has_next_steps}}' \
  --enable-graph
```

### 2. Pending Decisions (If Any)

For each decision in the decision log that hasn't been synced:

```bash
!bash skills/mem0-memory/scripts/crud/add-memory.py \
  --text "{decision_content}" \
  --user-id "{project}-decisions" \
  --metadata '{"category":"{category}","outcome":"success"}' \
  --enable-graph
```

### 3. Agent Patterns (If Any)

For each agent pattern that was learned:

```bash
!bash skills/mem0-memory/scripts/crud/add-memory.py \
  --text "{pattern_description}" \
  --user-id "{project}-agents" \
  --agent-id "ork:{agent_type}" \
  --metadata '{"category":"{category}","outcome":"{success|failed}"}' \
  --enable-graph
```

### 4. Best Practices (If Generalizable)

For patterns that apply across projects:

```bash
!bash skills/mem0-memory/scripts/crud/add-memory.py \
  --text "{best_practice}" \
  --user-id "orchestkit-global-best-practices" \
  --metadata '{"project":"{project}","category":"{category}","outcome":"success"}' \
  --enable-graph
```

## Sync Protocol

1. **Check availability**: Verify `MEM0_API_KEY` environment variable is set
2. **Read sync state**: Load `.claude/coordination/.decision-sync-state.json`
3. **Execute scripts**: Run `add-memory.py` script for each item
4. **Update sync state**: Mark synced items to prevent duplicates
5. **Confirm completion**: Output sync summary

## Key Patterns

### Idempotent Sync
- Track synced decision IDs in sync state file
- Skip already-synced items
- Handle partial failures gracefully

### Graph Memory
- Always use `enable_graph: true` for relationship extraction
- Mem0 automatically creates entity/relation graphs
- Enables semantic search across related concepts

### Scoped User IDs
- `{project}-continuity`: Session summaries
- `{project}-decisions`: Architectural decisions
- `{project}-agents`: Agent-specific patterns
- `orchestkit-global-best-practices`: Cross-project patterns

## Related Skills

- `recall` - Search and retrieve from Mem0
- `context-compression` - Compress context before sync
- `brainstorming` - Generate decisions worth syncing
