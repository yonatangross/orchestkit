<!-- SHARED: keep in sync with ../../../verify/references/quality-model.md -->
# Quality Model

Canonical scoring reference for assess and verify skills. Defines unified dimensions, weights, grade thresholds, and improvement prioritization.

## Scoring Dimensions (7 Unified)

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Correctness | 0.15 | Does it work correctly? Functional accuracy, edge cases handled |
| Maintainability | 0.15 | Easy to understand and modify? Readability, complexity, patterns |
| Performance | 0.12 | Efficient execution? No bottlenecks, resource usage, latency |
| Security | 0.20 | Follows security best practices? OWASP, secrets, CVEs, input validation |
| Scalability | 0.10 | Handles growth? Load patterns, data volume, horizontal scaling |
| Testability | 0.13 | Easy to test? Coverage, test quality, isolation, mocking |
| Compliance | 0.15 | Meets API and UI contracts? Conditional on scope (see below) |

**Total: 1.00**

### Compliance Dimension — Scope Rules

Compliance weight (0.15) applies differently based on project scope:

| Scope | Compliance Covers |
|-------|-------------------|
| Backend-only | API compliance (contracts, schema validation, versioning) |
| Frontend-only | UI compliance (design system, a11y, responsive) |
| Full-stack | API + UI compliance (split evenly: 0.075 each) |

## Composite Score

```
composite = sum(dimension_score * weight for each dimension)
```

Each dimension is scored **0-10** with decimal precision. Composite is also 0-10.

## Grade Thresholds

| Score | Grade | Verdict | Action |
|-------|-------|---------|--------|
| 9.0-10.0 | A+ | EXCELLENT | Ship it! |
| 8.0-8.9 | A | GOOD | Ready for merge |
| 7.0-7.9 | B | GOOD | Minor improvements optional |
| 6.0-6.9 | C | ADEQUATE | Consider improvements |
| 5.0-5.9 | D | NEEDS WORK | Improvements recommended |
| 0.0-4.9 | F | CRITICAL | Do not merge |

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

Higher ratio = do first.

### Quick Wins

**Effort <= 2 AND Impact >= 4**

Always highlight quick wins at the top of improvement suggestions. These are high-value changes that can be done fast.
