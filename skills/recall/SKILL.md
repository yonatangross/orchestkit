---
name: recall
description: Search and retrieve decisions and patterns from semantic memory. Use when recalling patterns, retrieving memories, finding past decisions.
context: inherit
version: 2.0.0
author: SkillForge
tags: [memory, search, decisions, patterns, mem0, graph-memory, unified-memory]
user-invocable: true
---

# Recall - Search Unified Memory Fabric

Search past decisions and patterns across the unified memory fabric (mem0 semantic + knowledge graph).

## Unified Search (v2.0)

The recall skill now queries **BOTH** memory systems in parallel for comprehensive results:

1. **Semantic Memory (mem0)**: Full-text semantic search via `mcp__mem0__search_memories`
2. **Knowledge Graph**: Entity and relationship search via `mcp__memory__search_nodes`

**Benefits of Unified Search:**
- Semantic search finds contextually similar memories even with different wording
- Graph search finds explicit entity relationships and connections
- Cross-referencing links semantic memories to graph entities
- Deduplication prevents showing the same information twice

**Result Merging Strategy:**
1. Query both systems in parallel
2. Deduplicate by matching memory text to entity observations
3. Cross-reference: If a mem0 result mentions an entity found in graph, mark as linked
4. Sort by relevance (semantic score) then recency

## When to Use

- Finding past architectural decisions
- Searching for recorded patterns
- Looking up project context
- Retrieving stored knowledge
- Querying cross-project best practices

## Usage

```
/recall <search query>
/recall --category <category> <search query>
/recall --limit <number> <search query>

# Advanced options (v1.1.0+)
/recall --graph <query>                     # Search with graph relationships
/recall --agent <agent-id> <query>          # Filter by agent scope
/recall --global <query>                    # Search cross-project best practices
/recall --global --category pagination      # Combine flags

# Unified search options (v2.0.0+)
/recall --unified <query>                   # Query both mem0 AND knowledge graph (default)
/recall --mem0-only <query>                 # Query only mem0 semantic memory
/recall --graph-only <query>                # Query only knowledge graph
```

## Options

- `--category <category>` - Filter by category (decision, architecture, pattern, blocker, constraint, preference, pagination, database, authentication, api, frontend, performance)
- `--limit <number>` - Maximum results to return (default: 10)

## Advanced Flags

- `--graph` - Enable graph search to find related entities and relationships
- `--agent <agent-id>` - Filter results to a specific agent's memories (e.g., `database-engineer`)
- `--global` - Search cross-project best practices instead of project-specific memories

## Unified Search Flags (v2.0.0)

- `--unified` - Query both mem0 AND knowledge graph (default behavior in v2.0)
- `--mem0-only` - Query only mem0 semantic memory, skip knowledge graph
- `--graph-only` - Query only knowledge graph, skip mem0

## Context-Aware Result Limits (CC 2.1.6)

Result limits automatically adjust based on `context_window.used_percentage`:

| Context Usage | Default Limit | Behavior |
|---------------|---------------|----------|
| 0-70% | 10 results | Full results with details |
| 70-85% | 5 results | Reduced, summarized results |
| >85% | 3 results | Minimal with "more available" hint |

**Example output at high context:**
```
[Recall] Found 12 matches (showing 3 due to context pressure at 87%)

1. [MEM0] Use cursor-based pagination...
2. [GRAPH] pgvector -> RECOMMENDS -> cosine_similarity
3. [MEM0+GRAPH] FastAPI async preferred for I/O bound operations

More results available. Use /recall --limit 10 to override.
```

## Workflow

### 1. Parse Input

```
Check for --category <category> flag
Check for --limit <number> flag
Check for --graph flag → enable_graph: true
Check for --agent <agent-id> flag → filter by agent_id
Check for --global flag → search global user_id
Check for --unified flag → query both systems (default in v2.0)
Check for --mem0-only flag → skip knowledge graph
Check for --graph-only flag → skip mem0
Extract the search query
```

### 2. Search mem0 (Semantic Memory)

**Skip if `--graph-only` flag is set.**

Use `mcp__mem0__search_memories` with:

```json
{
  "query": "user's search query",
  "filters": {
    "AND": [
      { "user_id": "skillforge-{project-name}-decisions" }
    ]
  },
  "limit": 10,
  "enable_graph": false
}
```

**User ID Selection:**
- Default: `skillforge-{project-name}-decisions`
- With `--global`: `skillforge-global-best-practices`

