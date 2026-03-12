---
name: remember
license: MIT
compatibility: "Claude Code 2.1.74+. Requires memory MCP server."
description: "Stores decisions and patterns in knowledge graph. Use when saving patterns, remembering outcomes, or recording decisions."
argument-hint: "[decision-or-pattern]"
context: none
version: 3.0.0
author: OrchestKit
tags: [memory, decisions, patterns, best-practices, graph-memory]
user-invocable: true
allowed-tools: [Read, Grep, Glob, Bash, mcp__memory__create_entities, mcp__memory__create_relations, mcp__memory__add_observations, mcp__memory__search_nodes]
complexity: low
model: haiku
metadata:
  category: workflow-automation
  mcp-server: memory
---

# Remember - Store Decisions and Patterns

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
