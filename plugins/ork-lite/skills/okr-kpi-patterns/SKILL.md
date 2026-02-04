---
name: okr-kpi-patterns
description: OKR framework, KPI trees, leading/lagging indicators, and success metrics patterns. Use when defining goals, measuring outcomes, or building measurement frameworks.
context: fork
agent: metrics-architect
version: 1.0.0
tags: [product, metrics, okr, kpi, goals, measurement, 2026]
author: OrchestKit
user-invocable: false
---

# OKR & KPI Patterns

Frameworks for defining goals, measuring success, and building metrics-driven organizations.

## OKR Framework

Objectives and Key Results align teams around ambitious goals with measurable outcomes.

### OKR Structure

```
Objective: Qualitative, inspiring goal
├── Key Result 1: Quantitative measure of progress
├── Key Result 2: Quantitative measure of progress
└── Key Result 3: Quantitative measure of progress
```

### Writing Good Objectives

| Characteristic | Good | Bad |
|---------------|------|-----|
| Qualitative | "Delight enterprise customers" | "Increase NPS to 50" |
| Inspiring | "Become the go-to platform" | "Ship 10 features" |
| Time-bound | Implied quarterly | Vague timeline |
| Ambitious | Stretch goal (70% achievable) | Sandbagged (100% easy) |

### Writing Good Key Results

| Characteristic | Good | Bad |
|---------------|------|-----|
| Quantitative | "Reduce churn from 8% to 4%" | "Improve retention" |
| Measurable | "Ship to 10,000 beta users" | "Launch beta" |
| Outcome-focused | "Increase conversion by 20%" | "Add 5 features" |
| Leading indicators | "Weekly active users reach 50K" | "Revenue hits $1M" (lagging) |

### OKR Example

```markdown
## Q1 2026 OKRs

### Objective 1: Become the #1 choice for enterprise teams

**Key Results:**
- KR1: Increase enterprise NPS from 32 to 50
- KR2: Reduce time-to-value from 14 days to 3 days
- KR3: Achieve 95% feature adoption in first 30 days
- KR4: Win 5 competitive displacements from [Competitor]

### Objective 2: Build a world-class engineering culture

**Key Results:**
- KR1: Reduce deploy-to-production time from 4 hours to 15 minutes
- KR2: Achieve 90% code coverage on critical paths
- KR3: Zero P0 incidents lasting longer than 30 minutes
- KR4: Engineering satisfaction score reaches 4.5/5
```

## Leading vs. Lagging Indicators

Understanding the difference is crucial for effective measurement.

### Definitions

| Type | Definition | Characteristics |
|------|------------|-----------------|
| **Leading** | Predictive, can be directly influenced | Real-time feedback, actionable |
| **Lagging** | Results of past actions | Confirms outcomes, hard to change |

### Examples by Domain

```
Sales Pipeline:
  Leading: # of qualified meetings this week
  Lagging: Quarterly revenue

Customer Success:
  Leading: Product usage frequency
  Lagging: Customer churn rate

Engineering:
  Leading: Code review turnaround time
  Lagging: Production incidents

Marketing:
  Leading: Website traffic, MQLs
  Lagging: Customer acquisition cost (CAC)
```

### The Leading-Lagging Chain

```
Leading                                           Lagging
─────────────────────────────────────────────────────────►

Blog posts    Website     MQLs      SQLs      Deals     Revenue
published  →  traffic  →  generated → created → closed → booked
   │            │           │          │         │         │
   ▼            ▼           ▼          ▼         ▼         ▼
 Actionable  Actionable   Somewhat   Less      Hard      Result
             (SEO, ads)   (content)  control   control
```

### Using Both Effectively

