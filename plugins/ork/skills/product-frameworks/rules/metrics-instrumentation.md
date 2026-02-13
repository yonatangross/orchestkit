---
title: "Metrics: Instrumentation & Definition"
category: metrics
impact: HIGH
---

# Metric Instrumentation & Definition

Formal patterns for defining, implementing, and monitoring KPIs.

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

## Event Naming Conventions

### Standard Format

```
[object]_[action]

Examples:
- user_signed_up
- feature_activated
- subscription_upgraded
- search_performed
- export_completed
```

### Required Properties

```json
{
  "event": "feature_activated",
  "timestamp": "2026-02-13T10:30:00Z",
  "user_id": "usr_123",
  "properties": {
    "feature_name": "advanced_search",
    "plan_tier": "pro",
    "activation_method": "onboarding_wizard"
  }
}
```

## Instrumentation Checklist

### Events
- [ ] Key events identified
- [ ] Event naming consistent (object_action)
- [ ] Required properties defined
- [ ] Optional properties listed
- [ ] Privacy considerations addressed

### Implementation
- [ ] Analytics tool selected
- [ ] Events documented
- [ ] Engineering ticket created
- [ ] QA plan for events

## Alerting Thresholds

```markdown
## Alert: [Metric Name]

| Threshold | Severity | Action |
|-----------|----------|--------|
| < Warning | Warning | Investigate within 24 hours |
| < Critical | Critical | Immediate escalation |
| > Spike | Info | Review for anomaly |

### Escalation Path
1. On-call engineer investigates
2. Team lead notified if not resolved in 2 hours
3. VP notified for P0 metrics breach
```

## Dashboard Design

### Principles

| Principle | Application |
|-----------|-------------|
| **Leading indicators prominent** | Top of dashboard, real-time |
| **Lagging indicators for context** | Below, trend-based |
| **Drill-down available** | Click to segment |
| **Historical comparison** | Week-over-week, month-over-month |
| **Anomaly highlighting** | Auto-flag deviations |

## Experiment Design

```markdown
## Experiment: [Name]

### Hypothesis
We believe [change] will cause [metric] to [improve by X%]

### Success Metric
- Primary: [Metric to move]
- Guardrail: [Metric that must not degrade]

### Sample Size
- Minimum: [N] per variant
- Duration: [X] weeks
- Confidence: 95%

### Rollout Plan
1. 5% canary for 1 week
2. 25% for 2 weeks
3. 50% for 1 week
4. 100% rollout
```
