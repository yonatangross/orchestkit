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

## Phase 2.5: Visual Evidence Collection

Run in parallel with Phase 2 agents. Auto-detects frontend framework and captures screenshots.

**Incorrect:**
```bash
# Manual screenshots with no structure
open http://localhost:3000
# Take manual screenshot...
```

**Correct:**
```python
# Automated visual capture with AI evaluation
Agent(
  subagent_type="general-purpose",
  prompt="Visual capture: detect framework, start server, screenshot routes via agent-browser, evaluate with Claude vision, generate gallery.html",
  run_in_background=True
)
```

Output structure:
```
verification-output/{timestamp}/
├── screenshots/          (PNGs per route, base64 in gallery)
├── ai-evaluations/       (JSON per screenshot with score + issues)
├── annotations/          (before/after if agentation used)
│   ├── before/
│   └── after/
└── gallery.html          (self-contained, open in browser)
```

## Phase 8.5: Post-Verification Feedback

After report compilation, store verification scores in the memory graph for KPI baseline tracking:

Query trends: `mcp__memory__search_nodes(query="VerificationScores")`