```markdown
## Balanced Metrics Dashboard

### Leading Indicators (Weekly Review)
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Active users (DAU) | 12,500 | 15,000 | 🟡 |
| Feature adoption rate | 68% | 75% | 🟡 |
| Support ticket volume | 142 | <100 | 🔴 |
| NPS responses collected | 89 | 100 | 🟢 |

### Lagging Indicators (Monthly Review)
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Monthly revenue | $485K | $500K | 🟡 |
| Customer churn | 5.2% | <5% | 🟡 |
| NPS score | 42 | 50 | 🟢 |
| CAC payback months | 14 | 12 | 🔴 |
```

## KPI Trees

Hierarchical breakdown of metrics showing cause-effect relationships.

### Revenue KPI Tree

```
                         Revenue
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
     New Revenue      Expansion         Retained
          │            Revenue           Revenue
          │                │                 │
    ┌─────┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐
    │           │    │           │    │           │
  Leads ×    Conv  Users ×   Upsell  Existing × (1-Churn)
  Rate       Rate   ARPU      Rate    Revenue     Rate
```

### Product Health KPI Tree

```
                    Product Health Score
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    Engagement          Retention         Satisfaction
         │                  │                  │
    ┌────┴────┐       ┌────┴────┐       ┌────┴────┐
    │         │       │         │       │         │
   DAU/     Time    Day 1    Day 30    NPS    Support
   MAU      in App  Retention Retention       Tickets
```

## North Star Metric

One metric that captures core value delivery.

### Examples by Business Type

| Business Type | North Star Metric | Why |
|---------------|-------------------|-----|
| SaaS | Weekly Active Users | Indicates ongoing value |
| Marketplace | Gross Merchandise Value | Captures both sides |
| Media | Time spent reading | Engagement = value |
| E-commerce | Purchase frequency | Repeat = satisfied |
| Fintech | Assets under management | Trust + usage |

### North Star + Input Metrics

```markdown
## Our North Star Framework

**North Star:** Weekly Active Teams (WAT)

**Input Metrics:**
1. New team signups (acquisition)
2. Teams completing onboarding (activation)
3. Features used per team per week (engagement)
4. Teams inviting new members (virality)
5. Teams on paid plans (monetization)

**Lagging Validation:**
- Revenue growth
- Net retention rate
- Customer lifetime value
```

## Metric Definition Template

```markdown
## Metric: [Name]

### Definition
[Precise definition of what this metric measures]

### Formula
```
Metric = Numerator / Denominator
```

### Data Source
- System: [Where data comes from]
- Table/Event: [Specific location]
- Owner: [Team responsible]

### Segments
- By customer tier (Free, Pro, Enterprise)
- By geography (NA, EMEA, APAC)
- By cohort (signup month)

### Frequency
- Calculation: Daily
- Review: Weekly

### Targets
| Period | Target | Stretch |
|--------|--------|---------|
| Q1 | 10,000 | 12,000 |
| Q2 | 15,000 | 18,000 |

### Related Metrics
- Leading: [Metric that predicts this]
- Lagging: [Metric this predicts]
```

## Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Vanity metrics | Focus on metrics that drive decisions |
| Too many KPIs | Limit to 5-7 per team |
| Gaming metrics | Pair metrics that balance each other |
| Lagging only | Include leading indicators for early signals |
| No baselines | Establish current state before setting targets |
| Static goals | Review and adjust quarterly |

## 2026 Best Practices

- **OKRs for goals, KPIs for health**: Use together, not interchangeably
- **Leading indicator focus**: Key Results should be leading indicators
- **Cascade with autonomy**: Align outcomes, let teams choose their path
- **Regular calibration**: Weekly check-ins on leading, monthly on lagging
- **AI-assisted insights**: Use AI to detect anomalies and suggest actions

## Related Skills

- `product-strategy-frameworks` - Strategic context for metrics
- `business-case-analysis` - Financial metrics and ROI
- `prioritization-frameworks` - Using metrics to prioritize

## References

- [OKR Workshop Guide](references/okr-workshop-guide.md)
- [KPI Tree Builder](references/kpi-tree-builder.md)

**Version:** 1.0.0 (January 2026)
