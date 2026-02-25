# Memory Subcommand Reference

Complete usage, flags, and output format details for each `/ork:memory` subcommand.

## `search` - Search Knowledge Graph

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
   Check for --category <cat> flag -> metadata.category: "<cat>"
   Check for --agent <agent-id> flag -> agent_id: "ork:{agent-id}"
   Check for --global flag -> user_id: "orchestkit-global-best-practices"
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

## `load` - Load Session Context

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

## `history` - Decision Timeline

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

## `viz` - Knowledge Graph Visualization

Render the local knowledge graph as a Mermaid diagram. See [mermaid-patterns.md](mermaid-patterns.md) for complete rendering reference.

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

## `status` - Memory Health Check

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
