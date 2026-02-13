---
title: "Metrics: Leading & Lagging Indicators"
category: metrics
impact: HIGH
---

# Leading & Lagging Indicators

Understanding the difference is crucial for effective measurement.

## Definitions

| Type | Definition | Characteristics |
|------|------------|-----------------|
| **Leading** | Predictive, can be directly influenced | Real-time feedback, actionable |
| **Lagging** | Results of past actions | Confirms outcomes, hard to change |

## Examples by Domain

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

## The Leading-Lagging Chain

```
Leading                                           Lagging
----------------------------------------------------------->

Blog posts    Website     MQLs      SQLs      Deals     Revenue
published  -> traffic  -> generated -> created -> closed -> booked
   |            |           |          |         |         |
   v            v           v          v         v         v
 Actionable  Actionable   Somewhat   Less      Hard      Result
             (SEO, ads)   (content)  control   control
```

## Balanced Metrics Dashboard

### Leading Indicators (Weekly Review)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Active users (DAU) | 12,500 | 15,000 | Yellow |
| Feature adoption rate | 68% | 75% | Yellow |
| Support ticket volume | 142 | <100 | Red |
| NPS responses collected | 89 | 100 | Green |

### Lagging Indicators (Monthly Review)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Monthly revenue | $485K | $500K | Yellow |
| Customer churn | 5.2% | <5% | Yellow |
| NPS score | 42 | 50 | Green |
| CAC payback months | 14 | 12 | Red |

## Using Both Effectively

### Pair Leading with Lagging

For every lagging indicator you care about, identify 2-3 leading indicators that predict it.

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

### Review Cadence

| Indicator Type | Review Frequency | Action Timeline |
|----------------|------------------|-----------------|
| Leading | Daily/Weekly | Immediate course correction |
| Lagging | Monthly/Quarterly | Strategic adjustments |

## Best Practices

- **Start with the lagging metric** you want to improve
- **Identify 2-3 leading indicators** that predict it
- **Set up automated dashboards** for leading indicators
- **Review leading indicators weekly** with the team
- **Use lagging indicators** to validate that leading indicators actually predict outcomes
- **Adjust leading indicators** when correlation breaks down
