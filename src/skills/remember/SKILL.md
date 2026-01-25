---
name: remember
description: Store decisions and patterns in knowledge graph with optional cloud sync. Use when saving patterns, storing decisions, remembering approaches that worked.
context: none
version: 2.1.0
author: OrchestKit
tags: [memory, decisions, patterns, best-practices, graph-memory, mem0, unified-memory]
user-invocable: true
allowedTools: [Read, Grep, Glob, Bash, mcp__memory__create_entities, mcp__memory__create_relations, mcp__memory__add_observations, mcp__memory__search_nodes]
skills: [recall, memory-fabric]
---

# Remember - Store Decisions and Patterns

Store important decisions, patterns, or context in the knowledge graph for future sessions. Supports tracking success/failure outcomes for building a Best Practice Library.

## Graph-First Architecture (v2.1)

The remember skill uses **graph memory as PRIMARY** storage:

1. **Knowledge Graph (PRIMARY)**: Entity and relationship storage via `mcp__memory__create_entities` and `mcp__memory__create_relations` - FREE, zero-config, always works
2. **Semantic Memory (mem0)**: Optional cloud storage via `add-memory.py` script - requires MEM0_API_KEY

**Benefits of Graph-First:**
- Zero configuration required - works out of the box
- Explicit relationship queries (e.g., "what does X use?")
- Cross-referencing between entities
- No cloud dependency for basic operation
- Optional cloud enhancement with `--mem0` flag

**Automatic Entity Extraction:**
- Extracts capitalized terms as potential entities (PostgreSQL, React, pgvector)
- Detects agent names (database-engineer, backend-system-architect)
- Identifies pattern names (cursor-pagination, connection-pooling)
- Recognizes "X uses Y", "X recommends Y", "X requires Y" relationship patterns

## Usage

```
/remember <text>
/remember --category <category> <text>
/remember --success <text>     # Mark as successful pattern
/remember --failed <text>      # Mark as anti-pattern
/remember --success --category <category> <text>

# Cloud sync (v2.1.0+)
/remember --mem0 <text>                    # Write to BOTH graph AND mem0 cloud
/remember --mem0 --success <text>          # Success pattern synced to cloud

# Agent-scoped memory
/remember --agent <agent-id> <text>         # Store in agent-specific scope
/remember --global <text>                   # Store as cross-project best practice
```

## Flags

| Flag | Behavior |
|------|----------|
| (default) | Write to graph only |
| `--mem0` | Write to BOTH graph and mem0 cloud |
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
Check for --mem0 flag → sync_to_mem0: true
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

### 7. Store in mem0 (OPTIONAL - only if --mem0 flag)

**Skip if `--mem0` flag NOT set or MEM0_API_KEY not configured.**

Execute the script:

```bash
!bash skills/mem0-memory/scripts/crud/add-memory.py \
  --text "The user's text" \
  --user-id "orchestkit-{project-name}-decisions" \
  --agent-id "ork:{agent-id}" \
  --metadata '{"category":"detected_category","outcome":"success|failed|neutral","timestamp":"current_datetime","project":"current_project_name","source":"user","lesson":"extracted_lesson_if_failed"}' \
  --enable-graph
```

**User ID Selection:**
- Default: `orchestkit-{project-name}-decisions`
- With `--global`: `orchestkit-global-best-practices`
- With `--agent`: Include `agent_id` field for agent-scoped retrieval

### 8. Confirm Storage

**For success (graph-first):**
```
✅ Remembered SUCCESS (category): "summary of text"
   → Stored in knowledge graph
   → Created entity: {entity_name} ({entity_type})
   → Created relation: {from} → {relation_type} → {to}
   📊 Graph: {N} entities, {M} relations
   [If --mem0]: → Also synced to mem0 cloud
```

**For failed (graph-first):**
```
❌ Remembered ANTI-PATTERN (category): "summary of text"
   → Stored in knowledge graph
   → Created entity: {anti-pattern-name} (AntiPattern)
   💡 Lesson: {lesson if extracted}
   [If --mem0]: → Also synced to mem0 cloud
```

**For neutral (graph-first):**
```
✓ Remembered (category): "summary of text"
   → Stored in knowledge graph
   → Created entity: {entity_name} ({entity_type})
   📊 Graph: {N} entities, {M} relations
```

**For --mem0 when MEM0_API_KEY not configured:**
```
✅ Remembered SUCCESS (category): "summary of text"
   → Stored in knowledge graph
   → Created entity: {entity_name} ({entity_type})
   📊 Graph: {N} entities, {M} relations
   ⚠️ mem0 sync requested but MEM0_API_KEY not configured (graph-only)
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

### Success Pattern with Cloud Sync

**Input:** `/remember --mem0 --success database-engineer uses pgvector for RAG applications`

**Output:**
```
✅ Remembered SUCCESS (database): "database-engineer uses pgvector for RAG applications"
   → Stored in knowledge graph
   → Created entity: pgvector (Technology)
   → Created entity: database-engineer (Agent)
   → Created entity: RAG (Technology)
   → Created relation: database-engineer → USES → pgvector
   → Created relation: pgvector → USED_FOR → RAG
   📊 Graph: 3 entities, 2 relations
   → Also synced to mem0 cloud
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

### Global Best Practice with Cloud Sync

**Input:** `/remember --global --mem0 --success Always validate user input at API boundaries`

**Output:**
```
✅ Remembered SUCCESS (api): "Always validate user input at API boundaries"
   → Stored in knowledge graph
   → Created entity: input-validation (Pattern)
   → Created relation: API → REQUIRES → input-validation
   📊 Graph: 1 entity, 1 relation
   🌐 Scope: global (available in all projects)
   → Also synced to mem0 cloud (global scope)
```

## Duplicate Detection

Before storing, search for similar patterns in graph:
1. Query graph with `mcp__memory__search_nodes` for entity names
2. If exact entity exists:
   - Add observation to existing entity via `mcp__memory__add_observations`
   - Inform user: "✓ Updated existing entity (added observation)"
3. If similar pattern found with opposite outcome:
   - Warn: "⚠️ This conflicts with an existing pattern. Store anyway?"

## Related Skills
- recall: Retrieve stored information

## Error Handling

- If knowledge graph unavailable, show configuration instructions
- If --mem0 requested without MEM0_API_KEY, proceed with graph-only and notify user
- If text is empty, ask user to provide something to remember
- If text >2000 chars, truncate with notice
- If both --success and --failed provided, ask user to clarify
- If --agent used without agent-id, prompt for agent selection
- If entity extraction fails, create a generic Decision entity
- If relation creation fails (e.g., entity doesn't exist), create entities first then retry
