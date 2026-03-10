---
name: product-analytics
license: MIT
compatibility: "Claude Code 2.1.72+."
description: "A/B test evaluation, cohort retention analysis, funnel metrics, and experiment-driven product decisions. Use when analyzing experiments, measuring feature adoption, diagnosing conversion drop-offs, or evaluating statistical significance of product changes."
tags: [ab-test, cohort, retention, funnel, conversion, analytics, experiment, statistical-significance]
context: fork
agent: product-strategist
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Product Analytics

Frameworks for turning raw product data into ship/extend/kill decisions. Covers A/B testing, cohort retention, funnel analysis, and the statistical foundations needed to make those decisions with confidence.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [A/B Test Evaluation](#ab-test-evaluation) | 1 | HIGH | Comparing variants, measuring significance, shipping decisions |
| [Cohort Retention](#cohort-retention) | 1 | HIGH | Feature adoption curves, day-N retention, engagement scoring |
| [Funnel Analysis](#funnel-analysis) | 1 | HIGH | Drop-off diagnosis, conversion optimization, stage mapping |
| [Statistical Foundations](#statistical-foundations) | 1 | HIGH | p-value interpretation, sample sizing, confidence intervals |

**Total: 4 rules across 4 categories**

## A/B Test Evaluation

Load `rules/ab-test-evaluation.md` for the full framework. Quick pattern:

```markdown
## Experiment: [Name]

Hypothesis: If we [change], then [primary metric] will [direction] by [amount]
  because [evidence or reasoning].

Sample size: [N per variant] — calculated for MDE=[X%], power=80%, alpha=0.05
Duration: [Minimum weeks] — never stop early (peeking bias)

Results:
  Control:   [metric value]  n=[count]
  Treatment: [metric value]  n=[count]
  Lift:      [+/- X%]        p=[value]  95% CI: [lower, upper]

Decision: SHIP / EXTEND / KILL
  Rationale: [One sentence grounded in numbers, not gut feel]
```

**Decision rules:**
- **SHIP** — p < 0.05, CI excludes zero, no guardrail regressions
- **EXTEND** — trending positive but underpowered (add runtime, not reanalysis)
- **KILL** — null result or guardrail degradation

See `rules/ab-test-evaluation.md` for sample size formulas, SRM checks, and pitfall list.

## Cohort Retention

Load `rules/cohort-retention.md` for full methodology. Quick pattern:

```sql
-- Day-N retention cohort query
SELECT
  DATE_TRUNC('week', first_seen)  AS cohort_week,
  COUNT(DISTINCT user_id)         AS cohort_size,
  COUNT(DISTINCT CASE
    WHEN activity_date = first_seen + INTERVAL '7 days'
    THEN user_id END) * 100.0
    / COUNT(DISTINCT user_id)     AS day_7_retention
FROM user_activity
GROUP BY 1
ORDER BY 1;
```

**Retention benchmarks (SaaS):**
- Day 1: 40–60% is healthy
- Day 7: 20–35% is healthy
- Day 30: 10–20% is healthy
- Flat curve after day 30 = product-market fit signal

See `rules/cohort-retention.md` for behavior-based cohorts, feature adoption curves, and engagement scoring.

## Funnel Analysis

Load `rules/funnel-analysis.md` for full methodology. Quick pattern:

```markdown
## Funnel: [Name] — [Date Range]

Stage 1: [Aware / Land]     → [N] users    (entry)
Stage 2: [Activate / Sign]  → [N] users    ([X]% from stage 1)
Stage 3: [Engage / Use]     → [N] users    ([X]% from stage 2)  ← biggest drop
Stage 4: [Convert / Pay]    → [N] users    ([X]% from stage 3)

Overall conversion: [X]%
Biggest drop-off:  Stage 2→3 ([X]% loss) — investigate first
```

**Optimization order:** Fix the largest drop-off first. A 5-point improvement at a high-volume step is worth more than a 20-point improvement at a low-volume step.

See `rules/funnel-analysis.md` for segmented funnels, micro-conversion tracking, and prioritization patterns.

## Statistical Foundations

Plain-English explanations of the stats every PM needs. Load `references/stats-cheat-sheet.md` for formulas and quick lookups.

**p-value in plain English:** The probability that you would see a result this extreme (or more extreme) if the change had zero effect. p=0.03 means a 3% chance you're looking at random noise. It does NOT mean "97% probability the change works."

**Confidence interval in plain English:** The range where the true effect probably lives. "Lift = +8%, 95% CI [+2%, +14%]" means you are fairly confident the real lift is somewhere between 2% and 14%. If the CI includes zero, you cannot claim a win.

**Minimum Detectable Effect (MDE):** The smallest lift you care about detecting. Setting MDE too small forces impractically large sample sizes. Anchor MDE to business value — if a 2% lift is not worth shipping, set MDE = 5%.

**Statistical vs practical significance:** A result can be statistically significant (p < 0.05) but practically meaningless (lift = 0.01%). Always check both. A 0.01% lift that costs 6 weeks of eng time is not a win.

## Common Pitfalls

1. **Peeking** — stopping an experiment early because results look good inflates false-positive rate. Commit to a runtime before launch.
2. **Multiple comparisons** — testing 10 metrics at p < 0.05 means ~1 false positive by chance. Apply Bonferroni correction or pre-register your primary metric.
3. **Sample Ratio Mismatch (SRM)** — if variant group sizes differ from expected split by > 1%, your experiment is broken. Fix before analyzing results.
4. **Novelty effect** — new features get inflated engagement in week 1. Run experiments long enough to see settled behavior (minimum 2 full business cycles).
5. **Simpson's paradox** — aggregate results can reverse when segmented. Always check results by key segments (device, plan tier, geography).

## Ship / Extend / Kill Framework

| Signal | Decision | Action |
|--------|----------|--------|
| p < 0.05, CI excludes zero, guardrails green | SHIP | Full rollout, update success metrics |
| Positive trend, underpowered (p = 0.10–0.15) | EXTEND | Add runtime, do not peek again |
| p > 0.15, flat or negative | KILL | Revert, document learnings, re-hypothesize |
| Guardrail regression, any p-value | KILL | Immediate revert regardless of primary metric |
| SRM detected | INVALID | Fix assignment bug, restart experiment |

## Related Skills

- `ork:product-frameworks` — OKRs, KPI trees, RICE prioritization, PRD templates
- `ork:metrics-instrumentation` — Event naming, metric definition, alerting setup
- `ork:brainstorm` — Generate hypotheses and experiment ideas
- `ork:assess` — Evaluate product quality and risks

## References

- `rules/ab-test-evaluation.md` — Hypothesis, sample size, significance, decision matrix
- `rules/cohort-retention.md` — Cohort types, retention curves, SQL patterns
- `rules/funnel-analysis.md` — Stage mapping, drop-off identification, optimization
- `references/stats-cheat-sheet.md` — Formulas, test selection, power analysis

---

**Version:** 1.0.0 (March 2026)
