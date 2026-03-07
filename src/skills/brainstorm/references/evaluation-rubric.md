# Evaluation Rubric

Rate each idea 0-10 across six dimensions with weighted scoring.

## Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Impact** | 0.20 | Value delivered to users/business |
| **Effort** | 0.20 | Implementation complexity (invert: low effort = high score) |
| **Risk** | 0.15 | Technical/business risk (invert: low risk = high score) |
| **Alignment** | 0.20 | Fit with existing architecture and patterns |
| **Testability** | 0.15 | How easily the design can be unit/integration/E2E tested |
| **Innovation** | 0.10 | Novelty and differentiation |

## Scoring Scale

| Score | Label | Criteria |
|-------|-------|----------|
| 9-10 | Excellent | Clearly best-in-class |
| 7-8 | Good | Strong with minor concerns |
| 5-6 | Adequate | Acceptable, notable trade-offs |
| 3-4 | Weak | Significant drawbacks |
| 0-2 | Poor | Fundamental issues |

## Testability Scoring Guide

| Score | Criteria |
|-------|----------|
| 9-10 | Pure functions, clear boundaries, all deps injectable, trivial to mock |
| 7-8 | Mostly testable, minor coupling, mockable with reasonable effort |
| 5-6 | Testable with effort, some tight coupling or hard-to-mock deps |
| 3-4 | Hard to test, many external deps, deep coupling, requires real services |
| 0-2 | Untestable: global state, hidden side effects, no seams for mocking |

## Composite Formula

```
composite = impact * 0.20 + (10 - effort) * 0.20 + (10 - risk) * 0.15 + alignment * 0.20 + testability * 0.15 + innovation * 0.10
```

## Devil's Advocate Adjustment

| Finding | Adjustment |
|---------|------------|
| 1+ critical concerns | Multiply by 0.70 |
| 3+ high concerns | Multiply by 0.85 |
| No critical/high | No adjustment |

## Example

| Idea | Impact | Effort | Risk | Align | Test | Innov | Raw | DA | Final |
|------|--------|--------|------|-------|------|-------|-----|-----|-------|
| JWT+Redis | 8 | 4 | 3 | 9 | 8 | 6 | 7.45 | 0 | **7.45** |
| Session-only | 6 | 2 | 2 | 8 | 9 | 3 | 7.25 | 0 | **7.25** |
| Custom tokens | 9 | 8 | 7 | 5 | 3 | 9 | 4.90 | 1 crit | **3.43** |
