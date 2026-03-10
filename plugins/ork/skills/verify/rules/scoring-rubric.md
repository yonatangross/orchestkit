---
title: "Scoring Rubric"
impact: HIGH
impactDescription: "Inconsistent scoring across dimensions makes composite scores unreliable and incomparable"
tags: verification, scoring, rubric, quality-dimensions
---

# Scoring Rubric

## Composite Score

Each agent produces a 0-10 score with decimals for nuance. The composite score is a weighted sum using the weights from [Quality Model](../references/quality-model.md).

## Grade Thresholds

<!-- Canonical source: ../references/quality-model.md — keep in sync -->

| Grade | Score Range | Verdict |
|-------|-------------|---------|
| A+ | 9.0-10.0 | EXCELLENT |
| A | 8.0-8.9 | READY FOR MERGE |
| B | 7.0-7.9 | READY FOR MERGE |
| C | 6.0-6.9 | IMPROVEMENTS RECOMMENDED |
| D | 5.0-5.9 | IMPROVEMENTS RECOMMENDED |
| F | 0.0-4.9 | BLOCKED |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scoring scale | 0-10 with decimals | Nuanced, not binary |
| Improvement priority | Impact / Effort ratio | Do high-value first |
| Alternative comparison | Optional phase | Only when multiple valid approaches |
| Metrics persistence | Memory MCP | Track trends over time |

**Incorrect:**
```
Security: "looks fine"  → 8/10    # No evidence, subjective
Performance: "fast enough" → 7/10  # No benchmarks
```

**Correct:**
```
Security: "11/11 injection tests pass, 13 deny patterns, 0 CVEs" → 9/10
Performance: "p99 latency 142ms (budget: 300ms), 0 N+1 queries" → 8.5/10
```

## Improvement Suggestions

Each suggestion includes effort (1-5) and impact (1-5) with priority = impact/effort. See [Quality Model](../references/quality-model.md) for scale definitions and quick wins formula.

## Blocking Rules

Verification can be blocked by policy-as-code rules. See [Policy-as-Code](../references/policy-as-code.md) for configuration of composite minimums, dimension minimums, and blocking rules.
