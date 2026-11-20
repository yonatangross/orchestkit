# Graph Operations Reference

Entity and relation creation patterns for the knowledge graph.

## Entity Type Assignment

| Pattern | Entity Type |
|---------|------------|
| Capitalized single words ending in common suffixes | Technology (PostgreSQL, FastAPI) |
| Words with hyphens matching agent pattern | Agent (database-engineer) |
| Words with hyphens matching pattern names | Pattern (cursor-pagination) |
| Project context | Project (current project name) |
| Failed patterns | AntiPattern |

## Create Graph Entities

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

## Relationship Detection Patterns

| Pattern | Relation Type |
|---------|--------------|
| "X uses Y" | USES |
| "X recommends Y" | RECOMMENDS |
| "X requires Y" | REQUIRES |
| "X enables Y" | ENABLES |
| "X prefers Y" | PREFERS |
| "chose X over Y" | CHOSE_OVER |
| "X for Y" | USED_FOR |

## Create Graph Relations

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

## Duplicate Detection

Before storing, search for similar patterns in graph:
1. Query graph with `mcp__memory__search_nodes` for entity names
2. If exact entity exists:
   - Add observation to existing entity via `mcp__memory__add_observations`
   - Inform user: "Updated existing entity (added observation)"
3. If similar pattern found with opposite outcome:
   - Warn: "This conflicts with an existing pattern. Store anyway?"
