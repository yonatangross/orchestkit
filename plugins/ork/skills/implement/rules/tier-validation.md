---
title: Match implementation tier to assessed complexity — never over-engineer a simple task
impact: HIGH
impactDescription: "Using Growth/Enterprise patterns (DI, hexagonal, message queues) on an Interview or Hackathon project wastes tokens and produces unnecessarily complex code"
tags: [tier, complexity, scope, architecture, over-engineering]
---

## Tier Validation

The tier detected in Step 0 sets a hard ceiling on architecture complexity. Every phase must respect this ceiling — especially Phase 4 (Architecture) and Phase 5 (Implementation).

### Tier Ceilings

| Tier | Max Patterns | Max Files | Forbidden |
|------|-------------|-----------|-----------|
| 1. Interview | Flat files, simple routes | 8-15 | DI containers, message queues, microservices |
| 2. Hackathon | Single file if possible | 5-10 | Abstract factories, hexagonal layers |
| 3. MVP | MVC monolith | 20-40 | CQRS, event sourcing, k8s manifests |
| 4-5. Growth/Enterprise | Full patterns allowed | No limit | None |

### Problem

Claude defaults to enterprise-grade patterns regardless of project size. A take-home interview gets hexagonal architecture with ports/adapters when a flat Express app with 3 routes would score higher.

**Incorrect — Tier 1 interview with enterprise architecture:**
```python
# Detected: Tier 1 (Interview, README says "take-home, 4-hour limit")
# Phase 4 agent prompt:
Agent(subagent_type="backend-system-architect",
  prompt="Design hexagonal architecture with DI container, repository pattern,
  CQRS for read/write separation, and event sourcing for the todo API")
# Result: 35 files, 4 abstraction layers for a CRUD app
```

**Correct — Tier 1 interview with appropriate simplicity:**
```python
# Detected: Tier 1 (Interview, README says "take-home, 4-hour limit")
# Phase 4 agent prompt:
Agent(subagent_type="backend-system-architect",
  prompt="Design a simple flat-file Express app for the todo API.
  Tier: 1 (Interview). Max 10 files. No DI, no abstractions beyond MVC.
  Focus: working code, clear tests, clean README.")
# Result: 8 files, runs out of the box, easy to review
```

**Validation check — add to Phase 4 handoff:**
```python
# In 04-architecture.json handoff:
{
  "tier": 1,
  "patterns_used": ["flat-routes", "single-db-file"],
  "tier_ceiling_respected": true,
  "justification": "Interview project — simplicity scores higher than abstraction"
}
# If patterns_used includes anything above the tier ceiling, STOP and simplify
```

### Key Rules

- Always pass the detected tier to every subagent prompt explicitly
- If a subagent produces output exceeding the tier ceiling, reject and re-run with stricter constraints
- When in doubt, under-engineer — simpler code is easier to review and extend
- Tier upgrades require explicit user confirmation via `AskUserQuestion`
