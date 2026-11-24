---
name: memory
license: MIT
compatibility: "Claude Code 2.1.328+. Remember and search need a memory MCP server."
description: "Memory in three verbs: remember (store a decision or pattern), search (search, load, history, viz, status) and dream (consolidate stale memory files). Use when storing, finding or cleaning up what was learned or decided."
argument-hint: "[remember|search|dream] [text, query or flags]"
context: inherit
user-invocable: true
allowed-tools: "Read Write Edit Grep Glob Bash AskUserQuestion mcp__memory__search_nodes mcp__memory__read_graph mcp__memory__open_nodes mcp__memory__create_entities mcp__memory__create_relations mcp__memory__add_observations"
effort: low
model: sonnet
metadata:
  category: mcp-enhancement
  mcp-server: memory
  version: "3.0.0"
  author: "OrchestKit"
  complexity: "medium"
  tags: "memory, best-practices, graph, session, context, search, remember, dream"
paths:
  - ".claude/memory/**"
  - ".claude/projects/**/memory/**"
---

# Memory - Remember, Search, Dream

Three verbs: `remember` (store, "Verb: remember" below), `search` (read, the subcommands below), `dream` (consolidate, `Read("references/verb-dream.md")`). Formerly the skills `remember` and `dream`: `/ork:remember` is now `/ork:memory remember`.

> **Cross-session read strategy (Opus 5.5 / CC 2.1.111+):** Opus 5.5 reads filesystem memory reliably across sessions. When loading context at session start, prefer the layered read order:
> 1. `~/.claude/projects/<slug>/memory/MEMORY.md` (durable index — load first, always)
> 2. `.claude/chain/state.json` + most recent `NN-*.json` handoff (session continuation)
> 3. MCP `mcp__memory__search_nodes` for anything the filesystem index doesn't answer (typed graph traversal)
>
> Layer 1 is cheap (small index file), Layer 2 is scoped (session-specific), Layer 3 is selective (only when needed). Avoid dumping the full knowledge graph into context — use the index to narrow the search first.

## Argument Resolution

```python
SUBCOMMAND = "$ARGUMENTS[0]"  # First token: remember, dream, or search, load, history, viz, status
QUERY = "$ARGUMENTS[1]"       # Second token onward: search query, text to remember, or flags
# $ARGUMENTS is the full string (CC 2.1.59 indexed access)
```

`remember`: follow "Verb: remember" below. `dream`: `Read("references/verb-dream.md")` (flag `--dry-run`). Anything else is a search subcommand.

## Usage

```bash
memory remember <text> # Store a decision or pattern (flags below)
memory dream            # Consolidate memory files (--dry-run)
memory search <query>  # Search knowledge graph
memory load             # Load context at session start
memory history          # View decision timeline
memory viz              # Visualize knowledge graph
memory status           # Show memory system health
```

---

## CRITICAL: Use AskUserQuestion When No Subcommand

With no verb, ask which one (`remember`, `search`, `dream`). For `search`, ask which subcommand:

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

Load details: `Read("references/memory-commands.md")` for full usage, flags, output formats, and context-aware result limits for each subcommand.

| Subcommand | Purpose |
|------------|---------|
| `search` | Search past decisions, patterns, entities. Supports `--category` (maps to metadata.category), `--limit`, `--agent` (scopes by agent_id), `--global` filter flags |
| `load` | Auto-load relevant memories at session start. Supports `--project`, `--global` |
| `history` | Decision timeline with table, Mermaid, or JSON output. Supports `--since`, `--mermaid` |
| `viz` | Render knowledge graph as Mermaid diagram. See also `Read("references/mermaid-patterns.md")` |
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
Validate subcommand is one of: remember, dream, search, load, history, viz, status
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
| entity-extraction-patterns (load `rules/entity-extraction-patterns.md`) | HIGH | Entity types, relation types, graph query semantics |
| deduplication-strategy (load `rules/deduplication-strategy.md`) | HIGH | Edit-over-Write pattern, anchor-based insertion, verification |
| remember rules (load `rules/duplicate-entity-detection.md`, `entity-relationship-validation.md`, `observation-quality-gate.md`) | HIGH | Search before create, allowed entity and relation types, observations need a metric or condition |

---

## Session Resume

Load details: `Read("references/session-resume-patterns.md")` for CC 2.1.31 resume hints, context capture before ending, and resume workflows for PRs, issues, and implementations.

