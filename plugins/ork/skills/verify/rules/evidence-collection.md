---
title: "Evidence Collection Patterns"
impact: HIGH
impactDescription: "Verification without evidence produces unsubstantiated scores that miss real issues"
tags: verification, evidence, testing, parallel-execution
---

# Evidence Collection Patterns

## Phase 1: Context Gathering

Run these commands in parallel in ONE message:

```bash
git diff main --stat
git log main..HEAD --oneline
git diff main --name-only | sort -u
```

**Incorrect:**
```bash
# Sequential — wastes time, no coverage data
cd backend && pytest tests/
cd frontend && npm test
```

**Correct:**
```bash
# Parallel with coverage — run both in ONE message
cd backend && poetry run pytest tests/ -v --cov=app --cov-report=json
cd frontend && npm run test -- --coverage
```

## Phase 3: Parallel Test Execution

Run backend and frontend tests in parallel:

```bash
# PARALLEL - Backend and frontend
cd backend && poetry run pytest tests/ -v --cov=app --cov-report=json
cd frontend && npm run test -- --coverage
```

## Phase 7: Metrics Tracking

Store verification metrics in memory for trend analysis:

```python
mcp__memory__create_entities(entities=[{
  "name": "verification-{date}-{feature}",
  "entityType": "VerificationMetrics",
  "observations": [f"composite_score: {score}", ...]
}])
```

Query trends: `mcp__memory__search_nodes(query="VerificationMetrics")`

## Phase 8.5: Post-Verification Feedback

After report compilation, store verification scores in the memory graph for KPI baseline tracking:

Query trends: `mcp__memory__search_nodes(query="VerificationScores")`
