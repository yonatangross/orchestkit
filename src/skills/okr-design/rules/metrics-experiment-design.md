---
title: Design experiments with structured hypotheses, guardrail metrics, and staged rollout plans
impact: HIGH
impactDescription: "Ensures feature launches use rigorous experiment design with guardrail metrics to prevent regressions"
tags: experiment, hypothesis, guardrail, a-b-testing, rollout
---

# Experiment Design & Guardrail Metrics

Structured experiment patterns extracted from metrics architecture practice. Complements the basic experiment template in `metrics-instrumentation` with deeper guardrail and rollout patterns.

## Experiment Design Template

```markdown
## Experiment: [Name]

### Hypothesis
If we [change], then [metric] will [direction] by [amount]
because [reasoning based on evidence].

### Metrics
- **Primary:** [The metric you are trying to move]
- **Secondary:** [Supporting metrics that add context]
- **Guardrails:** [Metrics that MUST NOT degrade -- see below]

### Design
- **Type:** A/B test | multivariate | feature flag rollout
- **Sample size:** [N per variant, calculated for statistical power]
- **Duration:** [Minimum weeks to reach significance]
- **Segments:** [User cohorts to analyze separately]

### Success Criteria
- Primary metric improves by >= [X]% with p < 0.05
- No guardrail metric degrades by > [threshold]
- Secondary metrics trend positive or neutral

### Rollout Plan
1. **10%** -- 1 week canary, monitor guardrails daily
2. **50%** -- 2 weeks, confirm statistical significance
3. **100%** -- full rollout with continued monitoring
```

## Guardrail Metrics Pattern

Guardrails prevent shipping a "win" that causes hidden damage. Every experiment must define guardrails before launch.

### Performance Guardrails

| Guardrail | Threshold | Alert Action |
|-----------|-----------|--------------|
| Page load time (p95) | Must not increase > 200ms | Auto-pause experiment |
| API error rate | Must stay < 0.5% | Page on-call |
| Client crash rate | Must stay < baseline + 0.1% | Kill switch |

### Business Guardrails

| Guardrail | Threshold | Alert Action |
|-----------|-----------|--------------|
| Conversion rate | Must not drop > 2% relative | Escalate to PM |
| Support ticket volume | Must not increase > 10% | Review UX |
| Revenue per user | Must not decrease | Escalate to leadership |

### Alert Threshold Template

```markdown
## Guardrail: [Metric Name]

- **Baseline:** [Current value over last 30 days]
- **Warning:** [X% degradation from baseline]
- **Critical:** [Y% degradation -- auto-pause experiment]
- **Owner:** [Team or person who responds]
- **Response SLA:** Warning = 24h, Critical = 1h
```

## North Star Metric Framework

Distinguish between input metrics (actionable, leading) and output metrics (outcome, lagging). Experiments should target input metrics while guarding output metrics.

```
Output (North Star): Weekly Active Teams
    |
    +-- Input: New team signups (acquisition)
    +-- Input: Teams completing onboarding (activation)
    +-- Input: Features used per team/week (engagement)
    +-- Input: Teams inviting members (virality)
    +-- Input: Teams upgrading to paid (monetization)
```

### Experiment Targeting

- **Target input metrics** -- they are directly actionable
- **Guard output metrics** -- they confirm the input metric change translates to real value
- **Monitor adjacent inputs** -- ensure one input improvement does not cannibalize another

## Pre-Launch Checklist

- [ ] Hypothesis documented with expected effect size
- [ ] Primary, secondary, and guardrail metrics defined
- [ ] Sample size calculated for minimum detectable effect
- [ ] Staged rollout plan with kill criteria at each stage
- [ ] Dashboard or alerts configured for guardrail metrics
- [ ] Rollback procedure documented

**Incorrect -- launching without guardrails:**
```markdown
Experiment: New checkout flow
Hypothesis: Will increase conversions
Plan: Ship to 100% of users on Monday
Success: Conversions go up
```

**Correct -- structured experiment with guardrails:**
```markdown
Experiment: New checkout flow
Hypothesis: Reducing steps from 4 to 2 will increase
  checkout completion by 15% because 60% of users
  drop off between steps 2 and 3.
Primary: Checkout completion rate
Guardrails: Revenue per transaction, refund rate, page load p95
Rollout: 10% for 1 week, 50% for 2 weeks, 100%
Kill criteria: Any guardrail degrades > 5% relative
```