---

## Verb: remember (store decisions and patterns)

> **Filesystem vs MCP memory (Opus 5.5 guidance, CC 2.1.111+):** Opus 5.5 reads filesystem memory reliably across multi-session work. Use that to your advantage:
> - **Short-lived handoff state** (current phase, task in-progress, pending approvals) → `.claude/chain/*.json` files. Small, structured, session-scoped.
> - **Durable auto-memory** (user facts, feedback, project conventions) → `~/.claude/projects/<slug>/memory/*.md` files with a one-line index in `MEMORY.md`. Read on every session start.
> - **Cross-session knowledge graph** (typed entities + relations for query traversal) → MCP memory server (this skill's default path). Best when future sessions will *search* for patterns.
>
> The three are complementary, not alternatives. Prefer fs for anything you'd want to grep; prefer MCP for anything you'd want to traverse.

Store important decisions, patterns, or context in the knowledge graph for future sessions. Supports tracking success/failure outcomes for building a Best Practice Library.

### Argument Resolution

```python
TEXT = "$ARGUMENTS"        # Full argument string; drop the leading `remember` token, e.g., "We use cursor pagination"
FLAG = "$ARGUMENTS[1]"     # Token after `remember` — check for --success, --failed, --category, --agent
# $ARGUMENTS[0] is the verb; flags start at $ARGUMENTS[1] (CC 2.1.59 indexed access)
# Remaining tokens after flags = the text to remember
```

### Architecture

The remember verb uses **knowledge graph** as storage:

1. **Knowledge Graph**: Entity and relationship storage via `mcp__memory__create_entities` and `mcp__memory__create_relations`. These tools come from a `memory` MCP server that OrchestKit does not bundle: configure one in the user or project scope first (for example `@modelcontextprotocol/server-memory`) and confirm it with `claude mcp list`. Without it, every graph step here does nothing.

**Benefits:**
- Free and local once the memory server is configured
- Explicit relationship queries (e.g., "what does X use?")
- Cross-referencing between entities
- No cloud dependency

**Automatic Entity Extraction:**
- Extracts capitalized terms as potential entities (PostgreSQL, React, pgvector)
- Detects agent names (database-engineer, backend-system-architect)
- Identifies pattern names (cursor-pagination, connection-pooling)
- Recognizes "X uses Y", "X recommends Y", "X requires Y" relationship patterns

### Usage

#### Store Decisions (Default)
```
remember <text>
remember --category <category> <text>
remember --success <text>     # Mark as successful pattern
remember --failed <text>      # Mark as anti-pattern
remember --success --category <category> <text>

# Agent-scoped memory
remember --agent <agent-id> <text>         # Store in agent-specific scope
remember --global <text>                   # Store as cross-project best practice
```

### Flags

| Flag | Behavior |
|------|----------|
| (default) | Write to graph |
| `--success` | Mark as successful pattern |
| `--failed` | Mark as anti-pattern |
| `--category <cat>` | Set category |
| `--agent <agent-id>` | Scope memory to a specific agent |
| `--global` | Store as cross-project best practice |

### Categories

- `decision` - Why we chose X over Y (default)
- `architecture` - System design and patterns
- `pattern` - Code conventions and standards
- `blocker` - Known issues and workarounds
- `constraint` - Limitations and requirements
- `preference` - User/team preferences
- `pagination` - Pagination strategies
- `database` - Database patterns
- `authentication` - Auth approaches
- `api` - API design patterns
- `frontend` - Frontend patterns
- `performance` - Performance optimizations

### Outcome Flags

- `--success` - Pattern that worked well (positive outcome)
- `--failed` - Pattern that caused problems (anti-pattern)

If neither flag is provided, the memory is stored as neutral (informational).

### Workflow

#### 1. Parse Input

```
Check for --success flag → outcome: success
Check for --failed flag → outcome: failed
Check for --category <category> flag
Check for --agent <agent-id> flag → agent_id: "ork:{agent-id}"
Check for --global flag → use global user_id
Extract the text to remember
If no category specified, auto-detect from content
```

#### 2. Auto-Detect Category

| Keywords | Category |
|----------|----------|
| chose, decided, selected | decision |
| architecture, design, system | architecture |
| pattern, convention, style | pattern |
| blocked, issue, bug, workaround | blocker |
| must, cannot, required, constraint | constraint |
| pagination, cursor, offset, page | pagination |
| database, sql, postgres, query | database |
| auth, jwt, oauth, token, session | authentication |
| api, endpoint, rest, graphql | api |
| react, component, frontend, ui | frontend |
| performance, slow, fast, cache | performance |

#### 3. Extract Lesson (for anti-patterns)

If outcome is "failed", look for:
- "should have", "instead use", "better to"
- If not found, prompt user: "What should be done instead?"

#### 4-6. Extract Entities and Create Graph

Extract entities (Technology, Agent, Pattern, Project, AntiPattern) from the text, detect relationship patterns ("X uses Y", "chose X over Y", etc.), then create entities and relations in the knowledge graph.

#### 7. Confirm Type + Scope (AskUserQuestion — M118 #1466)

Auto-classification is best-effort. Before writing, ask the user to confirm both the memory type and the persistence scope. Pre-select the auto-detected type as the default option when the classifier is confident (≥0.9):

```python
# Skip when the invocation already specifies type and scope:
#   remember --type=preference --global  → skip, use those values
#   remember --session  → skip, no persistence
#
# Otherwise, ask both:
AskUserQuestion(questions=[
  {"question": "What type of memory?",
   "header": "Type",
   "options": [
     {"label": "Preference", "description": "How I like to work (style, format, tooling)"},
     {"label": "Project fact", "description": "State of THIS codebase (decisions, constraints)"},
     {"label": "Reference", "description": "External system pointer (URL, doc, dashboard)"},
     {"label": "Feedback", "description": "Correction to future behavior — applied as a rule"}
   ]},
  {"question": "Apply to?",
   "header": "Scope",
   "options": [
     {"label": "This project (default)", "description": "Scoped to .claude/projects/<this-project>/memory/"},
     {"label": "All projects (global)", "description": "User-level memory at ~/.claude/memory/"},
     {"label": "This session only", "description": "Print to context but don't persist"}
   ]}
])
```

**Default selection rules:**
- If auto-detected category maps to one of the 4 type options with confidence ≥0.9, that option is pre-selected (the user can still override).
- "This project" is always the scope default.
- "This session only" returns immediately without writing — useful when the user wants to surface a fact for the conversation but not commit it.

**Global memory writes** route to `~/.claude/memory/<filename>.md` instead of the project-local memory directory. The MEMORY.md index is updated in whichever scope was selected (project- or user-level).

Load entity extraction rules, type assignment, relationship patterns, and graph creation examples: `Read("references/graph-operations.md")`

#### 7. Confirm Storage

Display confirmation using the appropriate template (success, anti-pattern, or neutral) showing created entities, relations, and graph stats.

Load output templates and examples: `Read("references/confirmation-templates.md")`

### File-Based Memory Updates

When updating `.claude/memory/MEMORY.md` or project memory files:
- **PREFER Edit over Write** to preserve existing content and avoid overwriting
- Use stable anchor lines: `## Recent Decisions`, `## Patterns`, `## Preferences`
- See `rules/deduplication-strategy.md` (Edit over Write) for the full Edit pattern
- This applies to the calling agent's file operations, not to the knowledge graph operations above

---

## References

Load on demand with `Read("references/<file>")`:

| File | Content |
|------|---------|
| `verb-dream.md`, `housekeeping.md`, `index-budget.md`, `safe-deletes.md` | Dream: the full verb, housekeeping, MEMORY.md budget, safe deletes |
| `category-detection.md`, `graph-operations.md`, `confirmation-templates.md`, `entity-extraction-workflow.md`, `examples.md` | Remember: category rules, graph operations, output templates, extraction, examples |
| `memory-commands.md`, `mermaid-patterns.md`, `session-resume-patterns.md` | Search: subcommands, Mermaid, resume |

---

## Error Handling

- If graph empty for viz: Show helpful message about using the remember verb
- If subcommand invalid: Show usage help
- If memory files corrupt: Report and offer repair
- If search query empty: Show recent entities instead
- If no search results: Suggest alternatives
- Remember: knowledge graph unavailable -> show configuration instructions
- Remember: empty text -> ask user for content; text >2000 chars -> truncate with notice
- Remember: both --success and --failed -> ask user to clarify
- Remember: entity extraction fails -> create generic Decision entity; relation fails -> create entities first, retry
