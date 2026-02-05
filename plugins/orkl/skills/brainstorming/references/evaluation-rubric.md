# Evaluation Rubric

Rate each idea 0-10 across five dimensions with weighted scoring.

## Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Impact** | 0.25 | Value delivered to users/business |
| **Effort** | 0.20 | Implementation complexity (invert: low effort = high score) |
| **Risk** | 0.20 | Technical/business risk (invert: low risk = high score) |
| **Alignment** | 0.20 | Fit with existing architecture and patterns |
| **Innovation** | 0.15 | Novelty and differentiation |

## Scoring Scale

| Score | Label | Criteria |
|-------|-------|----------|
| 9-10 | Excellent | Clearly best-in-class |
| 7-8 | Good | Strong with minor concerns |
| 5-6 | Adequate | Acceptable, notable trade-offs |
| 3-4 | Weak | Significant drawbacks |
| 0-2 | Poor | Fundamental issues |

## Composite Formula

```
composite = impact * 0.25 + (10 - effort) * 0.20 + (10 - risk) * 0.20 + alignment * 0.20 + innovation * 0.15
```

## Devil's Advocate Adjustment

| Finding | Adjustment |
|---------|------------|
| 1+ critical concerns | Multiply by 0.70 |
| 3+ high concerns | Multiply by 0.85 |
| No critical/high | No adjustment |

## Example

| Idea | Impact | Effort | Risk | Align | Innov | Raw | DA | Final |
|------|--------|--------|------|-------|-------|-----|-----|-------|
| JWT+Redis | 8 | 4 | 3 | 9 | 6 | 7.65 | 0 | **7.65** |
| Session-only | 6 | 2 | 2 | 8 | 3 | 7.05 | 0 | **7.05** |
| Custom tokens | 9 | 8 | 7 | 5 | 9 | 5.55 | 1 crit | **3.89** |
