---
name: load-context
description: Auto-load relevant memories at session start from both mem0 and graph
user-invocable: true
auto-invoke: session-start
context: inherit
allowed-tools: Read
---

# Load Context - Memory Fabric Initialization

Auto-load relevant memories at session start from both Mem0 semantic memory and the knowledge graph for seamless session continuity.

**CC 2.1.6 Context-Aware:** Loading adapts based on `context_window.used_percentage`.

## Context-Aware Loading Tiers

Memory Fabric adjusts how much context to load based on current context pressure:

| Context Usage | Decisions | Blockers | Entities | Behavior |
|---------------|-----------|----------|----------|----------|
| 0-40% (Green) | 5 | 3 | 5 | Full context load |
| 40-70% (Yellow) | 3 | 1 | 3 | Reduced context |
| 70-90% (Orange) | 1 | critical only | 0 | Minimal context |
| >90% (Red) | 0 | 0 | 0 | Skip, show hint only |

**Rationale:** When context is tight, don't contribute to the problem. Load less, but preserve the ability to sync important decisions.

### Check Context Pressure First

Before loading, check the current context usage:

```
If context_window.used_percentage > 90%:
  → Output: "[Memory Fabric] Skipping context load - context at {X}%. Use /recall for on-demand search."
  → Exit early

If context_window.used_percentage > 70%:
  → Use minimal tier (1 decision, critical blockers only)
  → Add note: "Context-aware: reduced load due to {X}% context usage"

If context_window.used_percentage > 40%:
  → Use reduced tier (3 decisions, 1 blocker, 3 entities)
```

## When to Use

- **Automatically**: Invoked at session start via `auto-invoke: session-start`
- **Manually**: Run `/load-context` to reload memories mid-session
- **After MCP reconnect**: Refresh context if MCP servers were restarted

## Workflow

### 1. Detect Project Name

```bash
# Extract project name from current directory
PROJECT=$(basename "$PWD")
# Example: skillforge-claude-plugin -> skillforge-claude-plugin
```

### 2. Query Recent Sessions (Mem0)

Call `mcp__mem0__search_memories`:

```json
{
  "query": "session context blockers next steps",
  "filters": {
    "AND": [
      { "user_id": "{project}-continuity" },
      { "created_at": { "gte": "7 days ago" } }
    ]
  },
  "limit": 3,
  "enable_graph": true
}
```

**Extract from results:**
- Session summaries with status
- Unresolved blockers (status != completed)
- Next steps from previous sessions

### 3. Query Recent Decisions (Mem0)

Call `mcp__mem0__get_memories`:

```json
{
  "filters": {
    "AND": [
      { "user_id": "{project}-decisions" }
    ]
  },
  "page_size": 5
}
```

**Extract from results:**
- Architectural decisions (sorted by recency)
- Categories: decision, architecture, pattern
- Outcome: success, failed, neutral

### 4. Query Graph Entities (Knowledge Graph)

Call `mcp__memory__search_nodes`:

```json
{
  "query": "recent decisions patterns"
}
```

Or for comprehensive context, call `mcp__memory__read_graph` to get:
- All entities (agents, technologies, patterns)
- All relations (RECOMMENDS, USES, FLAGGED, BLOCKED_BY)

### 5. Merge and Format Output

Combine results into structured Memory Fabric output:

```
[Memory Fabric Loaded]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recent Decisions ({count}):
  - [{time ago}] {decision_text}
  - [{time ago}] {decision_text}
  - [{time ago}] {decision_text}

Unresolved Blockers ({count}):
  - {blocker_text} (session {date})

Active Entities ({count}):
  - {entity} -> {relation} -> {entity}
  - {entity} -> {relation} -> {entity}

Next Steps from Last Session:
  - {step_1}
  - {step_2}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 6. Output as Skill Result

Return the formatted context directly as content injection (NOT as hints).
This ensures the context is visible in the conversation.

## Output Sections

| Section | Source | Purpose |
|---------|--------|---------|
| Recent Decisions | `{project}-decisions` | Recall architectural choices |
| Unresolved Blockers | `{project}-continuity` | Track pending issues |
| Active Entities | Knowledge Graph | Show relationships |
| Next Steps | `{project}-continuity` | Resume where you left off |

## Time Formatting

| Duration | Display |
|----------|---------|
| < 1 day | "today" |
| 1 day | "yesterday" |
| 2-7 days | "X days ago" |
| 1-4 weeks | "X weeks ago" |
| > 4 weeks | "X months ago" |

## Error Handling

### Mem0 MCP Unavailable

```
[Memory Fabric]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mem0 MCP server unavailable.

To configure:
1. Run /configure and enable Mem0 integration
2. Or set MEM0_API_KEY in your environment
3. Verify with /doctor

Continuing without semantic memory...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Knowledge Graph MCP Unavailable

```
[Memory Fabric]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Knowledge Graph MCP server unavailable.

To configure:
1. Run /configure and enable Memory (graph) integration
2. Verify with /doctor

Continuing without graph relationships...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### No Memories Found

```
[Memory Fabric Loaded]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No memories found for this project.

This is normal for new projects. Memories will be created as you:
- Make architectural decisions (/remember)
- Complete sessions (auto-synced via mem0-sync)
- Work with specialized agents

Tip: Use /remember to start building your project memory.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Partial Availability

When only some MCP servers are available, load what's possible and indicate gaps:

```
[Memory Fabric Loaded] (partial)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recent Decisions (3):
  - [2 days ago] Use cursor-based pagination for all endpoints
  - [3 days ago] PostgreSQL 17 with pgvector for RAG
  - [5 days ago] FastAPI + SQLAlchemy async

[Graph unavailable - skipped entity relationships]

Next Steps from Last Session:
  - Complete auth migration
  - Add unit tests for new endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## MCP Tool Reference

### mcp__mem0__search_memories

Search semantic memories with filters:
- `query`: Natural language search
- `filters`: Structured filters (user_id, metadata, created_at)
- `limit`: Max results (default: 10)
- `enable_graph`: Include graph relationships

### mcp__mem0__get_memories

List memories with pagination:
- `filters`: Structured filters (user_id required)
- `page`: 1-indexed page number
- `page_size`: Results per page (default: 10)

### mcp__memory__search_nodes

Search knowledge graph nodes:
- `query`: Search term for entity names, types, observations

### mcp__memory__read_graph

Read entire knowledge graph:
- Returns all entities and relations
- Use sparingly (can be large)

## Related Skills

- `mem0-sync` - Save context at session end
- `remember` - Store decisions and patterns manually
- `recall` - Search memories on-demand
- `configure` - Set up MCP integrations

## Arguments

- No arguments: Load context using default settings
- `--refresh`: Force reload even if recently loaded
- `--verbose`: Show detailed MCP query results
