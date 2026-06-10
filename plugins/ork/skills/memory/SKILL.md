---
name: memory
license: MIT
compatibility: "Claude Code 2.1.170+. Requires memory MCP server."
description: "Unified read-side memory operations including knowledge graph search, session context loading, decision timeline viewing, and Mermaid graph visualization. Subcommands: search, load, history, viz, status. Complements /ork:remember (write-side). Use when searching past decisions, loading context, or visualizing the knowledge graph."
argument-hint: "[subcommand] [query]"
context: inherit
version: 2.0.1
author: OrchestKit
tags: [memory, graph, session, context, sync, visualization, history, search]
user-invocable: true
allowed-tools: [Read, Grep, Glob, Bash, AskUserQuestion, mcp__memory__search_nodes, mcp__memory__read_graph]
complexity: low
persuasion-type: collaborative
effort: low
model: haiku
metadata:
  category: mcp-enhancement
  mcp-server: memory
triggers:
  keywords: [memory, recall, "search memory", "past decisions", "knowledge graph", "load context", "prior decisions", "what did we decide"]
  examples:
    - "search my memory for past database decisions"
    - "what did we decide about pagination last time"
    - "show me the knowledge graph"
  anti-triggers: [remember, save, store, commit, implement, explore]
paths:
  - ".claude/memory/**"
  - ".claude/projects/**/memory/**"
---

# Memory - Read & Access Operations

Unified read-side memory skill with subcommands for searching, loading, syncing, history, and visualization.

> **Cross-session read strategy (Opus 4.8 / CC 2.1.111+):** Opus 4.8 reads filesystem memory more reliably than older tiers. When loading context at session start, prefer the layered read order:
> 1. `~/.claude/projects/<slug>/memory/MEMORY.md` (durable index — load first, always)
> 2. `.claude/chain/state.json` + most recent `NN-*.json` handoff (session continuation)
> 3. MCP `mcp__memory__search_nodes` for anything the filesystem index doesn't answer (typed graph traversal)
>
> Layer 1 is cheap (small index file), Layer 2 is scoped (session-specific), Layer 3 is selective (only when needed). Avoid dumping the full knowledge graph into context — use the index to narrow the search first.

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
      {"label": "history", "description": "Decision timeline + knowledge-graph viz (--mermaid)"},
      {"label": "status", "description": "Check memory system health"}
    ],
    "multiSelect": false
  }]
)
```

---

## Subcommands

Load details: `Read("${CLAUDE_SKILL_DIR}/references/memory-commands.md")` for full usage, flags, output formats, and context-aware result limits for each subcommand.

| Subcommand | Purpose |
|------------|---------|
| `search` | Search past decisions, patterns, entities. Supports `--category` (maps to metadata.category), `--limit`, `--agent` (scopes by agent_id), `--global` filter flags |
| `load` | Auto-load relevant memories at session start. Supports `--project`, `--global` |
| `history` | Decision timeline with table, Mermaid, or JSON output. Supports `--since`, `--mermaid` |
| `viz` | Render knowledge graph as Mermaid diagram. See also `Read("${CLAUDE_SKILL_DIR}/references/mermaid-patterns.md")` |
| `status` | Memory system health check |

---

## Scheduled Sweeps (cron)

### Nightly KG staleness report

Cron job in `.github/workflows/memory-staleness.yml` runs nightly at 04:00 UTC. Calls `scripts/staleness_cron.py` to scan ALL memory MCP entities, flag those whose latest observation timestamp is older than 30 days, and write a Markdown report to `docs/reports/memory-staleness-YYYY-MM-DD.md`.

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/staleness_cron.py docs/reports/ \
    --threshold-days 30 --limit 50
```

Auto-skip conditions (all exit 0, all WARN-logged):

| Skip reason | Trigger |
|-------------|---------|
| `yg-mcp-core not importable` | `yg-mcp-core>=0.3.0` not installed (orchestkit is public; yg-mcp-core lives on private `pypi.yonyon.ai` — HQ-only) |
| `memory MCP unreachable` | memory MCP server down OR `.mcp.json` doesn't define `memory` |

**Report contents:**
- Total / stale / fresh entity counts
- Top N stale entries sorted by staleness (no-timestamp first, then oldest → newest)
- Each row: name, entityType, age in days, observations count
- Suggested actions per age bucket (>90d review, >180d archive candidate)

**Treats entities with no parsable timestamp as stale** — operator intervention is the right outcome (backfill `last_read` observation OR prune).

Pure helpers (`parse_iso_timestamp`, `latest_observation_timestamp`, `is_stale`, `build_report_payload`, `render_markdown`) live in sibling `staleness_lib.py` for unit-testability.

Mirrors `Yonatan-HQ/hq-ext-plugin#194` (audio_podcast) and orchestkit#1886 (post-synth podcast) + #1887 (memory writeback) pattern. Unblocked by `Yonatan-HQ/core#993` (yg-mcp-core 0.3.0).

---

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

---

## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| entity-extraction-patterns (load `${CLAUDE_SKILL_DIR}/rules/entity-extraction-patterns.md`) | HIGH | Entity types, relation types, graph query semantics |
| deduplication-strategy (load `${CLAUDE_SKILL_DIR}/rules/deduplication-strategy.md`) | HIGH | Edit-over-Write pattern, anchor-based insertion, verification |

---

## Session Resume

Load details: `Read("${CLAUDE_SKILL_DIR}/references/session-resume-patterns.md")` for CC 2.1.31 resume hints, context capture before ending, and resume workflows for PRs, issues, and implementations.

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
