# Unified Scoring Framework

Canonical scoring reference shared by `assess`, `verify`, and any skill that produces quality scores. Single source of truth — other skills reference this file instead of defining their own.

## Base Dimensions (7)

| Dimension | Base Weight | What It Measures |
|-----------|-------------|------------------|
| Correctness | 0.15 | Functional accuracy, edge cases, error handling |
| Maintainability | 0.15 | Readability, complexity, naming, single responsibility |
| Performance | 0.12 | Algorithm efficiency, caching, async, latency |
| Security | 0.20 | OWASP Top 10, input validation, secrets, CVEs |
| Scalability | 0.10 | Horizontal scaling, statelessness, load patterns |
| Testability | 0.13 | Coverage, assertion quality, test isolation |
| Compliance | 0.15 | API contracts, UI contracts, schema validation |

**Base Total: 1.00**

## Extended Dimensions

Skills may add dimensions beyond the base 7. When adding:

1. Define the new dimension with its weight
2. Scale all weights so total = 1.00
3. Define scope rules for when the dimension is skipped
4. When skipped, redistribute weight proportionally: `adjusted_weight = base_weight / (1.0 - skipped_weight)`

### Simplicity Dimension (used by `brainstorm`, `assess`)

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Simplicity | 0.10 | Net complexity change — does this simplify or add to the system? |

**Scoring guide:**

| Score | Criteria |
|-------|----------|
| 9-10 | Removes code/concepts while improving or maintaining the result |
| 7-8 | Neutral complexity — replaces existing with equivalent simplicity |
| 5-6 | Adds moderate complexity proportional to value delivered |
| 3-4 | Adds significant complexity for marginal gain |
| 0-2 | Adds ugly complexity, new abstractions, new concepts for little benefit |

**Scope rule:** Active when evaluating design alternatives, architecture decisions, or refactoring approaches. Skip when reviewing existing code that isn't being compared against alternatives.

> Inspired by [autoresearch](https://github.com/karpathy/autoresearch): "A small improvement that adds ugly complexity is not worth it. Removing something and getting equal or better results is a great outcome."

### Visual Dimension (used by `verify`)

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Visual | 0.10 | Layout correctness, a11y, content completeness, responsiveness |

When Visual is active, base dimensions scale down by `1.0 / 1.10` factor. When skipped (API-only), base weights stay at 1.00.

### Compliance Scope Rules

| Scope | Compliance Covers |
|-------|-------------------|
| Backend-only | API compliance (contracts, schema validation, versioning) |
| Frontend-only | UI compliance (design system, a11y, responsive) |
| Full-stack | API + UI compliance (split evenly) |

## Composite Score

```
composite = sum(dimension_score * adjusted_weight for each dimension)
```

Each dimension scored **0-10** with decimal precision. Composite is also 0-10.

## Grade Thresholds

| Score | Grade | Verdict | Action |
|-------|-------|---------|--------|
| 9.0-10.0 | A+ | EXCELLENT | Ship it |
| 8.0-8.9 | A | GOOD | Ready for merge |
| 7.0-7.9 | B | GOOD | Minor improvements optional |
| 6.0-6.9 | C | ADEQUATE | Consider improvements |
| 5.0-5.9 | D | NEEDS WORK | Improvements recommended |
| 0.0-4.9 | F | CRITICAL | Do not merge |

## Per-Dimension Scoring Criteria

### Score Levels (all dimensions)

| Range | Level | Description |
|-------|-------|-------------|
| 9-10 | Excellent | Exemplary, reference quality |
| 7-8 | Good | Ready for merge, minor suggestions |
| 5-6 | Adequate | Functional but needs improvement |
| 3-4 | Poor | Significant issues, blocks merge |
| 1-2 | Critical | Fundamental problems |
| 0 | Broken | Does not function |

### Scoring Rules

**Incorrect** (no evidence):
```
Security: "looks fine" → 8/10
Performance: "fast enough" → 7/10
```

**Correct** (evidence-based):
```
Security: "11/11 injection tests pass, 0 CVEs" → 9/10
Performance: "p99 latency 142ms (budget: 300ms), 0 N+1" → 8.5/10
```

## Improvement Prioritization

### Effort Scale (1-5)

| Points | Effort | Description |
|--------|--------|-------------|
| 1 | Trivial | < 15 minutes, single file change |
| 2 | Low | 15-60 minutes, few files |
| 3 | Medium | 1-4 hours, moderate scope |
| 4 | High | 4-8 hours, significant refactoring |
| 5 | Major | 1+ days, architectural change |

### Impact Scale (1-5)

| Points | Impact | Description |
|--------|--------|-------------|
| 1 | Minimal | Cosmetic, no functional change |
| 2 | Low | Minor improvement, limited scope |
| 3 | Medium | Noticeable quality improvement |
| 4 | High | Significant quality or security gain |
| 5 | Critical | Blocks shipping or fixes major vulnerability |

### Priority Formula

```
priority = impact / effort
```

Higher ratio = do first. **Quick Wins**: Effort <= 2 AND Impact >= 4 — always highlight at top.

## Blocking Rules

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Composite below minimum | < 6.0 (configurable) | BLOCK |
| Security below minimum | < 7.0 (configurable) | BLOCK |
| Any critical dimension | < 3.0 | BLOCK |
| Coverage below minimum | < 70% (configurable) | WARN |

Override via `.claude/policies/verification-policy.json`.
