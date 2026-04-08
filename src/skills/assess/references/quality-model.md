# Quality Model (assess)

Uses the unified scoring framework with 7 base dimensions (no Visual).

> **Canonical source**: `quality-gates/references/unified-scoring-framework.md`
> Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/quality-gates/references/unified-scoring-framework.md")`

## assess-Specific Overrides

**Simplicity dimension:** Activate when the user is comparing alternatives, evaluating design options, or assessing refactoring approaches. Skip for single-implementation reviews where there's nothing to compare against.

## Dimensions Used

### Default Mode (single implementation review)

| Dimension | Weight |
|-----------|--------|
| Correctness | 0.15 |
| Maintainability | 0.15 |
| Performance | 0.12 |
| Security | 0.20 |
| Scalability | 0.10 |
| Testability | 0.13 |
| Compliance | 0.15 |

### Comparison Mode (design alternatives, refactoring options)

| Dimension | Weight |
|-----------|--------|
| Correctness | 0.14 |
| Maintainability | 0.14 |
| Performance | 0.11 |
| Security | 0.18 |
| Scalability | 0.09 |
| Testability | 0.12 |
| Compliance | 0.12 |
| **Simplicity** | **0.10** |

Activate Comparison Mode when the user asks "which is better", "compare these", "should we refactor", or is evaluating multiple approaches. See unified framework for Simplicity scoring guide.

See unified framework for grade thresholds, improvement prioritization, effort/impact scales, and blocking rules.
