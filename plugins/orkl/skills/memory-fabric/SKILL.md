---
name: memory-fabric
license: MIT
compatibility: "Claude Code 2.1.34+. Requires memory MCP server."
description: Knowledge graph memory orchestration - entity extraction, query parsing, deduplication, and cross-reference boosting. Use when designing memory orchestration.
context: inherit
version: 2.1.0
author: OrchestKit
tags: [memory, orchestration, graph-first, graph, unified-search, deduplication, cross-reference]
user-invocable: false
allowed-tools: [Read, Bash, mcp__memory__search_nodes]
complexity: high
metadata:
  category: mcp-enhancement
  mcp-server: memory
---

# Memory Fabric - Graph Orchestration

Knowledge graph orchestration via mcp__memory__* for entity extraction, query parsing, deduplication, and cross-reference boosting.

## Overview

- Comprehensive memory retrieval from the knowledge graph
- Cross-referencing entities within graph storage
- Ensuring no relevant memories are missed
- Building unified context from graph queries

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
│   │            Graph Query Dispatch              │          │
│   └──────────────────────┬───────────────────────┘          │
│                          │                                  │
│                ┌─────────▼──────────┐                       │
│                │  mcp__memory__*    │                       │
│                │  (Knowledge Graph) │                       │
│                └─────────┬──────────┘                       │
│                          │                                  │
│                          ▼                                  │
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

### Step 2: Execute Graph Query

**Query Graph (entity search):**

```javascript
mcp__memory__search_nodes({
  query: "pagination database-engineer"
})
```

### Step 3: Normalize Results

Transform results to common format:

```json
{
  "id": "graph:original_id",
  "text": "content text",
  "source": "graph",
  "timestamp": "ISO8601",
  "relevance": 0.0-1.0,
  "entities": ["entity1", "entity2"],
  "metadata": {}
}
```

### Step 4: Deduplicate (>85% Similarity)

When two results have >85% text similarity:

1. Keep the one with higher relevance score
2. Merge metadata
3. Mark as "cross-validated" for authority boost

### Step 5: Cross-Reference Boost

If a result mentions an entity that exists elsewhere in the graph:

- Boost relevance score by 1.2x
- Add graph relationships to result metadata

### Step 6: Final Ranking

Score = `recency_factor × relevance × source_authority`


| Factor           | Weight | Description                                 |
| ---------------- | ------ | ------------------------------------------- |
| recency          | 0.3    | Newer memories rank higher                  |
| relevance        | 0.5    | Semantic match quality                      |
| source_authority | 0.2    | Graph entities boost, cross-validated boost |


## Result Format

```json
{
  "query": "original query",
  "total_results": 4,
  "sources": {
    "graph": 4
  },
  "results": [
    {
      "id": "graph:cursor-pagination",
      "text": "Use cursor-based pagination for scalability",
      "score": 0.92,
      "source": "graph",
      "timestamp": "2026-01-15T10:00:00Z",
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

## Graph Relationship Traversal

Memory Fabric supports multi-hop graph traversal for complex relationship queries.

### Example: Multi-Hop Query

```
Query: "What did database-engineer recommend about pagination?"

1. Search for "database-engineer pagination"
   → Find entity: "database-engineer recommends cursor-pagination"

2. Traverse related entities (depth 2)
   → Traverse: database-engineer → recommends → cursor-pagination
   → Find: "cursor-pagination uses offset-based approach"

3. Return results with relationship context
```

### Integration with Graph Memory

Memory Fabric uses the knowledge graph for entity relationships:

1. **Graph search** via `mcp__memory__search_nodes` finds matching entities
2. **Graph traversal** expands context via entity relationships
3. **Cross-reference** boosts relevance when entities match

## Integration Points

### With memory Skill

When memory search runs, it can optionally use Memory Fabric for unified results.

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

**Required:** Knowledge graph MCP server:

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

## Error Handling


| Scenario           | Behavior                          |
| ------------------ | --------------------------------- |
| graph unavailable  | Error - graph is required         |
| Query empty        | Return recent memories from graph |


## Related Skills

- `memory` - User-facing memory operations (search, load, sync, viz)
- `remember` - User-facing memory storage
- `caching` - Caching layer that can use fabric

## Key Decisions


| Decision         | Choice      | Rationale                                          |
| ---------------- | ----------- | -------------------------------------------------- |
| Dedup threshold  | 85%         | Balances catching duplicates vs. preserving nuance |
| Parallel queries | Always      | Reduces latency, both sources are independent      |
| Cross-ref boost  | 1.2x        | Validated info more trustworthy but not dominant   |
| Ranking weights  | 0.3/0.5/0.2 | Relevance most important, recency secondary        |


