---
name: recall
description: Search and retrieve decisions and patterns from knowledge graph. Use when recalling patterns, retrieving memories, finding past decisions.
context: none
version: 2.1.0
author: OrchestKit
tags: [memory, search, decisions, patterns, graph-memory, mem0, unified-memory]
user-invocable: true
allowedTools: [Read, Grep, Glob, Bash, mcp__memory__search_nodes, mcp__mem0__search_memories]
skills: [remember, memory-fabric]
---

# Recall - Search Knowledge Graph

Search past decisions and patterns from the knowledge graph with optional cloud semantic search enhancement.

## Graph-First Architecture (v2.1)

The recall skill uses **graph memory as PRIMARY** search:

1. **Knowledge Graph (PRIMARY)**: Entity and relationship search via `mcp__memory__search_nodes` - FREE, zero-config, always works
2. **Semantic Memory (mem0)**: Optional cloud search via `search-memories.py` script - requires MEM0_API_KEY, use with `--mem0` flag

**Benefits of Graph-First:**
- Zero configuration required - works out of the box
- Explicit entity and relationship queries
- Fast local search with no network latency
- No cloud dependency for basic operation
- Optional cloud enhancement with `--mem0` flag for semantic similarity search

## Overview

- Finding past architectural decisions
- Searching for recorded patterns
- Looking up project context
- Retrieving stored knowledge
- Querying cross-project best practices
- Finding entity relationships

## Usage

```
/recall <search query>
/recall --category <category> <search query>
/recall --limit <number> <search query>

# Cloud-enhanced search (v2.1.0+)
/recall --mem0 <query>                     # Search BOTH graph AND mem0 cloud
/recall --mem0 --limit 20 <query>          # More results from both systems

# Scoped search
/recall --agent <agent-id> <query>          # Filter by agent scope
/recall --global <query>                    # Search cross-project best practices
```

## Advanced Flags

| Flag | Behavior |
|------|----------|
| (default) | Search graph only |
| `--mem0` | Search BOTH graph and mem0 cloud |
| `--limit <n>` | Max results (default: 10) |
| `--category <cat>` | Filter by category |
| `--agent <agent-id>` | Filter results to a specific agent's memories |
| `--global` | Search cross-project best practices |

## Context-Aware Result Limits (CC 2.1.6)

Result limits automatically adjust based on `context_window.used_percentage`:

| Context Usage | Default Limit | Behavior |
|---------------|---------------|----------|
| 0-70% | 10 results | Full results with details |
| 70-85% | 5 results | Reduced, summarized results |
| >85% | 3 results | Minimal with "more available" hint |

## Workflow

### 1. Parse Input

```
Check for --category <category> flag
Check for --limit <number> flag
Check for --mem0 flag → search_mem0: true
Check for --agent <agent-id> flag → filter by agent_id
Check for --global flag → search global scope
Extract the search query
```

### 2. Search Knowledge Graph (PRIMARY)

Use `mcp__memory__search_nodes`:

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
- `Agent`: OrchestKit agents (database-engineer, backend-system-architect)
- `Pattern`: Named patterns (cursor-pagination, connection-pooling)
- `Decision`: Architectural decisions
- `Project`: Project-specific context
- `AntiPattern`: Failed patterns

### 3. Search mem0 (OPTIONAL - only if --mem0 flag)

**Skip if `--mem0` flag NOT set or MEM0_API_KEY not configured.**

Execute the script IN PARALLEL with step 2:

```bash
!bash skills/mem0-memory/scripts/crud/search-memories.py \
  --query "user's search query" \
  --user-id "orchestkit-{project-name}-decisions" \
  --limit 10 \
  --enable-graph
```

**User ID Selection:**
- Default: `orchestkit-{project-name}-decisions`
- With `--global`: `orchestkit-global-best-practices`

**Filter Construction:**
- Always include `user_id` filter
- With `--category`: Add `{ "metadata.category": "{category}" }` to AND array
- With `--agent`: Add `{ "agent_id": "ork:{agent-id}" }` to AND array

### 4. Merge and Deduplicate Results (if --mem0)

**Only when both systems return results:**

1. Collect results from both systems
2. For each mem0 memory, check if its text matches a graph entity observation
3. If matched, mark as `[CROSS-REF]` and merge metadata
4. Remove pure duplicates (same content from both systems)
5. Sort: graph results first, then mem0 results, cross-refs highlighted

### 5. Format Results

**Graph-Only Results (default):**
```
🔍 Found {count} results matching "{query}":

[GRAPH] {entity_name} ({entity_type})
   → {relation1} → {target1}
   → {relation2} → {target2}
   Observations: {observation1}, {observation2}

[GRAPH] {entity_name2} ({entity_type2})
   Observations: {observation}
```

