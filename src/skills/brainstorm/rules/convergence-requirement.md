---
title: Brainstorm must converge to actionable recommendations with clear next steps, not just list ideas
impact: HIGH
impactDescription: "Brainstorm sessions that end with a list of ideas instead of actionable recommendations leave users without a clear path forward, wasting the entire exploration"
tags: convergence, synthesis, actionable, recommendations, decisions
---

# Convergence Requirement

Every brainstorm session must converge from divergent idea generation to a concrete set of actionable recommendations. The final output must include ranked options, a trade-off table, and explicit next steps. A brainstorm that ends with just a list of ideas is a failed brainstorm.

## Problem

The divergent phase (Phase 2) is designed to generate 10+ ideas without filtering. Without a strict convergence requirement, the skill can exhaust its context budget during ideation and never reach synthesis. The user receives a wall of possibilities with no guidance on which to pursue, how they compare, or what to do next.

## Convergence Checkpoints

| Phase | Convergence Gate | Action if Failed |
|-------|-----------------|------------------|
| Phase 2 -> 3 | Ideas generated (>= 5) | Stop generating, proceed with what exists |
| Phase 3 -> 4 | Feasible ideas filtered (<= 8) | Tighten feasibility criteria |
| Phase 4 -> 5 | Ideas rated and ranked | Skip devil's advocate, proceed to synthesis |
| Phase 5 -> 6 | Top 2-3 approaches selected | Force-rank by highest dimension scores |
| Phase 6 (final) | Actionable output delivered | Must include next steps table |

## Required Final Output Structure

The Phase 6 design presentation must include all of these sections:

1. **Recommended approach** -- single top pick with justification
2. **Runner-up(s)** -- 1-2 alternatives with trade-off comparison
3. **Trade-off table** -- dimensions (cost, complexity, testability, time-to-ship, scalability, maintainability)
4. **Next steps** -- concrete actions to begin implementation
5. **Considered but excluded** -- ideas that were explored and why they were dropped

## Rules

- Phase 2 has a hard cap: stop after 15 ideas regardless of agent output
- Each phase transition must produce a handoff file before proceeding
- If context is running low (> 70% consumed), skip remaining phases and synthesize from available data
- The final output must ALWAYS include a "Next steps" section with actionable items
- Never end a brainstorm with "Here are some ideas to consider" without ranking and recommending

**Incorrect -- ending with an unranked idea list:**
```python
# Phase 6 output: just a list, no convergence
TaskUpdate(subject="Brainstorm: caching strategy", status="completed")
# Output to user:
"""
## Ideas Generated
1. Redis caching with TTL
2. CDN edge caching
3. Application-level memoization
4. Database query caching
5. GraphQL persisted queries
6. Service worker caching
7. Varnish reverse proxy

Let me know which approach interests you!
"""
# User has 7 options, no ranking, no trade-offs, no next steps
```

**Correct -- converged to actionable recommendations:**
```python
# Phase 6 output: ranked, compared, actionable
Write(".claude/chain/05-synthesis.json", {
    "recommended": "Redis caching with TTL",
    "runner_ups": ["Application-level memoization"],
    "excluded": ["Varnish reverse proxy", "CDN edge caching",
                 "Service worker caching", "GraphQL persisted queries",
                 "Database query caching"],
    "next_steps": [
        "Add redis dependency to docker-compose.yml",
        "Implement cache-aside pattern in UserService",
        "Add cache invalidation on write paths",
        "Write integration test with testcontainers Redis"
    ]
})
# Output includes: Recommendation + trade-off table + Next Steps + Excluded
# User gets a single recommended approach, a runner-up with dimension
# comparison, concrete implementation steps, and rationale for exclusions
```
