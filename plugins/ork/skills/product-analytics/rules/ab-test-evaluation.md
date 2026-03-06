---
title: A/B Test Evaluation — From Hypothesis to Ship Decision
impact: HIGH
impactDescription: "Without structured evaluation, teams ship inconclusive experiments or make decisions on p-hacking and gut feel, wasting eng cycles and misleading roadmaps."
tags: ab-test, statistical-significance, hypothesis, sample-size, experiment, p-value
---

# A/B Test Evaluation

Structure every experiment from hypothesis through decision using the framework below. The goal is not to "prove" your idea works — it is to learn whether it works.

## 1. Hypothesis Formulation

A testable hypothesis has three parts: the change, the expected outcome, and the reasoning.

**Template:**
```markdown
If we [specific change to UI/flow/algorithm],
then [primary metric] will [increase/decrease] by [X%]
because [evidence: user research, prior data, theory].
```

**Incorrect — vague, untestable:**
```markdown
Hypothesis: The new onboarding flow will improve retention.
```

**Correct — specific and falsifiable:**
```markdown
Hypothesis: If we reduce onboarding from 8 steps to 4 steps,
then day-7 retention will increase by 10%
because exit surveys show 40% of churned users cite setup complexity.
```

**Key rules:**
- One primary metric per experiment. Secondary metrics are informational.
- Root the reasoning in evidence, not optimism.
- Set guardrail metrics BEFORE launch (revenue, error rate, latency).

## 2. Sample Size Calculation

Never start an experiment without knowing how large your sample needs to be. Underpowered experiments produce inconclusive results that waste time.

**Formula (two-proportion z-test):**
```
n = 2 * (Z_alpha/2 + Z_beta)^2 * p * (1 - p) / MDE^2

Where:
  Z_alpha/2 = 1.96  (95% confidence, two-tailed)
  Z_beta    = 0.84  (80% statistical power)
  p         = baseline conversion rate (decimal)
  MDE       = minimum detectable effect (decimal)
```

**Quick lookup — sample size per variant:**
| Baseline | MDE | n per variant |
|----------|-----|---------------|
| 5%       | 20% relative (1pp) | ~14,700 |
| 10%      | 10% relative (1pp) | ~29,400 |
| 30%      | 10% relative (3pp) |  ~4,900 |
| 50%      | 5%  relative (2.5pp)| ~6,200 |

**Incorrect — launching without sample size calculation:**
```markdown
Plan: Run for 1 week, check results Friday.
```

**Correct — calculated runtime:**
```markdown
Baseline signup rate: 8%
MDE: 15% relative lift (1.2pp) — smallest lift worth shipping
Required n: ~17,500 per variant
Daily traffic to page: 2,500 users
Runtime needed: ~7 days per variant = 14 days total
Decision point: [date] — do not analyze before then.
```

## 3. Statistical Significance Check

After reaching your pre-planned sample size, evaluate results exactly once.

**Significance criteria (all three must hold):**
1. p < 0.05 (5% false-positive tolerance)
2. 95% confidence interval excludes zero
3. No guardrail metric degrades beyond its threshold

**Reading results:**
```markdown
Control:   8.0% conversion   n=17,600
Treatment: 9.4% conversion   n=17,500
Lift:      +17.5% relative   (+1.4pp absolute)
p-value:   0.003
95% CI:    [+0.5pp, +2.3pp]

Interpretation: Statistically significant positive result.
  The CI excludes zero. Practical significance: YES — 1.4pp
  at current volume = ~350 extra signups/month.
```

## 4. Practical vs Statistical Significance

A result can be statistically significant but practically meaningless. Always evaluate both.

**Test:** "If we shipped this lift, would it justify the maintenance cost and opportunity cost of not building something else?"

| Result | p-value | Lift | Practical? | Decision |
|--------|---------|------|------------|----------|
| +12% conversion | 0.001 | Large | YES | SHIP |
| +0.3% conversion | 0.04 | Negligible | NO | KILL (not worth it) |
| +8% conversion | 0.12 | Large | YES | EXTEND (underpowered) |
| -2% conversion | 0.001 | Negative | YES (bad) | KILL |

## 5. Common Pitfalls

**Peeking** — checking results mid-experiment and stopping when p < 0.05 inflates false-positive rate from 5% to ~30% or more. Commit to a runtime before launch and do not analyze early.

**Multiple comparisons** — running the same experiment on 10 segments and claiming significance for whichever one hits p < 0.05 is p-hacking. Pre-register your primary metric and primary segment. Apply Bonferroni correction if you must test multiple segments: use p < 0.05/N where N is the number of comparisons.

**Sample Ratio Mismatch (SRM)** — if your 50/50 split produces 17,600 control and 15,200 treatment, the assignment mechanism is broken. Do not interpret results. Chi-square test for SRM: `chi2 = (observed_n - expected_n)^2 / expected_n` for each cell. p < 0.001 = SRM.

**Incorrect — peeking pattern:**
```markdown
Day 3: p=0.12 — not yet
Day 5: p=0.08 — getting closer
Day 7: p=0.04 — SHIP IT
```

**Correct — fixed horizon:**
```markdown
Pre-planned decision date: [date]
Analyze once on [date].
Result: p=0.04 — SHIP (per pre-registered criteria).
```

## 6. Decision Matrix

| Condition | Decision | Action |
|-----------|----------|--------|
| p < 0.05, CI excludes 0, guardrails green, practical lift | SHIP | Full rollout |
| p = 0.06–0.15, positive trend, underpowered | EXTEND | Add runtime only — do not peek again |
| p > 0.15, flat or negative trend | KILL | Revert, document learnings |
| Guardrail regression (any p-value) | KILL | Immediate revert |
| SRM detected | INVALID | Fix assignment, restart |
| p < 0.05, statistically significant but trivial lift | KILL | Not worth shipping cost |

**Key rules:**
- Commit to decision criteria BEFORE the experiment starts.
- A "no result" is a valid and valuable learning — it eliminates a hypothesis.
- Document every experiment outcome in your experiment log regardless of result.
- Never run the same experiment again without changing the hypothesis.
