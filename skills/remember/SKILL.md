---
name: remember
description: Store decisions and patterns in semantic memory with success/failure tracking. Use when saving patterns, storing decisions, remembering approaches that worked.
context: inherit
version: 2.0.0
author: SkillForge
tags: [memory, decisions, patterns, best-practices, mem0, graph-memory, unified-memory]
user-invocable: true
---

# Remember - Store Decisions and Patterns

Store important decisions, patterns, or context in the unified memory fabric (mem0 + knowledge graph) for future sessions. Supports tracking success/failure outcomes for building a Best Practice Library.

## Dual-Write (v2.0)

The remember skill now writes to **BOTH** memory systems for comprehensive storage:

1. **Semantic Memory (mem0)**: Full-text storage via `mcp__mem0__add_memory`
2. **Knowledge Graph**: Entity and relationship creation via `mcp__memory__create_entities` and `mcp__memory__create_relations`

**Benefits of Dual-Write:**
- Semantic memory enables natural language recall with contextual matching
- Graph memory enables explicit relationship queries (e.g., "what does X use?")
- Cross-referencing links semantic memories to graph entities
- Unified recall combines results from both systems

**Automatic Entity Extraction:**
- Extracts capitalized terms as potential entities (PostgreSQL, React, pgvector)
- Detects agent names (database-engineer, backend-system-architect)
- Identifies pattern names (cursor-pagination, connection-pooling)
- Recognizes "X uses Y", "X recommends Y", "X requires Y" relationship patterns

**Graph Entity Types:**
| Pattern | Entity Type | Example |
|---------|------------|---------|
| Technology names | Technology | PostgreSQL, pgvector, React |
| Agent names | Agent | database-engineer, security-auditor |
| Pattern names | Pattern | cursor-pagination, HNSW-index |
| Project references | Project | my-app, ecommerce-backend |
| Decisions | Decision | "chose PostgreSQL over MySQL" |

## When to Use

- Recording architectural decisions
- Storing successful patterns
- Recording anti-patterns (things that failed)
- Saving project-specific context
- Building cross-project best practices library

## Usage

```
/remember <text>
/remember --category <category> <text>
/remember --success <text>     # Mark as successful pattern
/remember --failed <text>      # Mark as anti-pattern
/remember --success --category <category> <text>

# Advanced options (v1.1.0+)
/remember --graph <text>                    # Enable graph memory for relationships
/remember --agent <agent-id> <text>         # Store in agent-specific scope
/remember --global <text>                   # Store as cross-project best practice
/remember --global --success --graph <text> # Combine flags

# Dual-write options (v2.0.0+)
/remember <text>                            # Writes to BOTH mem0 AND knowledge graph (default)
/remember --no-graph <text>                 # Skip knowledge graph entity creation
/remember --mem0-only <text>                # Write only to mem0 semantic memory
```

## Advanced Flags

- `--graph` - Enable graph memory to extract entities and relationships (useful for "X uses Y" patterns)
- `--agent <agent-id>` - Scope memory to a specific agent (e.g., `database-engineer`, `backend-system-architect`)
- `--global` - Store as cross-project best practice (user_id: `skillforge-global-best-practices`)

## Dual-Write Flags (v2.0.0)

- `--no-graph` - Skip knowledge graph entity creation, only write to mem0
- `--mem0-only` - Alias for --no-graph (write only to mem0 semantic memory)

**Note:** In v2.0, the default behavior writes to BOTH systems. Use --no-graph to opt-out of entity creation.

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
Check for --graph flag → enable_graph: true (legacy, now default)
Check for --no-graph or --mem0-only flag → skip_graph: true
Check for --agent <agent-id> flag → agent_id: "skf:{agent-id}"
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

### 4. Store in mem0 (Semantic Memory)

Use `mcp__mem0__add_memory` with:

```json
{
  "user_id": "skillforge-{project-name}-decisions",
  "text": "The user's text",
  "agent_id": "skf:{agent-id}",
  "enable_graph": true,
  "metadata": {
    "category": "detected_category",
    "outcome": "success|failed|neutral",
    "timestamp": "current_datetime",
    "project": "current_project_name",
    "source": "user",
    "lesson": "extracted_lesson_if_failed"
  }
}
```

**User ID Selection:**
- Default: `skillforge-{project-name}-decisions`
- With `--global`: `skillforge-global-best-practices`
- With `--agent`: Include `agent_id` field for agent-scoped retrieval

**Optional Parameters (include when flags set):**
- `enable_graph`: true (when `--graph` flag used)
- `agent_id`: "skf:{agent-id}" (when `--agent` flag used)

### 4.5. Create Graph Entities (v2.0)

**Skip if `--no-graph` or `--mem0-only` flag is set.**

**Step A: Extract entities from text:**

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

**Step C: Create entities via `mcp__memory__create_entities`:**

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

**Step D: Create relations via `mcp__memory__create_relations`:**

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

**Entity Type Assignment:**
- Capitalized single words ending in common suffixes: Technology (PostgreSQL, FastAPI)
- Words with hyphens matching agent pattern: Agent (database-engineer)
- Words with hyphens matching pattern names: Pattern (cursor-pagination)
- Project context: Project (current project name)

### 5. Confirm Storage

