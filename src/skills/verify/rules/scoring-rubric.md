# Scoring Rubric

## Composite Score

Each agent produces a 0-10 score with decimals for nuance. The composite score is a weighted sum using the weights from [Quality Model](../references/quality-model.md).

## Grade Thresholds

| Grade | Score Range | Verdict |
|-------|-------------|---------|
| A | 9.0-10.0 | READY FOR MERGE |
| B | 7.0-8.9 | READY FOR MERGE |
| C | 5.0-6.9 | IMPROVEMENTS RECOMMENDED |
| D | 3.0-4.9 | BLOCKED |
| F | 0.0-2.9 | BLOCKED |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scoring scale | 0-10 with decimals | Nuanced, not binary |
| Improvement priority | Impact / Effort ratio | Do high-value first |
| Alternative comparison | Optional phase | Only when multiple valid approaches |
| Metrics persistence | Memory MCP | Track trends over time |

## Improvement Suggestions

Each suggestion includes effort (1-5) and impact (1-5) with priority = impact/effort. See [Quality Model](../references/quality-model.md) for scale definitions and quick wins formula.

## Blocking Rules

Verification can be blocked by policy-as-code rules. See [Policy-as-Code](../references/policy-as-code.md) for configuration of composite minimums, dimension minimums, and blocking rules.
