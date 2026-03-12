---
title: Flag architecture patterns that exceed the detected project tier by 2+ levels
impact: HIGH
impactDescription: "Over-engineered architecture multiplies development time, onboarding cost, and maintenance burden without delivering value at the current scale"
tags: [architecture, over-engineering, yagni, scope, patterns]
---

# Flag Over-Engineering (Tier + 2 Rule)

## Why

A pattern appropriate at Tier 5 (Enterprise) adds weeks of development time to a Tier 2 (Hackathon). The complexity does not pay for itself until the project reaches the tier where it is needed. The "Tier + 2 Rule" catches patterns that are 2+ levels above the detected tier.

## Rule

After detecting the project tier:
1. Check each proposed pattern against the Pattern Appropriateness Matrix
2. If a pattern is rated OVERKILL for the current tier AND the tier where it becomes APPROPRIATE is 2+ levels higher, flag it
3. Suggest the tier-appropriate alternative
4. Only allow override with explicit user justification

## Incorrect — recommend enterprise patterns for a prototype

```markdown
## Architecture for Todo App (Tier 2: Hackathon)

### Recommended:
- Hexagonal architecture with ports and adapters
- CQRS with separate read/write models
- Event sourcing for audit trail
- Dependency injection container (tsyringe)
- Separate DTO/Entity/Domain layers
- Message queue for async operations
```

**Problems:**
- Hexagonal is Tier 5 (3 levels above Tier 2)
- CQRS is Tier 5 (3 levels above)
- Event sourcing is Tier 5 (3 levels above)
- DI container is Tier 4 (2 levels above)
- A Todo app needs none of this

## Correct — flag over-engineering with tier-appropriate alternatives

```markdown
## Architecture for Todo App (Tier 2: Hackathon)

### OVER-ENGINEERING FLAGS:

| Proposed Pattern | Appropriate At | Current Tier | Gap | Alternative |
|-----------------|---------------|--------------|-----|-------------|
| Hexagonal architecture | Tier 5 | Tier 2 | +3 | Flat file structure |
| CQRS | Tier 5 | Tier 2 | +3 | Single model |
| Event sourcing | Tier 5 | Tier 2 | +3 | Simple CRUD |
| DI container | Tier 4 | Tier 2 | +2 | Direct imports |

### Recommended (Tier 2 appropriate):
- Single file or flat structure
- Direct function calls, no DI
- SQLite or in-memory storage
- No layers — route handler calls DB directly
```

## Pattern Check Implementation

```typescript
const PATTERN_TIER: Record<string, number> = {
  "hexagonal":        5,
  "cqrs":             5,
  "event-sourcing":   5,
  "ddd":              5,
  "di-container":     4,
  "message-queue":    4,
  "microservices":    5,
  "repository":       4,
  "separate-dtos":    4,
  "api-versioning":   3,
};

function checkOverEngineering(
  currentTier: number,
  proposedPatterns: string[]
): { pattern: string; gap: number; appropriateAt: number }[] {
  return proposedPatterns
    .map(p => ({
      pattern: p,
      appropriateAt: PATTERN_TIER[p] ?? currentTier,
      gap: (PATTERN_TIER[p] ?? currentTier) - currentTier
    }))
    .filter(p => p.gap >= 2);
}

// Example: Tier 2 project
const flags = checkOverEngineering(2, ["hexagonal", "cqrs", "api-versioning"]);
// flags = [
//   { pattern: "hexagonal", appropriateAt: 5, gap: 3 },
//   { pattern: "cqrs", appropriateAt: 5, gap: 3 }
// ]
// "api-versioning" (Tier 3, gap 1) is not flagged
```

## When Override Is Acceptable

Flag but allow if the user provides explicit justification:

| Justification | Acceptable |
|---------------|------------|
| "We plan to scale to 10K users next quarter" | Yes — document future tier |
| "Our team already knows this pattern" | Yes — lower learning cost |
| "I just want to practice DDD" | Yes — learning project |
| No justification given | No — use tier-appropriate pattern |