**With --mem0 (combined results):**
```
🔍 Found {count} results matching "{query}":

[GRAPH] {entity_name} ({entity_type})
   → {relation} → {target}
   Observations: {observation}

[GRAPH] {entity_name2} ({entity_type2})
   Observations: {observation}

[MEM0] [{time ago}] ({category}) {memory text}

[MEM0] [{time ago}] ({category}) {memory text}

[CROSS-REF] {memory text} (linked to {N} graph entities)
   📊 Linked entities: {entity1}, {entity2}
```

**With --mem0 when MEM0_API_KEY not configured:**
```
🔍 Found {count} results matching "{query}":

[GRAPH] {entity_name} ({entity_type})
   → {relation} → {target}
   Observations: {observation}

⚠️ mem0 search requested but MEM0_API_KEY not configured (graph-only results)
```

**High Context Pressure (>85%):**
```
🔍 Found 12 matches (showing 3 due to context pressure at 87%)

[GRAPH] pgvector (Technology)
   → USED_FOR → RAG
[GRAPH] cursor-pagination (Pattern)
[GRAPH] database-engineer (Agent)
   → RECOMMENDS → pgvector

More results available. Use /recall --limit 10 to override.
```

### 6. Handle No Results

```
🔍 No results found matching "{query}"

Searched:
• Knowledge graph: 0 entities

Try:
• Broader search terms
• /remember to store new decisions
• --global flag to search cross-project best practices
• --mem0 flag to include cloud semantic search
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

### Basic Graph Search

**Input:** `/recall database`

**Output:**
```
🔍 Found 3 results matching "database":

[GRAPH] PostgreSQL (Technology)
   → CHOSEN_FOR → ACID-requirements
   → USED_WITH → pgvector
   Observations: Chosen for ACID requirements and team familiarity

[GRAPH] database-engineer (Agent)
   → RECOMMENDS → pgvector
   → RECOMMENDS → cursor-pagination
   Observations: Uses pgvector for RAG applications

[GRAPH] cursor-pagination (Pattern)
   Observations: Scales well for large datasets
```

### Category Filter

**Input:** `/recall --category architecture API`

**Output:**
```
🔍 Found 2 results matching "API" (category: architecture):

[GRAPH] api-gateway (Architecture)
   → IMPLEMENTS → rate-limiting
   → USES → JWT-authentication
   Observations: Central entry point for all services

[GRAPH] REST-API (Pattern)
   → FOLLOWS → OpenAPI-spec
   Observations: Standard for external-facing APIs
```

### Cloud-Enhanced Search

**Input:** `/recall --mem0 database`

**Output:**
```
🔍 Found 5 results matching "database":

[GRAPH] PostgreSQL (Technology)
   → CHOSEN_FOR → ACID-requirements
   Observations: Chosen for ACID requirements

[GRAPH] database-engineer (Agent)
   → RECOMMENDS → pgvector
   Observations: Uses pgvector for RAG

[MEM0] [2 days ago] (decision) PostgreSQL chosen for ACID requirements and team familiarity

[MEM0] [1 week ago] (pattern) Database connection pooling with pool_size=10, max_overflow=20

[CROSS-REF] [3 days ago] pgvector for RAG applications (linked to 2 entities)
   📊 Linked: database-engineer, pgvector
```

### Agent-Scoped Search

**Input:** `/recall --agent backend-system-architect "API patterns"`

**Output:**
```
🔍 Found 2 results from backend-system-architect:

[GRAPH] backend-system-architect (Agent)
   → RECOMMENDS → cursor-pagination
   → RECOMMENDS → repository-pattern
   Observations: Use versioned endpoints: /api/v1/, /api/v2/

[GRAPH] repository-pattern (Pattern)
   Observations: Separate controllers, services, and repositories
```

### Cross-Project Search

**Input:** `/recall --global --category pagination`

**Output:**
```
🔍 Found 3 GLOBAL best practices (pagination):

[GRAPH] cursor-pagination (Pattern)
   → SCALES_FOR → large-datasets
   → PREFERRED_OVER → offset-pagination
   Observations: From project: ecommerce, analytics, cms

[GRAPH] keyset-pagination (Pattern)
   → USED_FOR → real-time-feeds
   Observations: From project: analytics

[GRAPH] offset-pagination (AntiPattern)
   Observations: Caused timeouts on 1M+ rows
```

### Relationship Query

**Input:** `/recall what does database-engineer recommend`

**Output:**
```
🔍 Found relationships for database-engineer:

[GRAPH] database-engineer (Agent)
   → RECOMMENDS → pgvector
   → RECOMMENDS → cursor-pagination
   → RECOMMENDS → connection-pooling
   → USES → PostgreSQL
   Observations: Specialist in database architecture
```

## Related Skills
- remember: Store information for later recall

## Error Handling

- If knowledge graph unavailable, show configuration instructions
- If --mem0 requested without MEM0_API_KEY, proceed with graph-only and notify user
- If search query empty, show recent entities instead
- If no results, suggest alternatives
- If --agent used without agent-id, show available agents
- If --global returns no results, suggest storing with /remember --global
- If --mem0 returns partial results (mem0 failed), show graph results with degradation notice
