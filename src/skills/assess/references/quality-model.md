# Quality Model (assess)

Uses the unified scoring framework with 7 base dimensions (no Visual).

> **Canonical source**: `quality-gates/references/unified-scoring-framework.md`
> Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/quality-gates/references/unified-scoring-framework.md")`

## assess-Specific Overrides

None. Uses base 7 dimensions at base weights (total = 1.00).

## Dimensions Used

| Dimension | Weight |
|-----------|--------|
| Correctness | 0.15 |
| Maintainability | 0.15 |
| Performance | 0.12 |
| Security | 0.20 |
| Scalability | 0.10 |
| Testability | 0.13 |
| Compliance | 0.15 |

See unified framework for grade thresholds, improvement prioritization, effort/impact scales, and blocking rules.