**Filter Construction:**
- Always include `user_id` filter
- With `--category`: Add `{ "metadata.category": "{category}" }` to AND array
- With `--agent`: Add `{ "agent_id": "skf:{agent-id}" }` to AND array

**Example with category and agent filters:**
```json
{
  "query": "pagination patterns",
  "filters": {
    "AND": [
      { "user_id": "skillforge-myproject-decisions" },
      { "metadata.category": "pagination" },
      { "agent_id": "skf:database-engineer" }
    ]
  },
  "limit": 10,
  "enable_graph": true
}
```

### 2.5. Search Knowledge Graph (v2.0)

**Skip if `--mem0-only` flag is set.**

Use `mcp__memory__search_nodes` IN PARALLEL with step 2:

```json
{
  "query": "user's search query"
}
```

**Knowledge Graph Search:**
- Searches entity names, types, and observations
- Returns entities with their relationships
- Finds patterns like "X uses Y", "X recommends Y"

**Entity Types to Look For:**
- `Technology`: Tools, frameworks, databases (pgvector, PostgreSQL, React)
- `Agent`: SkillForge agents (database-engineer, backend-system-architect)
- `Pattern`: Named patterns (cursor-pagination, connection-pooling)
- `Decision`: Architectural decisions
- `Project`: Project-specific context

### 3. Merge and Deduplicate Results

**Deduplication Strategy:**
1. Collect results from both systems
2. For each mem0 memory, check if its text matches a graph entity observation
3. If matched, mark as `[MEM0+GRAPH]` and merge metadata
4. Remove pure duplicates (same content from both systems)
5. Sort: linked results first, then by relevance score, then by recency

**Cross-Reference Linking:**
- If mem0 memory mentions an entity found in graph, add relationship info
- If graph entity has observations matching mem0 memory, link them
- Track which entities are mentioned in which memories

### 4. Format Unified Results

**Unified Results (default in v2.0):**
```
🔍 Found {count} results matching "{query}" (unified search):

[MEM0] [{time ago}] ({category}) {memory text}
[MEM0] [{time ago}] ({category}) {memory text}
[GRAPH] {entity1} → {relation} → {entity2}
[GRAPH] {entity1} → {relation} → {entity2}
[MEM0+GRAPH] {memory text} (linked to {N} entities)
```

**Standard Results (--mem0-only):**
```
🔍 Found {count} memories matching "{query}":

1. [{time ago}] ({category}) {memory text}

2. [{time ago}] ({category}) {memory text}
```

**Graph-Only Results (--graph-only):**
```
🔍 Found {count} entities matching "{query}":

1. {entity_name} ({entity_type})
   → {relation1} → {target1}
   → {relation2} → {target2}
   Observations: {observation1}, {observation2}

2. {entity_name} ({entity_type})
   → {relation} → {target}
```

**With Graph Relationships (when --graph used with mem0):**
```
🔍 Found {count} memories matching "{query}":

1. [{time ago}] ({category}) {memory text}
   📊 Related: {entity1} → {relation} → {entity2}

2. [{time ago}] ({category}) {memory text}
   📊 Related: {entity1} → {relation} → {entity2}
```

### 5. Handle No Results

```
🔍 No results found matching "{query}" in unified memory

Searched:
• mem0 semantic memory: 0 results
• Knowledge graph: 0 entities

Try:
• Broader search terms
• /remember to store new decisions
• --global flag to search cross-project best practices
• --mem0-only or --graph-only to search a single system
• Check if mem0 and memory MCP servers are configured
```

## Time Formatting

| Duration | Display |
|----------|---------|
| < 1 day | "today" |
| 1 day | "yesterday" |
| 2-7 days | "X days ago" |
| 1-4 weeks | "X weeks ago" |
| > 4 weeks | "X months ago" |

## Examples

### Basic Search

**Input:** `/recall database`

**Output:**
```
🔍 Found 3 memories matching "database":

1. [2 days ago] (decision) PostgreSQL chosen for ACID requirements and team familiarity

2. [1 week ago] (pattern) Database connection pooling with pool_size=10, max_overflow=20

3. [2 weeks ago] (architecture) Using pgvector extension for vector similarity search
```

### Category Filter

**Input:** `/recall --category architecture API`

**Output:**
```
🔍 Found 2 memories matching "API" (category: architecture):

1. [3 days ago] (architecture) Layered API architecture with controllers, services, repositories

2. [1 week ago] (architecture) API versioning using /api/v1 prefix in URL path
```

