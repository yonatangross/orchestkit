---
title: Statistics Cheat Sheet for Product Analysts
---

# Statistics Cheat Sheet

Quick reference for the stats you need to evaluate experiments and make defensible product decisions. Written for PMs — no math degree required.

## p-value

**What it is:** The probability of seeing a result this extreme (or more extreme) if the change had zero true effect.

**How to read it:**
- p = 0.03 → 3% chance the result is random noise → significant at the 5% threshold
- p = 0.10 → 10% chance of noise → NOT significant at the 5% threshold
- p = 0.001 → Very strong signal — only 1-in-1000 chance it's noise

**What it is NOT:** The probability that your change works. p = 0.03 does not mean "97% confident the feature is good." It means "3% chance this result is a false positive."

**Threshold:** Use p < 0.05 as the standard bar. For high-stakes decisions (pricing, major flows), consider p < 0.01.

## Confidence Intervals

**What it is:** A range where the true effect probably lives, given your data.

**Formula (proportion difference):**
```
CI = lift ± Z * sqrt(p1*(1-p1)/n1 + p2*(1-p2)/n2)

Where:
  lift = p2 - p1
  Z    = 1.96 for 95% CI
  n1, n2 = sample sizes
  p1, p2 = observed conversion rates
```

**How to read it:**
- "Lift = +8%, 95% CI [+2%, +14%]" → confident the true lift is between 2% and 14%, ship it
- "Lift = +5%, 95% CI [-1%, +11%]" → CI includes zero, cannot claim a win, extend or kill
- "Lift = +3%, 95% CI [+2.8%, +3.2%]" → tight CI, statistically significant but practically tiny

**Rule:** If the CI includes zero, do not ship based on this experiment.

## Sample Size Calculator

```
n = 2 * (Z_alpha/2 + Z_beta)^2 * p_bar * (1 - p_bar) / delta^2

Where:
  Z_alpha/2  = 1.96  (95% confidence)
  Z_beta     = 0.84  (80% power)
  p_bar      = (p1 + p2) / 2  ≈ baseline rate
  delta      = absolute difference you want to detect (MDE)
```

**Worked example:**
```
Baseline rate: 10% (p1 = 0.10)
MDE: 2pp absolute lift (p2 = 0.12, delta = 0.02)
p_bar = (0.10 + 0.12) / 2 = 0.11

n = 2 * (1.96 + 0.84)^2 * 0.11 * 0.89 / 0.02^2
n = 2 * 7.84 * 0.0979 / 0.0004
n ≈ 3,834 per variant = 7,668 total
```

**Quick lookup table (p < 0.05, 80% power):**
| Baseline | Relative MDE | n per variant |
|----------|-------------|---------------|
| 5%  | 20% (1pp)   | ~14,700 |
| 10% | 10% (1pp)   | ~29,400 |
| 10% | 20% (2pp)   | ~7,600  |
| 20% | 10% (2pp)   | ~14,200 |
| 30% | 10% (3pp)   | ~9,000  |
| 50% | 5%  (2.5pp) | ~6,200  |

## Effect Size (Cohen's d and Relative Lift)

**Cohen's d** — for comparing means (time-on-page, revenue per user):
```
d = (mean_treatment - mean_control) / pooled_std_dev

Interpretation:
  d < 0.2  = small effect
  d = 0.5  = medium effect
  d > 0.8  = large effect
```

**Relative lift** — for comparing rates (conversion, retention):
```
Relative lift = (treatment_rate - control_rate) / control_rate * 100%

Example: control = 10%, treatment = 12%
Relative lift = (12% - 10%) / 10% = 20% relative lift
Absolute lift = 12% - 10% = 2pp absolute lift
```

Always report both relative and absolute lift. Relative lift sounds bigger; absolute lift is what matters for revenue math.

## Common Statistical Tests

| Situation | Test | Tool |
|-----------|------|------|
| Comparing two conversion rates | Two-proportion z-test | statsig.com, Evan Miller's calculator |
| Comparing means (revenue, time) | Welch's t-test | scipy.stats.ttest_ind |
| Comparing multiple variants (>2) | Chi-square or ANOVA | statsig.com, R |
| Checking for SRM (assignment bias) | Chi-square goodness-of-fit | Manual or statsig.com |
| Small sample (< 30 per group) | Fisher's exact test | scipy.stats.fisher_exact |

**SRM check:**
```
Expected per variant: total_users / num_variants
Chi-square = sum((observed - expected)^2 / expected)
Degrees of freedom = num_variants - 1
p < 0.001 = SRM detected — do not interpret results
```

## Power Analysis

Power = the probability of detecting a real effect when it exists. Standard target: 80%.

**Increasing power without more traffic:**
- Raise MDE (accept that you will only detect larger effects)
- Reduce alpha to 0.10 (accept more false positives — usually not worth it)
- Use a more sensitive metric (e.g., checkout starts instead of purchases)
- Use CUPED variance reduction if you have pre-experiment data

**Reducing required sample size:**
- Increase MDE threshold (only test if you expect a meaningful lift)
- Target a more homogeneous segment (reduces variance)
- Use one-tailed test ONLY if the direction is pre-specified and you will kill on any negative result

## Key Numbers to Remember

| Concept | Value |
|---------|-------|
| Standard confidence threshold | p < 0.05 |
| Standard power target | 80% |
| Z-score for 95% CI | 1.96 |
| Z-score for 99% CI | 2.58 |
| Minimum experiment runtime | 2 full business cycles |
| SRM p-value threshold | p < 0.001 = broken |
| Novelty effect buffer | Week 1 data often inflated — run 2+ weeks |
