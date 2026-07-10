---
name: remember
license: MIT
compatibility: "Claude Code 2.1.206+. Requires memory MCP server."
description: "Stores decisions, patterns, and outcomes in the MCP memory knowledge graph as entities with typed observations and relations. Supports recording architectural decisions, anti-patterns, tool preferences, workflow outcomes, and project conventions that persist across sessions. Use when saving patterns, remembering outcomes, recording decisions, or building institutional knowledge."
argument-hint: "[decision-or-pattern]"
context: inherit
version: 3.0.1
author: OrchestKit
tags: [memory, decisions, patterns, best-practices, graph-memory]
user-invocable: true
allowed-tools: [Read, Grep, Glob, Bash, mcp__memory__create_entities, mcp__memory__create_relations, mcp__memory__add_observations, mcp__memory__search_nodes]
complexity: low
persuasion-type: collaborative
effort: low
model: haiku
metadata:
  category: workflow-automation
  mcp-server: memory
triggers:
  keywords: [remember, save, store, record, "best practice", "anti-pattern", "lets not forget", "mark this"]
  examples:
    - "remember that we chose Postgres over MongoDB"
    - "save this decision: always use cursor-based pagination"
    - "store this pattern as a best practice"
  anti-triggers: [recall, search, "show memory", "knowledge graph", "load context", explore]
---

# Remember - Store Decisions and Patterns

> **Filesystem vs MCP memory (Opus 4.8 guidance, CC 2.1.111+):** Opus 4.8 is *substantially* better than older tiers at reading filesystem memory across multi-session work. Use that to your advantage:
> - **Short-lived handoff state** (current phase, task in-progress, pending approvals) → `.claude/chain/*.json` files. Small, structured, session-scoped.
> - **Durable auto-memory** (user facts, feedback, project conventions) → `~/.claude/projects/<slug>/memory/*.md` files with a one-line index in `MEMORY.md`. Read on every session start.
> - **Cross-session knowledge graph** (typed entities + relations for query traversal) → MCP memory server (this skill's default path). Best when future sessions will *search* for patterns.
>
> The three are complementary, not alternatives. Prefer fs for anything you'd want to grep; prefer MCP for anything you'd want to traverse.

Store important decisions, patterns, or context in the knowledge graph for future sessions. Supports tracking success/failure outcomes for building a Best Practice Library.

## Argument Resolution

```python
TEXT = "$ARGUMENTS"        # Full argument string, e.g., "We use cursor pagination"
FLAG = "$ARGUMENTS[0]"     # First token — check for --success, --failed, --category, --agent
# Parse flags from $ARGUMENTS[0], $ARGUMENTS[1] etc. (CC 2.1.59 indexed access)
# Remaining tokens after flags = the text to remember
```

## Architecture

The remember skill uses **knowledge graph** as storage:

1. **Knowledge Graph**: Entity and relationship storage via `mcp__memory__create_entities` and `mcp__memory__create_relations` - FREE, zero-config, always works

**Benefits:**
- Zero configuration required - works out of the box
- Explicit relationship queries (e.g., "what does X use?")
- Cross-referencing between entities
- No cloud dependency

**Automatic Entity Extraction:**
- Extracts capitalized terms as potential entities (PostgreSQL, React, pgvector)
- Detects agent names (database-engineer, backend-system-architect)
- Identifies pattern names (cursor-pagination, connection-pooling)
- Recognizes "X uses Y", "X recommends Y", "X requires Y" relationship patterns

## Usage

### Store Decisions (Default)
```
/ork:remember <text>
/ork:remember --category <category> <text>
/ork:remember --success <text>     # Mark as successful pattern
/ork:remember --failed <text>      # Mark as anti-pattern
/ork:remember --success --category <category> <text>

# Agent-scoped memory
/ork:remember --agent <agent-id> <text>         # Store in agent-specific scope
/ork:remember --global <text>                   # Store as cross-project best practice
```

## Flags

| Flag | Behavior |
|------|----------|
| (default) | Write to graph |
| `--success` | Mark as successful pattern |
| `--failed` | Mark as anti-pattern |
| `--category <cat>` | Set category |
| `--agent <agent-id>` | Scope memory to a specific agent |
| `--global` | Store as cross-project best practice |

## Categories

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

## Outcome Flags

- `--success` - Pattern that worked well (positive outcome)
- `--failed` - Pattern that caused problems (anti-pattern)

If neither flag is provided, the memory is stored as neutral (informational).

## Workflow

### 1. Parse Input

```
Check for --success flag → outcome: success
Check for --failed flag → outcome: failed
Check for --category <category> flag
Check for --agent <agent-id> flag → agent_id: "ork:{agent-id}"
Check for --global flag → use global user_id
Extract the text to remember
If no category specified, auto-detect from content
```

### 2. Auto-Detect Category

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

### 3. Extract Lesson (for anti-patterns)

If outcome is "failed", look for:
- "should have", "instead use", "better to"
- If not found, prompt user: "What should be done instead?"

### 4-6. Extract Entities and Create Graph

Extract entities (Technology, Agent, Pattern, Project, AntiPattern) from the text, detect relationship patterns ("X uses Y", "chose X over Y", etc.), then create entities and relations in the knowledge graph.

### 7. Confirm Type + Scope (AskUserQuestion — M118 #1466)

Auto-classification is best-effort. Before writing, ask the user to confirm both the memory type and the persistence scope. Pre-select the auto-detected type as the default option when the classifier is confident (≥0.9):

```python
# Skip when the invocation already specifies type and scope:
#   /ork:remember --type=preference --global  → skip, use those values
#   /ork:remember --session  → skip, no persistence
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

Load entity extraction rules, type assignment, relationship patterns, and graph creation examples: `Read("${CLAUDE_SKILL_DIR}/references/graph-operations.md")`

### 7. Confirm Storage

Display confirmation using the appropriate template (success, anti-pattern, or neutral) showing created entities, relations, and graph stats.

Load output templates and examples: `Read("${CLAUDE_SKILL_DIR}/references/confirmation-templates.md")`

## File-Based Memory Updates

When updating `.claude/memory/MEMORY.md` or project memory files:
- **PREFER Edit over Write** to preserve existing content and avoid overwriting
- Use stable anchor lines: `## Recent Decisions`, `## Patterns`, `## Preferences`
- See the `memory` skill's "Permission-Free File Operations" section for the full Edit pattern
- This applies to the calling agent's file operations, not to the knowledge graph operations above

---

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `category-detection.md` | Auto-detection rules for categorizing memories (priority order) |
| `graph-operations.md` | Entity extraction, type assignment, relationship patterns, graph creation |
| `confirmation-templates.md` | Output templates (success, anti-pattern, neutral) and usage examples |

---

## Related Skills
- `ork:memory` - Search, load, sync, visualize (read-side operations)

## Error Handling

- Knowledge graph unavailable → show configuration instructions
- Empty text → ask user for content; text >2000 chars → truncate with notice
- Both --success and --failed → ask user to clarify
- Entity extraction fails → create generic Decision entity; relation fails → create entities first, retry