**For success (v2.0 dual-write):**
```
✅ Remembered SUCCESS (category): "summary of text"
   → Stored in mem0 semantic memory
   → Created graph entity: {entity_name} ({entity_type})
   → Created relation: {from} → {relation_type} → {to}
   📊 Graph: {N} entities, {M} relations created
   🤖 Agent: {agent-id} (if --agent used)
   🌐 Scope: global (if --global used)
```

**For failed (v2.0 dual-write):**
```
❌ Remembered ANTI-PATTERN (category): "summary of text"
   → Stored in mem0 semantic memory
   → Created graph entity: {anti-pattern-name} (AntiPattern)
   💡 Lesson: {lesson if extracted}
```

**For neutral (v2.0 dual-write):**
```
✓ Remembered (category): "summary of text"
   → Stored in mem0 semantic memory
   → Created graph entity: {entity_name} ({entity_type})
   → Created relation: {from} → {relation_type} → {to}
```

**For --no-graph (mem0 only):**
```
✅ Remembered SUCCESS (category): "summary of text"
   → Stored in mem0 semantic memory
   ⚠️ Graph entity creation skipped (--no-graph)
```

## Examples

### Success Pattern (v2.0 Dual-Write)

**Input:** `/remember --success Cursor-based pagination scales well for large datasets`

**Output:**
```
✅ Remembered SUCCESS (pagination): "Cursor-based pagination scales well for large datasets"
   → Stored in mem0 semantic memory
   → Created graph entity: cursor-pagination (Pattern)
   📊 Graph: 1 entity, 0 relations created
```

### Anti-Pattern (v2.0 Dual-Write)

**Input:** `/remember --failed Offset pagination caused timeouts on tables with 1M+ rows`

**Output:**
```
❌ Remembered ANTI-PATTERN (pagination): "Offset pagination caused timeouts on tables with 1M+ rows"
   → Stored in mem0 semantic memory
   → Created graph entity: offset-pagination (AntiPattern)
   💡 Lesson: Use cursor-based pagination for large datasets
```

### Dual-Write with Relationships (v2.0)

**Input:** `/remember --success database-engineer uses pgvector for RAG applications`

**Output:**
```
✅ Remembered SUCCESS (database): "database-engineer uses pgvector for RAG applications"
   → Stored in mem0 semantic memory
   → Created graph entity: pgvector (Technology)
   → Created graph entity: database-engineer (Agent)
   → Created graph entity: RAG (Technology)
   → Created relation: database-engineer → USES → pgvector
   → Created relation: pgvector → USED_FOR → RAG
   📊 Graph: 3 entities, 2 relations created
```

### Skip Graph Creation (v2.0)

**Input:** `/remember --no-graph --success Quick note about API rate limits`

**Output:**
```
✅ Remembered SUCCESS (api): "Quick note about API rate limits"
   → Stored in mem0 semantic memory
   ⚠️ Graph entity creation skipped (--no-graph)
```

### Agent-Scoped Memory with Dual-Write

**Input:** `/remember --agent backend-system-architect Use connection pooling with min=5, max=20`

**Output:**
```
✓ Remembered (database): "Use connection pooling with min=5, max=20"
   → Stored in mem0 semantic memory
   → Created graph entity: connection-pooling (Pattern)
   → Created relation: project → USES → connection-pooling
   🤖 Agent: backend-system-architect
```

### Global Best Practice with Dual-Write

**Input:** `/remember --global --success Always validate user input at API boundaries`

**Output:**
```
✅ Remembered SUCCESS (api): "Always validate user input at API boundaries"
   → Stored in mem0 semantic memory (global scope)
   → Created graph entity: input-validation (Pattern)
   → Created relation: API → REQUIRES → input-validation
   🌐 Scope: global (available in all projects)
```

### Complex Relationship Extraction

**Input:** `/remember --success backend-system-architect recommends PostgreSQL for ACID transactions, chose it over MongoDB`

**Output:**
```
✅ Remembered SUCCESS (database): "backend-system-architect recommends PostgreSQL for ACID transactions, chose it over MongoDB"
   → Stored in mem0 semantic memory
   → Created graph entity: PostgreSQL (Technology)
   → Created graph entity: MongoDB (Technology)
   → Created graph entity: backend-system-architect (Agent)
   → Created relation: backend-system-architect → RECOMMENDS → PostgreSQL
   → Created relation: PostgreSQL → CHOSE_OVER → MongoDB
   → Created relation: PostgreSQL → USED_FOR → ACID-transactions
   📊 Graph: 3 entities, 3 relations created
```

## Duplicate Detection

Before storing, search for similar patterns:
1. Query mem0 with the text content
2. If >80% similarity found with same category and outcome:
   - Increment "occurrences" counter on existing memory
   - Inform user: "✓ Updated existing pattern (now seen in X projects)"
3. If similar pattern found with opposite outcome:
   - Warn: "⚠️ This conflicts with an existing pattern. Store anyway?"


## Related Skills
- recall: Retrieve stored information

## Error Handling

- If mem0 unavailable, inform user to check MCP configuration
- If knowledge graph unavailable, proceed with mem0-only write and notify user
- If both systems unavailable, show configuration instructions
- If text is empty, ask user to provide something to remember
- If text >2000 chars, truncate with notice
- If both --success and --failed provided, ask user to clarify
- If --agent used without agent-id, prompt for agent selection
- If entity extraction fails, proceed with mem0 write and warn about graph failure
- If relation creation fails (e.g., entity doesn't exist), create entities first then retry