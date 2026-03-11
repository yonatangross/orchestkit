# Confirmation Output Templates

Standard output formats for the remember skill.

## Success Pattern

```
Remembered SUCCESS (category): "summary of text"
   -> Stored in knowledge graph
   -> Created entity: {entity_name} ({entity_type})
   -> Created relation: {from} -> {relation_type} -> {to}
   Graph: {N} entities, {M} relations
```

## Anti-Pattern (Failed)

```
Remembered ANTI-PATTERN (category): "summary of text"
   -> Stored in knowledge graph
   -> Created entity: {anti-pattern-name} (AntiPattern)
   Lesson: {lesson if extracted}
```

## Neutral (Default)

```
Remembered (category): "summary of text"
   -> Stored in knowledge graph
   -> Created entity: {entity_name} ({entity_type})
   Graph: {N} entities, {M} relations
```

## Agent-Scoped

Append to any template above:

```
   Agent: {agent-id}
```

## Examples

### Basic Remember (Graph Only)

**Input:** `/remember Cursor-based pagination scales well for large datasets`

**Output:**
```
Remembered (pagination): "Cursor-based pagination scales well for large datasets"
   -> Stored in knowledge graph
   -> Created entity: cursor-pagination (Pattern)
   Graph: 1 entity, 0 relations
```

### Anti-Pattern

**Input:** `/remember --failed Offset pagination caused timeouts on tables with 1M+ rows`

**Output:**
```
Remembered ANTI-PATTERN (pagination): "Offset pagination caused timeouts on tables with 1M+ rows"
   -> Stored in knowledge graph
   -> Created entity: offset-pagination (AntiPattern)
   Lesson: Use cursor-based pagination for large datasets
   Graph: 1 entity, 0 relations
```

### Agent-Scoped Memory

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
