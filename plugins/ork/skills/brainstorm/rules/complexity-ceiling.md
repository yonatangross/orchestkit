---
title: Flag ideas that exceed current team or infrastructure capacity using tier-based complexity ceilings
impact: HIGH
impactDescription: "Ideas that exceed team/infra capacity lead to failed implementations -- complexity ceilings prevent recommending architectures the team cannot support"
tags: complexity, capacity, tier, ceiling, quality-gates, scope
---

# Complexity Ceiling

Every brainstorm idea must be checked against the project's detected tier (Step 0) to ensure it does not exceed the team's capacity. Ideas that exceed the complexity ceiling must be flagged before reaching synthesis.

## Problem

Brainstorm agents optimize for technical elegance, not team reality. Without a complexity ceiling, a Tier 2 hackathon project receives recommendations for event-driven microservices, and a Tier 3 MVP gets suggestions requiring dedicated SRE. The user implements the recommendation, then fails because they lack the operational capacity.

## Tier Complexity Ceilings

| Tier | Max Complexity | Forbidden Patterns |
|------|---------------|-------------------|
| 1. Interview | Level 2 | No abstractions beyond simple modules |
| 2. Hackathon | Level 2 | No CI/CD, no Docker, no external services |
| 3. MVP | Level 3 | No K8s, no CQRS, no custom orchestration |
| 4. Growth | Level 4 | No multi-region, no custom service mesh |
| 5. Enterprise | Level 5 | Full range available |
| 6. Open Source | Level 3 | No infrastructure assumptions |

These ceilings align with the `scope-appropriate-architecture` skill and `assess` skill complexity scoring (Level 1-5).

## Rules

- Detect project tier in Step 0 before generating ideas
- During Phase 3 feasibility check, compare each idea's complexity level against the tier ceiling
- Ideas exceeding the ceiling get `"exceeds_ceiling": true` with a `"ceiling_reason"` field
- If ALL generated ideas exceed the ceiling, generate simpler alternatives before proceeding
- Never present a ceiling-exceeding idea as the top recommendation

**Incorrect -- recommending enterprise patterns for a hackathon:**
```python
# Tier 2 hackathon, but agents suggest enterprise architecture
TaskCreate(
    subject="Brainstorm: API for todo app",
    description="Explore CQRS + event sourcing + saga pattern for todo CRUD"
)
# Agent recommends:
# - Event-driven microservices (Level 5)
# - Saga orchestration (Level 5)
# - Custom API gateway (Level 4)
# User cannot implement any of these in a hackathon
```

**Correct -- constraining recommendations to tier ceiling:**
```python
# Tier 2 hackathon detected, ceiling = Level 2
ideas_with_ceiling = []
for idea in raw_ideas:
    complexity = assess_complexity(idea)  # Uses assess skill scoring
    exceeds = complexity.level > TIER_CEILINGS[detected_tier]
    ideas_with_ceiling.append({
        **idea,
        "complexity_level": complexity.level,
        "exceeds_ceiling": exceeds,
        "ceiling_reason": f"Level {complexity.level} exceeds Tier {detected_tier} "
                          f"ceiling of Level {TIER_CEILINGS[detected_tier]}"
                          if exceeds else None
    })

# Filter for synthesis: only ideas within ceiling
viable = [i for i in ideas_with_ceiling if not i["exceeds_ceiling"]]
if not viable:
    # Generate simpler alternatives before proceeding
    TaskCreate(subject="Generate simpler alternatives within Level 2 ceiling")
```

## When to Override

The user can explicitly override the ceiling by saying things like "I want enterprise-grade" or "ignore the project tier." When overriding:
1. Acknowledge the override in the handoff file
2. Warn about operational requirements the higher complexity demands
3. Include a "Simplified alternative" alongside each ceiling-exceeding recommendation
