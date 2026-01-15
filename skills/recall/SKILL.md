---
name: recall
description: Search and retrieve decisions and patterns from semantic memory. Use when recalling patterns, retrieving memories, finding past decisions.
context: inherit
version: 1.1.0
author: SkillForge
tags: [memory, search, decisions, patterns, mem0, graph-memory]
---

# Recall - Search Semantic Memory

Search past decisions and patterns stored in mem0.

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
```

## Options

- `--category <category>` - Filter by category (decision, architecture, pattern, blocker, constraint, preference, pagination, database, authentication, api, frontend, performance)
- `--limit <number>` - Maximum results to return (default: 10)

## Advanced Flags

- `--graph` - Enable graph search to find related entities and relationships
- `--agent <agent-id>` - Filter results to a specific agent's memories (e.g., `database-engineer`)
- `--global` - Search cross-project best practices instead of project-specific memories

## Workflow

### 1. Parse Input

```
Check for --category <category> flag
Check for --limit <number> flag
Check for --graph flag → enable_graph: true
Check for --agent <agent-id> flag → filter by agent_id
Check for --global flag → search global user_id
Extract the search query
```

### 2. Search mem0

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

### 3. Format Results

**Standard Results:**
```
🔍 Found {count} memories matching "{query}":

1. [{time ago}] ({category}) {memory text}

2. [{time ago}] ({category}) {memory text}
```

**With Graph Relationships (when --graph used):**
```
🔍 Found {count} memories matching "{query}":

1. [{time ago}] ({category}) {memory text}
   📊 Related: {entity1} → {relation} → {entity2}

2. [{time ago}] ({category}) {memory text}
   📊 Related: {entity1} → {relation} → {entity2}
```

### 4. Handle No Results

```
🔍 No memories found matching "{query}"

Try:
• Broader search terms
• /remember to store new decisions
• --global flag to search cross-project best practices
• Check if mem0 is configured correctly
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

### Cross-Project Search (New)

**Input:** `/recall --global --category pagination`

**Output:**
```
🔍 Found 4 GLOBAL best practices (pagination):

1. [Project: ecommerce] (pagination) Cursor-based pagination scales better than offset for large datasets

2. [Project: analytics] (pagination) Use keyset pagination for real-time feeds

3. [Project: cms] (pagination) Cache page counts separately - they're expensive to compute

4. [Project: api-gateway] (pagination) Always return next_cursor even if empty to signal end
```


## Related Skills
- remember: Store information for later recall

## Error Handling

- If mem0 unavailable, inform user to check MCP configuration
- If search query empty, show recent memories instead
- If no results, suggest alternatives
- If --agent used without agent-id, show available agents
- If --global returns no results, suggest storing with /remember --global