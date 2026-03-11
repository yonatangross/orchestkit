---
title: Search graph for existing entities before creating new ones to prevent duplicates
impact: HIGH
impactDescription: "Duplicate entities fragment the knowledge graph, making search unreliable and relationships inconsistent"
tags: deduplication, graph, entities, search, merge
---

## Problem

Creating entities without checking for existing ones leads to duplicate nodes in the knowledge graph. For example, "PostgreSQL", "postgres", and "Postgres" all become separate entities with separate relationships, splitting knowledge across fragments that are never linked.

## Rule

Before calling `mcp__memory__create_entities`, always call `mcp__memory__search_nodes` with the entity name. If a match shares 80%+ name similarity AND the same entity type, merge by adding observations to the existing entity instead of creating a new one.

### Detection Criteria

```
1. Normalize: lowercase, strip hyphens/underscores
2. Compare: Levenshtein distance or substring match
3. Match threshold: >= 80% similarity AND same entityType
4. Action: merge via add_observations if match found
```

### Incorrect -- creating without search:

```json
// User says: "/remember PostgreSQL handles our vector search"
// Agent immediately creates without checking:
mcp__memory__create_entities({
  "entities": [{
    "name": "PostgreSQL",
    "entityType": "Technology",
    "observations": ["Handles vector search"]
  }]
})
// Graph already had "postgres" (Technology) with 5 observations
// Now there are TWO entities for the same technology
```

### Correct -- search first, merge if found:

```json
// Step 1: Search for existing entity
mcp__memory__search_nodes({ "query": "PostgreSQL" })
// Returns: { "name": "postgres", "entityType": "Technology", "observations": [...] }

// Step 2: 80%+ match found ("postgresql" vs "postgres") — merge
mcp__memory__add_observations({
  "observations": [{
    "entityName": "postgres",
    "contents": ["Handles vector search"]
  }]
})
// Single entity with all observations consolidated
```

### Edge Cases

- **Different entity types**: "react" (Technology) vs "react" (Pattern) are distinct -- do not merge
- **Abbreviations**: "DB" vs "Database" -- treat as match only when context confirms same entity
- **Versioned names**: "React 18" vs "React" -- merge into parent entity, add version as observation

### Key Rules

- Always search before create -- no exceptions
- Normalize names (lowercase, strip punctuation) before comparison
- Same name + same type at 80%+ similarity = merge via `add_observations`
- Different entity types with same name are distinct entities
- Inform user when merging: "Updated existing entity (added observation)"
