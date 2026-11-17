---
title: Validate entity types and relation types against the schema before writing to the graph
impact: HIGH
impactDescription: "Invalid entity types create ungroupable nodes; invalid relations break graph queries and traversals"
tags: validation, schema, entity-type, relation-type, graph-integrity
---

## Problem

The remember skill defines specific entity types (Technology, Agent, Pattern, Project, AntiPattern) and relation types (USES, RECOMMENDS, REQUIRES, ENABLES, PREFERS, CHOSE_OVER, USED_FOR). Writing entities with ad-hoc types like "Tool", "Library", or "Framework" creates nodes that don't group with anything and break downstream queries.

## Valid Schema

```
Entity Types:   Technology | Agent | Pattern | Project | AntiPattern | Decision | Preference
Relation Types: USES | RECOMMENDS | REQUIRES | ENABLES | PREFERS | CHOSE_OVER | USED_FOR
```

## Rule

Before calling `mcp__memory__create_entities` or `mcp__memory__create_relations`, validate every `entityType` and `relationType` against the schema above. Map unrecognized types to the closest valid type.

### Incorrect -- inventing entity types:

```json
mcp__memory__create_entities({
  "entities": [
    {
      "name": "Express",
      "entityType": "Framework",
      "observations": ["Used for API server"]
    },
    {
      "name": "Redis",
      "entityType": "Cache",
      "observations": ["Session storage"]
    }
  ]
})
// "Framework" and "Cache" are not valid entity types
// These nodes won't appear in type-based queries
```

### Correct -- mapping to valid types:

```json
mcp__memory__create_entities({
  "entities": [
    {
      "name": "Express",
      "entityType": "Technology",
      "observations": ["Used for API server (framework)"]
    },
    {
      "name": "Redis",
      "entityType": "Technology",
      "observations": ["Session storage (cache layer)"]
    }
  ]
})
// Both map to "Technology" — specifics go in observations
```

### Incorrect -- inventing relation types:

```json
mcp__memory__create_relations({
  "relations": [{
    "from": "backend-api",
    "to": "Redis",
    "relationType": "CACHES_WITH"
  }]
})
// "CACHES_WITH" is not a valid relation type
```

### Correct -- using valid relation types:

```json
mcp__memory__create_relations({
  "relations": [{
    "from": "backend-api",
    "to": "Redis",
    "relationType": "USES"
  }]
})
// "USES" is the closest valid relation type
```

### Type Mapping Guide

| Incoming Type | Valid Mapping | Where Detail Goes |
|---------------|---------------|-------------------|
| Framework     | Technology    | Observation: "(framework)" |
| Library       | Technology    | Observation: "(library)" |
| Tool          | Technology    | Observation: "(CLI tool)" |
| Convention    | Pattern       | Observation: "(convention)" |
| BestPractice  | Pattern       | Observation: "(best practice)" |
| Guideline     | Preference    | Observation: "(team guideline)" |

### Key Rules

- Every `entityType` must be one of: Technology, Agent, Pattern, Project, AntiPattern, Decision, Preference
- Every `relationType` must be one of: USES, RECOMMENDS, REQUIRES, ENABLES, PREFERS, CHOSE_OVER, USED_FOR
- Put specifics that don't fit the type system into observations, not into the type field
- If `--failed` flag is set, entityType must be AntiPattern
