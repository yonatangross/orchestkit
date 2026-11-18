# Entity Extraction Workflow

## Step 4: Extract Entities from Text

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

## Step 5: Create Graph Entities (PRIMARY)

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

## Step 6: Create Graph Relations

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

## Step 7: Confirm Storage

**For success:**
```
Remembered SUCCESS (category): "summary of text"
   -> Stored in knowledge graph
   -> Created entity: {entity_name} ({entity_type})
   -> Created relation: {from} -> {relation_type} -> {to}
   Graph: {N} entities, {M} relations
```

**For failed:**
```
Remembered ANTI-PATTERN (category): "summary of text"
   -> Stored in knowledge graph
   -> Created entity: {anti-pattern-name} (AntiPattern)
   Lesson: {lesson if extracted}
```

**For neutral:**
```
Remembered (category): "summary of text"
   -> Stored in knowledge graph
   -> Created entity: {entity_name} ({entity_type})
   Graph: {N} entities, {M} relations
```
