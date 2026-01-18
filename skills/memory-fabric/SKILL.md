---
name: memory-fabric
description: Graph-first memory orchestration - knowledge graph (PRIMARY, always available) with optional mem0 cloud enhancement for semantic search.
context: inherit
version: 2.1.0
author: SkillForge
tags: [memory, orchestration, graph-first, graph, mem0, unified-search, deduplication, cross-reference]
user-invocable: false
---

# Memory Fabric - Graph-First Orchestration

Graph-first architecture: mcp__memory__* (knowledge graph) is PRIMARY and always available. mcp__mem0__* (semantic cloud) is an OPTIONAL enhancement for semantic search when configured.

## When to Use

- Comprehensive memory retrieval across both systems
- Cross-referencing entities between semantic and graph storage
- Ensuring no relevant memories are missed from either source
- Building unified context from heterogeneous memory stores

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory Fabric Layer                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐              ┌─────────────┐              │
│   │   Query     │              │   Query     │              │
│   │   Parser    │              │   Executor  │              │
│   └──────┬──────┘              └──────┬──────┘              │
│          │                            │                     │
│          ▼                            ▼                     │
│   ┌──────────────────────────────────────────────┐          │
│   │           Parallel Query Dispatch            │          │
│   └──────────────┬───────────────────┬───────────┘          │
│                  │                   │                      │
│        ┌─────────▼─────────┐  ┌──────▼──────────┐           │
│        │  mcp__mem0__*     │  │  mcp__memory__* │           │
│        │  (Semantic Cloud) │  │  (Local Graph)  │           │
│        └─────────┬─────────┘  └──────┬──────────┘           │
│                  │                   │                      │
│                  ▼                   ▼                      │
│        ┌─────────────────────────────────────────┐          │
│        │        Result Normalizer                │          │
│        └─────────────────────┬───────────────────┘          │
│                              │                              │
│                              ▼                              │
│        ┌─────────────────────────────────────────┐          │
│        │     Deduplication Engine (>85% sim)     │          │
│        └─────────────────────┬───────────────────┘          │
│                              │                              │
│                              ▼                              │
│        ┌─────────────────────────────────────────┐          │
│        │  Cross-Reference Booster                │          │
│        │  (mem0 mentions graph entity → boost)   │          │
│        └─────────────────────┬───────────────────┘          │
│                              │                              │
│                              ▼                              │
│        ┌─────────────────────────────────────────┐          │
│        │  Final Ranking: recency × relevance     │          │
│        │                 × source_authority      │          │
│        └─────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Unified Search Workflow

### Step 1: Parse Query

Extract search intent and entity hints from natural language:

```
Input: "What pagination approach did database-engineer recommend?"

Parsed:
- query: "pagination approach recommend"
- entity_hints: ["database-engineer", "pagination"]
- intent: "decision" or "pattern"
```

### Step 2: Execute Parallel Queries

**Query Mem0 (semantic search):**
```javascript
mcp__mem0__search_memories({
  query: "pagination approach recommend",
  filters: {
    AND: [
      { user_id: "{project}-decisions" }
    ]
  },
  limit: 10,
  enable_graph: true
})
```

**Query Graph (entity search):**
```javascript
mcp__memory__search_nodes({
  query: "pagination database-engineer"
})
```

### Step 3: Normalize Results

Transform both sources to common format:

```json
{
  "id": "source:original_id",
  "text": "content text",
  "source": "mem0" | "graph",
  "timestamp": "ISO8601",
  "relevance": 0.0-1.0,
  "entities": ["entity1", "entity2"],
  "metadata": {}
}
```

### Step 4: Deduplicate (>85% Similarity)

When two results have >85% text similarity:
1. Keep the one with higher relevance score
2. Merge metadata from both sources
3. Mark as "cross-validated" for authority boost

### Step 5: Cross-Reference Boost

If mem0 result mentions an entity that exists in graph:
- Boost relevance score by 1.2x
- Add graph relationships to result metadata

### Step 6: Final Ranking

Score = `recency_factor × relevance × source_authority`

| Factor | Weight | Description |
|--------|--------|-------------|
| recency | 0.3 | Newer memories rank higher |
| relevance | 0.5 | Semantic match quality |
| source_authority | 0.2 | Graph entities boost, cross-validated boost |

## Result Format

```json
{
  "query": "original query",
  "total_results": 8,
  "sources": {
    "mem0": 5,
    "graph": 4,
    "merged": 1
  },
  "results": [
    {
      "id": "mem0:abc123",
      "text": "Use cursor-based pagination for scalability",
      "score": 0.92,
      "source": "mem0",
      "timestamp": "2026-01-15T10:00:00Z",
      "cross_validated": true,
      "entities": ["cursor-pagination", "database-engineer"],
      "graph_relations": [
        { "from": "database-engineer", "relation": "recommends", "to": "cursor-pagination" }
      ]
    }
  ]
}
```

## Entity Extraction

Memory Fabric extracts entities from natural language for graph storage:

```
Input: "database-engineer uses pgvector for RAG applications"

Extracted:
- Entities:
  - { name: "database-engineer", type: "agent" }
  - { name: "pgvector", type: "technology" }
  - { name: "RAG", type: "pattern" }
- Relations:
  - { from: "database-engineer", relation: "uses", to: "pgvector" }
  - { from: "pgvector", relation: "used_for", to: "RAG" }
```

See `references/entity-extraction.md` for detailed extraction patterns.

## Integration Points

### With mem0-memory Skill
Memory Fabric sits above mem0-memory, adding graph cross-referencing.

### With recall Skill
When recall searches, it can optionally use Memory Fabric for unified results.

### With Hooks
- `prompt/memory-fabric-context.sh` - Inject unified context at session start
- `stop/memory-fabric-sync.sh` - Sync entities to graph at session end

## Configuration

```bash
# Environment variables
MEMORY_FABRIC_DEDUP_THRESHOLD=0.85    # Similarity threshold for merging
MEMORY_FABRIC_BOOST_FACTOR=1.2        # Cross-reference boost multiplier
MEMORY_FABRIC_MAX_RESULTS=20          # Max results per source
```

## MCP Requirements

**Required (PRIMARY):** Knowledge graph MCP server:
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@anthropic/memory-mcp-server"]
    }
  }
}
```

**Optional (ENHANCEMENT):** Mem0 cloud for semantic search:
```json
{
  "mcpServers": {
    "mem0": {
      "command": "npx",
      "args": ["-y", "@mem0/mcp-server"],
      "env": { "MEM0_API_KEY": "your-key" }
    }
  }
}
```

## Error Handling (Graph-First)

| Scenario | Behavior |
|----------|----------|
| mem0 unavailable | Use graph-only (fully functional) |
| graph unavailable | Error - graph is required |
| --mem0 flag without MEM0_API_KEY | Graph storage succeeds, warn about mem0 |
| Query empty | Return recent memories from graph |

## Related Skills

- `mem0-memory` - Direct mem0 operations
- `recall` - User-facing memory search
- `remember` - User-facing memory storage
- `semantic-caching` - Caching layer that can use fabric

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dedup threshold | 85% | Balances catching duplicates vs. preserving nuance |
| Parallel queries | Always | Reduces latency, both sources are independent |
| Cross-ref boost | 1.2x | Validated info more trustworthy but not dominant |
| Ranking weights | 0.3/0.5/0.2 | Relevance most important, recency secondary |
