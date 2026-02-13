# Entity Extraction

Extract entities from natural language for graph memory storage.

## Entity Types

| Type | Pattern | Examples |
|------|---------|----------|
| agent | OrchestKit agent names | database-engineer, backend-system-architect |
| technology | Known tech keywords | pgvector, FastAPI, PostgreSQL, React |
| pattern | Design/architecture patterns | cursor-pagination, CQRS, event-sourcing |
| decision | "decided", "chose", "will use" | Architecture choices |
| blocker | "blocked", "issue", "problem" | Identified obstacles |

## Extraction Patterns

### Agent Detection

```regex
(database-engineer|backend-system-architect|frontend-ui-developer|
 security-auditor|test-generator|workflow-architect|llm-integrator|
 data-pipeline-engineer|[a-z]+-[a-z]+-?[a-z]*)
```

### Technology Detection

Known technologies: pgvector, PostgreSQL, FastAPI, SQLAlchemy, React, TypeScript, LangGraph, Redis, Celery, Docker, Kubernetes

### Relation Extraction

| Pattern | Relation Type |
|---------|---------------|
| "X uses Y" | uses |
| "X recommends Y" | recommends |
| "X requires Y" | requires |
| "X blocked by Y" | blocked_by |
| "X depends on Y" | depends_on |
| "X for Y" / "X used for Y" | used_for |

## Extraction Algorithm

```python
def extract_entities(text):
    entities = []
    relations = []

    # 1. Find agents
    for agent in KNOWN_AGENTS:
        if agent in text.lower():
            entities.append({"name": agent, "type": "agent"})

    # 2. Find technologies
    for tech in KNOWN_TECHNOLOGIES:
        if tech.lower() in text.lower():
            entities.append({"name": tech, "type": "technology"})

    # 3. Extract relations via patterns
    for pattern, relation_type in RELATION_PATTERNS:
        matches = re.findall(pattern, text)
        for from_entity, to_entity in matches:
            relations.append({
                "from": from_entity,
                "relation": relation_type,
                "to": to_entity
            })

    return {"entities": entities, "relations": relations}
```

## Graph Storage Format

**Create entities:**
```javascript
mcp__memory__create_entities({
  entities: [
    { name: "database-engineer", entityType: "agent", observations: ["recommends pgvector"] },
    { name: "pgvector", entityType: "technology", observations: ["vector extension for PostgreSQL"] }
  ]
})
```

**Create relations:**
```javascript
mcp__memory__create_relations({
  relations: [
    { from: "database-engineer", to: "pgvector", relationType: "recommends" }
  ]
})
```

## Observation Patterns

When adding observations to existing entities:

```javascript
mcp__memory__add_observations({
  observations: [
    { entityName: "pgvector", contents: ["supports HNSW indexing", "requires PostgreSQL 15+"] }
  ]
})
```
