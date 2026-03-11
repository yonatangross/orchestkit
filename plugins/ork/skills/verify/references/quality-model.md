# Quality Model (verify)

Extends the unified scoring framework with Visual as the 8th dimension.

> **Canonical source**: `quality-gates/references/unified-scoring-framework.md`
> Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/quality-gates/references/unified-scoring-framework.md")`

## verify-Specific Extensions

### Visual Dimension (8th)

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Visual | 0.10 | Layout correctness, a11y, content completeness, responsiveness |

When Visual is active, base dimensions scale: `adjusted = base_weight * (1.0 / 1.10)`.
When Visual is skipped (API-only), base weights stay at 1.00.

## Dimensions Used (with Visual)

| Dimension | Adjusted Weight |
|-----------|----------------|
| Correctness | 0.14 |
| Maintainability | 0.14 |
| Performance | 0.11 |
| Security | 0.18 |
| Scalability | 0.09 |
| Testability | 0.12 |
| Compliance | 0.12 |
| Visual | 0.10 |

See unified framework for grade thresholds, improvement prioritization, effort/impact scales, and blocking rules.
