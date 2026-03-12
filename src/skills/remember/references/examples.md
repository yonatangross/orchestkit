# Remember Skill - Examples

## Basic Remember (Graph Only)

**Input:** `/remember Cursor-based pagination scales well for large datasets`

**Output:**
```
Remembered (pagination): "Cursor-based pagination scales well for large datasets"
   -> Stored in knowledge graph
   -> Created entity: cursor-pagination (Pattern)
   Graph: 1 entity, 0 relations
```

## Anti-Pattern

**Input:** `/remember --failed Offset pagination caused timeouts on tables with 1M+ rows`

**Output:**
```
Remembered ANTI-PATTERN (pagination): "Offset pagination caused timeouts on tables with 1M+ rows"
   -> Stored in knowledge graph
   -> Created entity: offset-pagination (AntiPattern)
   Lesson: Use cursor-based pagination for large datasets
   Graph: 1 entity, 0 relations
```

## Agent-Scoped Memory

**Input:** `/remember --agent backend-system-architect Use connection pooling with min=5, max=20`

**Output:**
```
Remembered (database): "Use connection pooling with min=5, max=20"
   -> Stored in knowledge graph
   -> Created entity: connection-pooling (Pattern)
   -> Created relation: project -> USES -> connection-pooling
   Graph: 1 entity, 1 relation
   Agent: backend-system-architect
```
