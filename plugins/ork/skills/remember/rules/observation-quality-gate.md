---
title: Observations must be specific and actionable with measurable details not vague labels
impact: MEDIUM
impactDescription: "Vague observations like 'good pattern' or 'works well' provide zero recall value and waste graph storage"
tags: observation, quality, actionable, specificity, recall-value
---

## Problem

When storing observations on entities, agents often write vague summaries like "good pattern", "works well", or "useful tool". These provide no actionable information when recalled in future sessions. The entire value of the knowledge graph depends on observations being specific enough to act on without additional context.

## Rule

Every observation must pass the **Recall Value Test**: "If I read only this observation 6 months from now, can I act on it without asking follow-up questions?"

### Quality Criteria

```
PASS: Contains at least ONE of:
  - A concrete metric (p99, latency, throughput, error rate)
  - A specific configuration value (min=5, max=20, timeout=30s)
  - A named alternative that was rejected and why
  - A reproduction step or trigger condition

FAIL: Contains ONLY:
  - Adjectives without context ("good", "fast", "better", "useful")
  - Tautologies ("PostgreSQL is a database")
  - Vague recommendations ("consider using X")
```

### Incorrect -- vague observations:

```json
mcp__memory__create_entities({
  "entities": [{
    "name": "cursor-pagination",
    "entityType": "Pattern",
    "observations": [
      "Good pattern for large datasets",
      "Works better than offset",
      "Recommended approach"
    ]
  }]
})
// None of these help a future session make a decision
```

### Correct -- specific and actionable observations:

```json
mcp__memory__create_entities({
  "entities": [{
    "name": "cursor-pagination",
    "entityType": "Pattern",
    "observations": [
      "Reduced p99 from 2s to 140ms on users table with 1.2M rows",
      "Offset pagination caused linear scan past row 100k; cursor uses indexed seek",
      "Implementation: ORDER BY id > :last_seen_id LIMIT :page_size"
    ]
  }]
})
// Each observation is independently actionable
```

### Incorrect -- tautological observation on anti-pattern:

```json
mcp__memory__add_observations({
  "observations": [{
    "entityName": "offset-pagination",
    "contents": ["Bad for performance"]
  }]
})
```

### Correct -- specific failure context:

```json
mcp__memory__add_observations({
  "observations": [{
    "entityName": "offset-pagination",
    "contents": [
      "Caused 504 timeouts on /api/users?page=500 with 1M+ rows (OFFSET 500000 triggers sequential scan)"
    ]
  }]
})
```

### Rewriting Guide

| Vague Input | Rewritten Observation |
|-------------|----------------------|
| "good caching strategy" | "Redis cache with 5min TTL reduced DB queries by 80% on /api/products" |
| "works well" | "Handles 10k concurrent connections with <50ms p95 latency" |
| "better than alternative" | "Chose Postgres over MongoDB: need JOIN-heavy queries across 6 tables" |
| "useful for auth" | "JWT with RS256 + 15min expiry; refresh tokens stored in httpOnly cookies" |

### Key Rules

- Apply the Recall Value Test to every observation before writing
- Rewrite vague user input into specific observations -- ask clarifying questions if needed
- Include numbers, config values, or named comparisons whenever available
- Prefix with source context when from a specific agent: "From remember: '{original text}'"
