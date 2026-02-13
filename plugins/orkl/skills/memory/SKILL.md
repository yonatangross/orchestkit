---
name: memory
description: "Read-side memory operations: search, load, sync, history, visualize. Use when searching past decisions, loading session context, or viewing the knowledge graph."
context: fork
version: 2.0.0
author: OrchestKit
tags: [memory, graph, session, context, sync, visualization, history, search]
user-invocable: true
allowedTools: [Read, Grep, Glob, Bash, AskUserQuestion, mcp__memory__search_nodes, mcp__memory__read_graph]
complexity: low
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

### `search` - Search Knowledge Graph

Search past decisions, patterns, and entities from the knowledge graph.

**Usage:**
```bash
/ork:memory search <query>                    # Search knowledge graph
/ork:memory search --category <cat> <query>   # Filter by category
/ork:memory search --limit <n> <query>        # Limit results (default: 10)
/ork:memory search --agent <agent-id> <query> # Filter by agent scope
/ork:memory search --global <query>           # Search cross-project best practices
```

**Flags:**

| Flag | Behavior |
|------|----------|
| (default) | Search graph |
| `--limit <n>` | Max results (default: 10) |
| `--category <cat>` | Filter by category |
| `--agent <agent-id>` | Filter results to a specific agent's memories |
| `--global` | Search cross-project best practices |

**Context-Aware Result Limits:**

Result limits automatically adjust based on `context_window.used_percentage`:

| Context Usage | Default Limit | Behavior |
|---------------|---------------|----------|
| 0-70% | 10 results | Full results with details |
| 70-85% | 5 results | Reduced, summarized results |
| >85% | 3 results | Minimal with "more available" hint |

**Search Workflow:**

1. Parse flags (--category, --limit, --agent, --global)
2. Build filters from flags:
   ```
   Check for --category <cat> flag → metadata.category: "<cat>"
   Check for --agent <agent-id> flag → agent_id: "ork:{agent-id}"
   Check for --global flag → user_id: "orchestkit-global-best-practices"
   ```
3. Search knowledge graph via `mcp__memory__search_nodes`:
   ```json
   { "query": "user's search query" }
   ```

**Entity Types to Look For:**
- `Technology`: Tools, frameworks, databases (pgvector, PostgreSQL, React)
- `Agent`: OrchestKit agents (database-engineer, backend-system-architect)
- `Pattern`: Named patterns (cursor-pagination, connection-pooling)
- `Decision`: Architectural decisions
- `Project`: Project-specific context
- `AntiPattern`: Failed patterns

**Result Formats:**

```
Found {count} results matching "{query}":

[GRAPH] {entity_name} ({entity_type})
   -> {relation1} -> {target1}
   Observations: {observation1}, {observation2}
```

No results:
```
No results found matching "{query}"

Try:
- Broader search terms
- /ork:remember to store new decisions
- --global flag to search cross-project best practices
```

---

### `load` - Load Session Context

Auto-load relevant memories at session start from knowledge graph.

**Usage:**
```bash
/ork:memory load              # Load all relevant context
/ork:memory load --project    # Project-specific only
/ork:memory load --global     # Include global best practices
```

**What it loads:**
1. Recent decisions from `.claude/memory/decisions.jsonl`
2. Active project context
3. Agent-specific memories (if in agent context)
4. Global best practices (if --global)

---

### `history` - Decision Timeline

Visualize architecture decisions over time, tracking evolution and rationale.

**Usage:**
```bash
/ork:memory history                    # Show recent decisions
/ork:memory history --category <cat>   # Filter by category
/ork:memory history --since 7d         # Last 7 days
/ork:memory history --mermaid          # Output as Mermaid timeline
```

**Output formats:**
- Table view (default)
- Mermaid timeline diagram (--mermaid)
- JSON (--json)

---

### `viz` - Knowledge Graph Visualization

Render the local knowledge graph as a Mermaid diagram.

**Usage:**
```bash
/ork:memory viz                  # Full graph
/ork:memory viz --entity <name>  # Focus on specific entity
/ork:memory viz --depth 2        # Limit relationship depth
/ork:memory viz --type <type>    # Filter by entity type
```

**Entity types:**
- Technology, Agent, Pattern, Decision, Project, AntiPattern, Constraint, Preference

**Relation types:**
- USES, RECOMMENDS, REQUIRES, ENABLES, PREFERS, CHOSE_OVER, USED_FOR, CONFLICTS_WITH

---

### `status` - Memory Health Check

Show memory system status and health.

**Usage:**
```bash
/ork:memory status
```

**Output:**
```
Memory System Status:
  Graph Memory:  healthy (42 decisions, 0 corrupt)
  Queue Depth:   3 pending
```

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

## Related Skills

- `remember` - Store decisions and patterns (write-side)

---

## CC 2.1.31 Session Resume Hints

At session end, Claude shows resume hints. To maximize resume effectiveness:

### Capture Context Before Ending

```bash
# Store key decisions and context
/ork:remember Key decisions for next session:
  - Decision 1: [brief]
  - Decision 2: [brief]
  - Next steps: [what remains]
```

### Resume Patterns

```bash
# For PR work: Use --from-pr (CC 2.1.27)
/ork:create-pr
# Later: claude --from-pr 123

# For issue fixing: Use memory load
/ork:fix-issue 456
# Later: /ork:memory load   # Reloads investigation context

# For implementation: Use memory search
/ork:implement user-auth
# Later: /ork:memory search "user-auth implementation"
```

### Best Practice

Always store investigation findings before session end:

```bash
/ork:remember Session summary for {task}:
  Completed: [what was done]
  Findings: [key discoveries]
  Next steps: [what remains]
  Blockers: [if any]
```

---

## Error Handling

- If graph empty for viz: Show helpful message about using /ork:remember
- If subcommand invalid: Show usage help
- If memory files corrupt: Report and offer repair
- If search query empty: Show recent entities instead
- If no search results: Suggest alternatives
