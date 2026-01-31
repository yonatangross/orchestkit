# Metric Definition Template

Use this template to formally define each KPI.

```markdown
# Metric: [Metric Name]

**ID:** [METRIC-001]
**Owner:** [Team/Person]
**Last Updated:** YYYY-MM-DD

---

## Definition

[Precise definition of what this metric measures. Be specific enough that two people would calculate the same value.]

---

## Formula

```
Metric = Numerator / Denominator

Where:
- Numerator: [definition]
- Denominator: [definition]
```

**Example Calculation:**
```
Monthly Active Users = Unique users who performed at least 1 action in 30-day window
= Count(DISTINCT user_id WHERE last_action_date >= today - 30)
```

---

## Data Source

| Field | Value |
|-------|-------|
| System | [e.g., PostgreSQL, Mixpanel, Stripe] |
| Table/Event | [e.g., events.user_actions] |
| Query Owner | [Team responsible] |
| Refresh Frequency | [Real-time, Hourly, Daily] |

---

## Segments

Break down by:
- [ ] Customer tier (Free, Pro, Enterprise)
- [ ] Geography (NA, EMEA, APAC)
- [ ] Cohort (signup month)
- [ ] Platform (Web, iOS, Android)
- [ ] [Custom segment]

---

## Historical Context

| Period | Value | Notes |
|--------|-------|-------|
| Q1 2025 | X | [Context] |
| Q2 2025 | Y | [Context] |
| Q3 2025 | Z | [Context] |

---

## Targets

| Period | Target | Stretch |
|--------|--------|---------|
| Q1 2026 | X | Y |
| Q2 2026 | A | B |

---

## Leading/Lagging

**Type:** Leading / Lagging

**If Leading, predicts:** [Which lagging metric]
**If Lagging, predicted by:** [Which leading metrics]

---

## Alerting

| Threshold | Severity | Action |
|-----------|----------|--------|
| < X | Warning | [Action to take] |
| < Y | Critical | [Action to take] |

---

## Related Metrics

- **Parent:** [Higher-level metric this rolls into]
- **Children:** [Lower-level metrics that compose this]
- **Related:** [Correlated metrics]

---

## Dashboard Location

[Link to where this metric is displayed]

---

## Notes

[Any additional context, caveats, or known issues with this metric]
```
