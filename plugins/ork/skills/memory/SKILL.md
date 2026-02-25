---
name: memory
license: MIT
compatibility: "Claude Code 2.1.56+. Requires memory MCP server."
description: "Read-side memory operations: search, recall, load, sync, history, visualize. Use when searching past decisions, loading session context, or viewing the knowledge graph."
argument-hint: "[subcommand] [query]"
context: fork
version: 2.0.0
author: OrchestKit
tags: [memory, graph, session, context, sync, visualization, history, search]
user-invocable: true
allowed-tools: [Read, Grep, Glob, Bash, AskUserQuestion, mcp__memory__search_nodes, mcp__memory__read_graph]
complexity: low
metadata:
  category: mcp-enhancement
  mcp-server: memory
---

# Memory - Read & Access Operations

Unified read-side memory skill with subcommands for searching, loading, syncing, history, and visualization.

## Usage

```bash
/ork:memory search <query>  # Search knowledge graph
/ork:memory load             # Load context at session start
/ork:memory history          # View decision timeline
/ork:memory viz              # Visualize knowledge graph
/ork:memory status           # Show memory system health
```

---

## CRITICAL: Use AskUserQuestion When No Subcommand

If invoked without a subcommand, ask the user what they want:

```python
AskUserQuestion(
  questions=[{
    "question": "What memory operation do you need?",
    "header": "Operation",
    "options": [
      {"label": "search", "description": "Search decisions and patterns in knowledge graph"},
      {"label": "load", "description": "Load relevant context for this session"},
      {"label": "history", "description": "View decision timeline"},
      {"label": "viz", "description": "Visualize knowledge graph as Mermaid"},
      {"label": "status", "description": "Check memory system health"}
    ],
    "multiSelect": false
  }]
)
```

---

## Subcommands

See [Memory Commands Reference](references/memory-commands.md) for full usage, flags, output formats, and context-aware result limits for each subcommand.

| Subcommand | Purpose |
|------------|---------|
| `search` | Search past decisions, patterns, entities. Supports `--category`, `--limit`, `--agent`, `--global` flags |
| `load` | Auto-load relevant memories at session start. Supports `--project`, `--global` |
| `history` | Decision timeline with table, Mermaid, or JSON output. Supports `--since`, `--mermaid` |
| `viz` | Render knowledge graph as Mermaid diagram. See also [mermaid-patterns.md](references/mermaid-patterns.md) |
| `status` | Memory system health check |

---

## Workflow

### 1. Parse Subcommand
```
Extract first argument as subcommand
If no subcommand -> AskUserQuestion
Validate subcommand is one of: search, load, history, viz, status
Parse remaining flags
```

### 2. Execute Subcommand
Route to appropriate handler based on subcommand.

### 3. Report Results
Format output appropriate to the operation.

---

## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| [entity-extraction-patterns](rules/entity-extraction-patterns.md) | HIGH | Entity types, relation types, graph query semantics |
| [deduplication-strategy](rules/deduplication-strategy.md) | HIGH | Edit-over-Write pattern, anchor-based insertion, verification |

---

## Session Resume

See [Session Resume Patterns](references/session-resume-patterns.md) for CC 2.1.31 resume hints, context capture before ending, and resume workflows for PRs, issues, and implementations.

---

## Related Skills

- `ork:remember` - Store decisions and patterns (write-side)

---

## Error Handling

- If graph empty for viz: Show helpful message about using /ork:remember
- If subcommand invalid: Show usage help
- If memory files corrupt: Report and offer repair
- If search query empty: Show recent entities instead
- If no search results: Suggest alternatives
