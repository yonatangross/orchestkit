# Evaluation Rubric

Rate each idea 0-10 across seven dimensions with weighted scoring.

## Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Impact** | 0.15 | Value delivered to users/business |
| **Effort** | 0.20 | Implementation complexity (invert: low effort = high score) |
| **Risk** | 0.15 | Technical/business risk (invert: low risk = high score) |
| **Alignment** | 0.20 | Fit with existing architecture and patterns |
| **Testability** | 0.15 | How easily the design can be unit/integration/E2E tested |
| **Simplicity** | 0.10 | Net complexity change: simplifies or adds? (inspired by autoresearch) |
| **Innovation** | 0.05 | Novelty and differentiation |

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

## Simplicity Scoring Guide

| Score | Criteria |
|-------|----------|
| 9-10 | Removes code/concepts while improving or maintaining the result |
| 7-8 | Neutral complexity — replaces existing with equivalent simplicity |
| 5-6 | Adds moderate complexity proportional to value delivered |
| 3-4 | Adds significant complexity for marginal gain |
| 0-2 | Adds ugly complexity, new abstractions, new concepts for little benefit |

> "A small improvement that adds ugly complexity is not worth it. Removing something and getting equal or better results is a great outcome — that's a simplification win." — autoresearch design principle

## Composite Formula

```
composite = impact * 0.15 + (10 - effort) * 0.20 + (10 - risk) * 0.15 + alignment * 0.20 + testability * 0.15 + simplicity * 0.10 + innovation * 0.05
```

## Devil's Advocate Adjustment

| Finding | Adjustment |
|---------|------------|
| 1+ critical concerns | Multiply by 0.70 |
| 3+ high concerns | Multiply by 0.85 |
| No critical/high | No adjustment |

## Example

| Idea | Impact | Effort | Risk | Align | Test | Simpl | Innov | Raw | DA | Final |
|------|--------|--------|------|-------|------|-------|-------|-----|-----|-------|
| JWT+Redis | 8 | 4 | 3 | 9 | 8 | 6 | 6 | 7.30 | 0 | **7.30** |
| Session-only | 6 | 2 | 2 | 8 | 9 | 9 | 3 | 7.55 | 0 | **7.55** |
| Custom tokens | 9 | 8 | 7 | 5 | 3 | 2 | 9 | 4.50 | 1 crit | **3.15** |

Note: Session-only now wins over JWT+Redis because its high Simplicity score (9) rewards removing complexity. This encodes the autoresearch principle: simpler solutions that achieve similar results are preferred.
