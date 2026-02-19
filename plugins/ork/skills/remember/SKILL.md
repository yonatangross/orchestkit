---
name: remember
license: MIT
compatibility: "Claude Code 2.1.47+. Requires memory MCP server."
description: "Stores decisions and patterns in knowledge graph. Use when saving patterns, remembering outcomes, or recording decisions."
argument-hint: "[decision-or-pattern]"
context: none
version: 3.0.0
author: OrchestKit
tags: [memory, decisions, patterns, best-practices, graph-memory]
user-invocable: true
allowed-tools: [Read, Grep, Glob, Bash, mcp__memory__create_entities, mcp__memory__create_relations, mcp__memory__add_observations, mcp__memory__search_nodes]
complexity: low
metadata:
  category: workflow-automation
  mcp-server: memory
---

# Remember - Store Decisions and Patterns

Store important decisions, patterns, or context in the knowledge graph for future sessions. Supports tracking success/failure outcomes for building a Best Practice Library.

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
/remember <text>
/remember --category <category> <text>
/remember --success <text>     # Mark as successful pattern
/remember --failed <text>      # Mark as anti-pattern
/remember --success --category <category> <text>

# Agent-scoped memory
/remember --agent <agent-id> <text>         # Store in agent-specific scope
/remember --global <text>                   # Store as cross-project best practice
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

### 4. Extract Entities from Text

**Step A: Detect entities:**

```
1. Find capitalized terms (PostgreSQL, React, FastAPI)
2. Find agent names (database-engineer, backend-system-architect)
3. Find pattern names (cursor-pagination, connection-pooling)
4. Find technology keywords (pgvector, HNSW, RAG)
```

**Step B: Detect relationship patterns:**

| Pattern | Relation Type |
|---------|--------------|
| "X uses Y" | USES |
| "X recommends Y" | RECOMMENDS |
| "X requires Y" | REQUIRES |
| "X enables Y" | ENABLES |
| "X prefers Y" | PREFERS |
| "chose X over Y" | CHOSE_OVER |
| "X for Y" | USED_FOR |

### 5. Create Graph Entities (PRIMARY)

Use `mcp__memory__create_entities`:

```json
{
  "entities": [
    {
      "name": "pgvector",
      "entityType": "Technology",
      "observations": ["Used for vector search", "From remember: '{original text}'"]
    },
    {
      "name": "database-engineer",
      "entityType": "Agent",
      "observations": ["Recommends pgvector for RAG"]
    }
  ]
}
```

**Entity Type Assignment:**
- Capitalized single words ending in common suffixes: Technology (PostgreSQL, FastAPI)
- Words with hyphens matching agent pattern: Agent (database-engineer)
- Words with hyphens matching pattern names: Pattern (cursor-pagination)
- Project context: Project (current project name)
- Failed patterns: AntiPattern

### 6. Create Graph Relations

Use `mcp__memory__create_relations`:

```json
{
  "relations": [
    {
      "from": "database-engineer",
      "to": "pgvector",
      "relationType": "RECOMMENDS"
    },
    {
      "from": "pgvector",
      "to": "RAG",
      "relationType": "USED_FOR"
    }
  ]
}
```

### 7. Confirm Storage

**For success:**
```
✅ Remembered SUCCESS (category): "summary of text"
   → Stored in knowledge graph
   → Created entity: {entity_name} ({entity_type})
   → Created relation: {from} → {relation_type} → {to}
   📊 Graph: {N} entities, {M} relations
```

**For failed:**
```
❌ Remembered ANTI-PATTERN (category): "summary of text"
   → Stored in knowledge graph
   → Created entity: {anti-pattern-name} (AntiPattern)
   💡 Lesson: {lesson if extracted}
```

**For neutral:**
```
✓ Remembered (category): "summary of text"
   → Stored in knowledge graph
   → Created entity: {entity_name} ({entity_type})
   📊 Graph: {N} entities, {M} relations
```

## Examples

### Basic Remember (Graph Only)

**Input:** `/remember Cursor-based pagination scales well for large datasets`

**Output:**
```
✓ Remembered (pagination): "Cursor-based pagination scales well for large datasets"
   → Stored in knowledge graph
   → Created entity: cursor-pagination (Pattern)
   📊 Graph: 1 entity, 0 relations
```

### Anti-Pattern

**Input:** `/remember --failed Offset pagination caused timeouts on tables with 1M+ rows`

**Output:**
```
❌ Remembered ANTI-PATTERN (pagination): "Offset pagination caused timeouts on tables with 1M+ rows"
   → Stored in knowledge graph
   → Created entity: offset-pagination (AntiPattern)
   💡 Lesson: Use cursor-based pagination for large datasets
   📊 Graph: 1 entity, 0 relations
```

### Agent-Scoped Memory

**Input:** `/remember --agent backend-system-architect Use connection pooling with min=5, max=20`

**Output:**
```
✓ Remembered (database): "Use connection pooling with min=5, max=20"
   → Stored in knowledge graph
   → Created entity: connection-pooling (Pattern)
   → Created relation: project → USES → connection-pooling
   📊 Graph: 1 entity, 1 relation
   🤖 Agent: backend-system-architect
```

## Duplicate Detection

Before storing, search for similar patterns in graph:
1. Query graph with `mcp__memory__search_nodes` for entity names
2. If exact entity exists:
   - Add observation to existing entity via `mcp__memory__add_observations`
   - Inform user: "✓ Updated existing entity (added observation)"
3. If similar pattern found with opposite outcome:
   - Warn: "⚠️ This conflicts with an existing pattern. Store anyway?"

## File-Based Memory Updates

When updating `.claude/memory/MEMORY.md` or project memory files:
- **PREFER Edit over Write** to preserve existing content and avoid overwriting
- Use stable anchor lines: `## Recent Decisions`, `## Patterns`, `## Preferences`
- See the `memory` skill's "Permission-Free File Operations" section for the full Edit pattern
- This applies to the calling agent's file operations, not to the knowledge graph operations above

---

## Related Skills
- `memory` - Search, load, sync, visualize (read-side operations)

## Error Handling

- If knowledge graph unavailable, show configuration instructions
- If text is empty, ask user to provide something to remember
- If text >2000 chars, truncate with notice
- If both --success and --failed provided, ask user to clarify
- If --agent used without agent-id, prompt for agent selection
- If entity extraction fails, create a generic Decision entity
- If relation creation fails (e.g., entity doesn't exist), create entities first then retry