### Limited Results

**Input:** `/recall --limit 5 auth`

**Output:**
```
🔍 Found 5 memories matching "auth":

1. [1 day ago] (decision) JWT authentication with 24h expiry for access tokens

2. [3 days ago] (pattern) Refresh tokens stored in httpOnly cookies

3. [1 week ago] (architecture) Auth middleware in src/auth/middleware.py

4. [1 week ago] (constraint) Must support OAuth2 for enterprise customers

5. [2 weeks ago] (blocker) Auth tokens not refreshing properly - fixed by adding token rotation
```

### Graph Search (New)

**Input:** `/recall --graph "what does database-engineer recommend for vectors?"`

**Output:**
```
🔍 Found 2 memories with relationships:

1. [3 days ago] (database) database-engineer uses pgvector for RAG applications
   📊 Related: database-engineer → recommends → pgvector
   📊 Related: pgvector → used_for → RAG

2. [1 week ago] (performance) pgvector requires HNSW index for >100k vectors
   📊 Related: pgvector → requires → HNSW index
```

### Agent-Scoped Search (New)

**Input:** `/recall --agent backend-system-architect "API patterns"`

**Output:**
```
🔍 Found 2 memories from backend-system-architect:

1. [2 days ago] (api) Use versioned endpoints: /api/v1/, /api/v2/

2. [1 week ago] (architecture) Separate controllers, services, and repositories
```

### Cross-Project Search

**Input:** `/recall --global --category pagination`

**Output:**
```
🔍 Found 4 GLOBAL best practices (pagination):

1. [Project: ecommerce] (pagination) Cursor-based pagination scales better than offset for large datasets

2. [Project: analytics] (pagination) Use keyset pagination for real-time feeds

3. [Project: cms] (pagination) Cache page counts separately - they're expensive to compute

4. [Project: api-gateway] (pagination) Always return next_cursor even if empty to signal end
```

### Unified Search (v2.0)

**Input:** `/recall database`

**Output:**
```
🔍 Found 5 results matching "database" (unified search):

[MEM0] [2 days ago] (decision) PostgreSQL chosen for ACID requirements
[MEM0] [1 week ago] (pattern) Connection pooling with pool_size=10
[GRAPH] database-engineer → RECOMMENDS → pgvector
[GRAPH] PostgreSQL → ENABLES → vector-search
[MEM0+GRAPH] pgvector for RAG (linked to 3 entities)
```

### Unified Search with Cross-References

**Input:** `/recall --unified "what technology does database-engineer recommend?"`

**Output:**
```
🔍 Found 4 results matching "what technology does database-engineer recommend?" (unified search):

[MEM0+GRAPH] [3 days ago] (database) database-engineer uses pgvector for RAG applications
   📊 Linked entities: database-engineer, pgvector, RAG
   📊 Relations: database-engineer → RECOMMENDS → pgvector, pgvector → USED_FOR → RAG

[GRAPH] database-engineer (Agent)
   → RECOMMENDS → pgvector
   → RECOMMENDS → PostgreSQL
   → PREFERS → cursor-pagination

[MEM0] [1 week ago] (performance) pgvector requires HNSW index for >100k vectors

[GRAPH] pgvector (Technology)
   → REQUIRES → HNSW-index
   → ENABLES → vector-search
```

### Graph-Only Search

**Input:** `/recall --graph-only pgvector`

**Output:**
```
🔍 Found 2 entities matching "pgvector":

1. pgvector (Technology)
   → USED_FOR → RAG
   → USED_FOR → vector-search
   → REQUIRES → HNSW-index
   → RECOMMENDED_BY → database-engineer
   Observations: "Extension for PostgreSQL", "Supports cosine similarity"

2. database-engineer (Agent)
   → RECOMMENDS → pgvector
   Observations: "Uses pgvector for RAG applications"
```


## Related Skills
- remember: Store information for later recall

## Error Handling

- If mem0 unavailable, inform user to check MCP configuration
- If knowledge graph unavailable, fall back to mem0-only search with notice
- If both systems unavailable, show configuration instructions
- If search query empty, show recent memories instead
- If no results, suggest alternatives
- If --agent used without agent-id, show available agents
- If --global returns no results, suggest storing with /remember --global
- If --unified returns partial results (one system failed), show results with degradation notice