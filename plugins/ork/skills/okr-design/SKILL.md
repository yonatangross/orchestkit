---
name: okr-design
description: "OKR trees, KPI dashboards, North Star Metric, leading/lagging indicators, and experiment design. Use when setting team goals, defining success metrics, building measurement frameworks, or designing A/B experiment guardrails."
tags: [okr, kpi, north-star, metrics, experiment, goal-setting, leading-lagging, instrumentation]
context: fork
agent: product-strategist
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools: [Read, Glob, Grep, WebFetch, WebSearch]
---

# OKR Design & Metrics Framework

Structure goals, decompose metrics into KPI trees, identify leading indicators, and design rigorous experiments.

## OKR Structure

Objectives are qualitative and inspiring. Key Results are quantitative and outcome-focused — never a list of outputs.

```
Objective: Qualitative, inspiring goal (70% achievable stretch)
+-- Key Result 1: [Verb] [metric] from [baseline] to [target]
+-- Key Result 2: [Verb] [metric] from [baseline] to [target]
+-- Key Result 3: [Verb] [metric] from [baseline] to [target]
```

```markdown
## Q1 OKRs

### Objective: Become the go-to platform for enterprise teams

Key Results:
- KR1: Increase enterprise NPS from 32 to 50
- KR2: Reduce time-to-value from 14 days to 3 days
- KR3: Achieve 95% feature adoption in first 30 days of onboarding
- KR4: Win 5 competitive displacements from [Competitor]
```

### OKR Quality Checks

| Check | Objective | Key Result |
|-------|-----------|------------|
| Has a number | NO | YES |
| Inspiring / energizing | YES | not required |
| Outcome-focused (not "ship X features") | YES | YES |
| 70% achievable (stretch, not sandbagged) | YES | YES |
| Aligned to higher-level goal | YES | YES |

See [references/okr-workshop-guide.md](references/okr-workshop-guide.md) for a full facilitation agenda (3-4 hours, dot voting, finalization template).
See [rules/metrics-okr.md](rules/metrics-okr.md) for pitfalls and alignment cascade patterns.

---

## KPI Tree & North Star

Decompose the top-level metric into components with clear cause-effect relationships.

```
Revenue (Lagging — root)
├── New Revenue = Leads × Conv Rate          (Leading)
├── Expansion   = Users × Upsell Rate        (Leading)
└── Retained    = Existing × (1 - Churn)     (Lagging)
```

### North Star + Input Metrics Template

```markdown
## Metrics Framework

North Star: [One metric that captures core value — e.g., Weekly Active Teams]

Input Metrics (leading, actionable by teams):
1. New signups — acquisition
2. Onboarding completion rate — activation
3. Features used per user/week — engagement
4. Invite rate — virality
5. Upgrade rate — monetization

Lagging Validation (confirm inputs translate to value):
- Revenue growth
- Net retention rate
- Customer lifetime value
```

### North Star Selection by Business Type

| Business | North Star Example | Why |
|----------|--------------------|-----|
| SaaS | Weekly Active Users | Indicates ongoing value delivery |
| Marketplace | Gross Merchandise Value | Captures both buyer and seller sides |
| Media | Time spent | Engagement signals content value |
| E-commerce | Purchase frequency | Repeat = satisfaction |

See [rules/metrics-kpi-trees.md](rules/metrics-kpi-trees.md) for the full revenue and product health KPI tree examples.

---

## Leading vs Lagging Indicators

Every lagging metric you want to improve needs 2-3 leading predictors.

```markdown
## Metric Pairs

Lagging: Customer Churn Rate
Leading:
  1. Product usage frequency (weekly)
  2. Support ticket severity (daily)
  3. NPS score trend (monthly)

Lagging: Revenue Growth
Leading:
  1. Pipeline value (weekly)
  2. Demo-to-trial conversion (weekly)
  3. Feature adoption rate (weekly)
```

| Indicator | Review Cadence | Action Timeline |
|-----------|----------------|-----------------|
| Leading | Daily / Weekly | Immediate course correction |
| Lagging | Monthly / Quarterly | Strategic adjustments |

See [rules/metrics-leading-lagging.md](rules/metrics-leading-lagging.md) for a balanced dashboard template.

---

## Metric Instrumentation

Every metric needs a formal definition before instrumentation.

```markdown
## Metric: Feature Adoption Rate

Definition: % of active users who used [feature] at least once in their first 30 days.
Formula: (Users who triggered feature_activated in first 30 days) / (Users who signed up)
Data Source: Analytics — feature_activated event
Segments: By plan tier, by signup cohort
Calculation: Daily
Review: Weekly

Events:
  user_signed_up  { user_id, plan_tier, signup_source }
  feature_activated { user_id, feature_name, activation_method }
```

Event naming: `object_action` in snake_case — `user_signed_up`, `feature_activated`, `subscription_upgraded`.

See [rules/metrics-instrumentation.md](rules/metrics-instrumentation.md) for the full metric definition template, alerting thresholds, and dashboard design principles.

---

## Experiment Design

Every experiment must define guardrail metrics before launch. Guardrails prevent shipping a "win" that causes hidden damage.

```markdown
## Experiment: [Name]

### Hypothesis
If we [change], then [primary metric] will [direction] by [amount]
because [reasoning based on evidence].

### Metrics
- Primary: [The metric you are trying to move]
- Secondary: [Supporting context metrics]
- Guardrails: [Metrics that MUST NOT degrade — define thresholds]

### Design
- Type: A/B test | multivariate | feature flag rollout
- Sample size: [N per variant — calculated for statistical power]
- Duration: [Minimum weeks to reach significance]

### Rollout Plan
1. 10% — 1 week canary, monitor guardrails daily
2. 50% — 2 weeks, confirm statistical significance
3. 100% — full rollout with continued monitoring

### Kill Criteria
Any guardrail degrades > [threshold]% relative to baseline.
```

### Pre-Launch Checklist

- [ ] Hypothesis documented with expected effect size
- [ ] Primary, secondary, and guardrail metrics defined
- [ ] Sample size calculated for minimum detectable effect
- [ ] Dashboard or alerts configured for guardrail metrics
- [ ] Staged rollout plan with kill criteria at each stage
- [ ] Rollback procedure documented

See [rules/metrics-experiment-design.md](rules/metrics-experiment-design.md) for guardrail thresholds, performance and business guardrail tables, and alert SLAs.

---

## Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| KRs are outputs ("ship 5 features") | Rewrite as outcomes ("increase conversion by 20%") |
| Tracking only lagging indicators | Pair every lagging metric with 2-3 leading predictors |
| No baseline before setting targets | Instrument and measure for 2 weeks before setting OKRs |
| Launching experiments without guardrails | Define guardrails before any code is shipped |
| Too many OKRs (>5 per team) | Limit to 3-5 objectives, 3-5 KRs each |
| Metrics without owners | Every metric needs a team owner |

---

## Related Skills

- `prioritization` — RICE, WSJF, ICE, MoSCoW scoring; OKRs define which KPIs drive RICE impact
- `product-frameworks` — Full PM toolkit: value prop, competitive analysis, user research, business case
- `product-analytics` — Instrument and query the metrics defined in OKR trees
- `prd` — Embed success metrics and experiment hypotheses into product requirements
- `market-sizing` — TAM/SAM/SOM that anchors North Star Metric targets
- `competitive-analysis` — Competitor benchmarks that inform KR targets

---

**Version:** 1.0.0
