---
description: "Read-side memory operations: search, recall, load, sync, history, visualize. Use when searching past decisions, loading session context, or viewing the knowledge graph."
allowed-tools: [Read, Grep, Glob, Bash, AskUserQuestion, mcp__memory__search_nodes, mcp__memory__read_graph]
---

# Auto-generated from skills/memory/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Memory - Read & Access Operations

Unified read-side memory skill with subcommands for searching, loading, syncing, history, and visualization.

## Argument Resolution

```python
SUBCOMMAND = "$ARGUMENTS[0]"  # First token: search, load, history, viz, status
QUERY = "$ARGUMENTS[1]"       # Second token onward: search query or flags
# $ARGUMENTS is the full string (CC 2.1.59 indexed access)
```

## Usage

```bash
/ork:memory search <query>  # Search knowledge graph
/ork:memory load             # Load context at session start
/ork:memory history          # View decision timeline
/ork:memory viz              # Visualize knowledge graph
/ork:memory status           # Show memory system health
```


## CRITICAL: Use AskUserQuestion When No Subcommand

If invoked without a subcommand, ask the user what they want:

```python
AskUserQuestion(
  questions=[{
    "question": "What memory operation do you need?",
    "header": "Operation",
    "options": [
      {"label": "search", "description": "Search decisions and patterns in knowledge graph", "markdown": "```\nSearch Knowledge Graph\n──────────────────────\n  query ──▶ mcp__memory ──▶ results\n\n  Flags:\n  --category  Filter by type\n  --agent     Scope to agent\n  --limit N   Max results\n  --global    Cross-project\n```"},
      {"label": "load", "description": "Load relevant context for this session", "markdown": "```\nLoad Session Context\n────────────────────\n  Auto-detect project ──▶\n  ┌────────────────────┐\n  │ Recent decisions   │\n  │ Active patterns    │\n  │ Project entities   │\n  └────────────────────┘\n  Flags: --project, --global\n```"},
      {"label": "history", "description": "View decision timeline", "markdown": "```\nDecision Timeline\n─────────────────\n  ┌──── Feb 28 ────────────┐\n  │ Used Postgres over Mongo│\n  ├──── Feb 27 ────────────┤\n  │ Adopted MVC pattern     │\n  ├──── Feb 26 ────────────┤\n  │ Chose JWT over sessions │\n  └────────────────────────┘\n  Flags: --since, --mermaid\n```"},
      {"label": "viz", "description": "Visualize knowledge graph as Mermaid", "markdown": "```\nKnowledge Graph Viz\n───────────────────\n  Entities ──▶ Mermaid diagram\n\n  [Project] ──uses──▶ [Postgres]\n      │                    │\n      └──has──▶ [Auth] ──uses──▶ [JWT]\n\n  Output: Mermaid code block\n```"},
      {"label": "status", "description": "Check memory system health", "markdown": "```\nMemory Health Check\n───────────────────\n  ┌─────────────────────┐\n  │ MCP server    ✓/✗   │\n  │ Entity count  N     │\n  │ Relation count N    │\n  │ Last write    date  │\n  │ Graph size    N KB  │\n  └─────────────────────┘\n```"}
    ],
    "multiSelect": false
  }]
)
```


## Subcommands

See [Memory Commands Reference](references/memory-commands.md) for full usage, flags, output formats, and context-aware result limits for each subcommand.

| Subcommand | Purpose |
|------------|---------|
| `search` | Search past decisions, patterns, entities. Supports `--category` (maps to metadata.category), `--limit`, `--agent` (scopes by agent_id), `--global` filter flags |
| `load` | Auto-load relevant memories at session start. Supports `--project`, `--global` |
| `history` | Decision timeline with table, Mermaid, or JSON output. Supports `--since`, `--mermaid` |
| `viz` | Render knowledge graph as Mermaid diagram. See also [mermaid-patterns.md](references/mermaid-patterns.md) |
| `status` | Memory system health check |


## Workflow

### 1. Parse Subcommand
```
Extract first argument as subcommand
If no subcommand -> AskUserQuestion
Validate subcommand is one of: search, load, history, viz, status
Parse remaining flags
Check for --agent <agent-id> flag → agent_id: "ork:{agent-id}"
```

### 2. Execute Subcommand
Route to appropriate handler based on subcommand.

### 3. Report Results
Format output appropriate to the operation.


## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| [entity-extraction-patterns](rules/entity-extraction-patterns.md) | HIGH | Entity types, relation types, graph query semantics |
| [deduplication-strategy](rules/deduplication-strategy.md) | HIGH | Edit-over-Write pattern, anchor-based insertion, verification |


## Session Resume

See [Session Resume Patterns](references/session-resume-patterns.md) for CC 2.1.31 resume hints, context capture before ending, and resume workflows for PRs, issues, and implementations.


## Related Skills

- `ork:remember` - Store decisions and patterns (write-side)


## Error Handling

- If graph empty for viz: Show helpful message about using /ork:remember
- If subcommand invalid: Show usage help
- If memory files corrupt: Report and offer repair
- If search query empty: Show recent entities instead
- If no search results: Suggest alternatives
