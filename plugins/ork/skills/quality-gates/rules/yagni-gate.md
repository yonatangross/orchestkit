---
title: YAGNI Gate
impact: HIGH
impactDescription: "Over-engineering wastes 30-70% of implementation time on patterns that never get used"
tags: yagni, over-engineering, justified-complexity, scope, pre-implementation
---

## YAGNI Gate

Pre-implementation check that prevents over-engineering by validating complexity against project scope.

**Incorrect — skipping straight to implementation:**
```
Task: "Add user authentication"
→ Immediately builds OAuth2.1 + PKCE + SSO + MFA + custom JWT rotation
→ 2000 LOC for a take-home assignment
```

**Correct — YAGNI gate catches this:**
```
Task: "Add user authentication"
→ YAGNI Gate: Project tier = Interview (detected from README)
→ Scope-appropriate auth = session cookies or hardcoded key
→ Justified complexity ratio = 2000 / 200 = 10.0 → BLOCK
→ Suggestion: "Use session cookies. Add a comment noting what you'd change for production."
```

## YAGNI Gate Questions

Before applying any architecture pattern, answer ALL four:

| # | Question | If "No" |
|---|----------|---------|
| 1 | Does this pattern serve a **current** requirement? | Remove it. "Might need later" is not current. |
| 2 | Could 80% of the value be delivered with 20% of complexity? | Use the simpler version. |
| 3 | Is this the simplest thing that could possibly work? | Simplify until it is. |
| 4 | Is the cost of adding this later significantly higher than now? | If low cost to add later, defer. |

**Pass rule:** Must answer YES to question 1 AND at least one of questions 2-4 must justify current inclusion.

## Justified Complexity Ratio

```
justified_complexity = actual_complexity / scope_appropriate_complexity
```

Where `scope_appropriate_complexity` comes from the project tier (see `scope-appropriate-architecture` skill):

| Tier | Scope-Appropriate LOC | Typical Patterns |
|------|----------------------|------------------|
| Interview/Hackathon | 200-800 | Flat files, inline SQL, no abstractions |
| MVP | 1,000-5,000 | MVC monolith, managed auth, simple ORM |
| Growth/Production | 5,000-30,000 | Layered, repository where needed, DI |
| Enterprise | 30,000+ | Hexagonal, CQRS if justified, full DI |

### Thresholds

| Ratio | Status | Action |
|-------|--------|--------|
| > 2.0 | **BLOCK** | Over-engineered. Must simplify before proceeding. Surface simpler alternatives. |
| 1.5 - 2.0 | **WARN** | Likely over-engineered. Present simpler alternative. Proceed only if user confirms. |
| 1.0 - 1.5 | **OK** | Proportionate complexity. |
| < 1.0 | **OK** | Simpler than expected. Fine. |

### Evaluation Method

Estimate actual complexity by counting planned patterns:

| Pattern | Complexity Cost (LOC) |
|---------|-----------------------|
| Repository per entity | +150-300 |
| Dependency injection framework | +100-200 |
| Domain exceptions hierarchy | +50-100 |
| Generic base repository | +100-200 |
| Unit of Work | +150-250 |
| Event sourcing | +500-2000 |
| CQRS | +300-800 |
| Custom auth (JWT + refresh) | +200-400 |
| Message queue integration | +200-500 |

Sum planned pattern costs. Divide by tier's scope-appropriate LOC ceiling. Apply thresholds.

## Devil's Advocate: Simpler Alternatives

When YAGNI gate triggers WARN or BLOCK, **surface alternatives before implementation** (not buried in references):

```markdown
## YAGNI Gate: Over-Engineering Warning

**Planned approach:** Repository pattern + DI + domain exceptions (est. ~800 LOC)
**Project tier:** MVP (scope-appropriate: ~2,000 LOC)
**Ratio:** 800 / 2000 = 0.4 → OK

But if tier were Interview:
**Ratio:** 800 / 400 = 2.0 → BLOCK

### Simpler Alternative
- Direct ORM calls in route handlers (~150 LOC)
- Inline validation (~50 LOC)
- HTTP exceptions directly (~30 LOC)
- Total: ~230 LOC — delivers same functionality
```

## Integration with Gate Flow

Insert as Step 0 in the quality gate decision flow, **before** complexity assessment:

```
Step 0: YAGNI Check
  → Read project tier (from scope-appropriate-architecture or auto-detect)
  → For each planned pattern: run 4 YAGNI questions
  → Calculate justified_complexity ratio
  → If ratio > 2.0: BLOCK with simpler alternatives
  → If ratio 1.5-2.0: WARN with simpler alternatives

Step 1: Assess complexity (1-5)
Step 2: Count critical questions
Step 3: Check dependencies
Step 4: Check attempt count
Step 5: Final gate decision
```

## Key Rules

- YAGNI gate runs BEFORE implementation planning, not after
- Security patterns are exempt — never simplify auth validation, input sanitization, or SQL parameterization
- The gate evaluates architecture patterns, not business logic complexity
- When blocked, the agent MUST present the simpler alternative to the user
- User can override with explicit confirmation ("I know this is a take-home but I want to demonstrate hexagonal architecture")
