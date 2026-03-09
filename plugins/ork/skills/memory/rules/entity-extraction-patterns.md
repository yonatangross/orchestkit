---
title: "Entity Extraction Patterns"
impact: MEDIUM
impactDescription: "Incorrect entity types produce a noisy knowledge graph that returns irrelevant search results"
tags: memory, entities, knowledge-graph, extraction
---

# Entity Extraction Patterns

When searching or visualizing the knowledge graph, recognize these entity types and their typical observations.

## Entity Types

| Type | Examples | Typical Observations |
|------|----------|---------------------|
| `Technology` | pgvector, PostgreSQL, React | Version, use case, project association |
| `Agent` | database-engineer, backend-system-architect | Capabilities, scope, assigned tasks |
| `Pattern` | cursor-pagination, connection-pooling | When to use, trade-offs, implementation notes |
| `Decision` | "Use PostgreSQL for DB" | Rationale, alternatives considered, date |
| `Project` | Project-specific context | Stack, status, team, constraints |
| `AntiPattern` | Failed or abandoned patterns | Why it failed, what replaced it |
| `Constraint` | Budget, timeline, compliance | Source, severity, workarounds |
| `Preference` | "Prefer TypeScript strict" | Strength, scope, exceptions |

**Incorrect:**
```python
# Vague entity type, no useful observations
create_entities([{"name": "thing", "entityType": "misc", "observations": ["used it"]}])
```

**Correct:**
```python
# Specific type with actionable observations
create_entities([{"name": "pgvector", "entityType": "Technology",
    "observations": ["v0.7.0", "Used for RAG embeddings in acme-app", "Requires PostgreSQL 15+"]}])
```

## Relation Types

| Relation | Semantic | Arrow Style |
|----------|----------|-------------|
| USES | Active dependency | Solid |
| RECOMMENDS | Suggested approach | Solid |
| REQUIRES | Hard dependency | Solid |
| ENABLES | Unlocks capability | Solid |
| PREFERS | Stated preference | Solid |
| CHOSE_OVER | Rejected alternative | Dashed |
| USED_FOR | Purpose link | Solid |
| CONFLICTS_WITH | Incompatibility | Dashed |
