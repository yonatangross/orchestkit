---
title: Cohort Retention Analysis — Measuring Habit Formation and Feature Adoption
impact: HIGH
impactDescription: "Without cohort analysis, teams mistake raw DAU growth for product health and miss early signs of churn that destroy long-term retention curves."
tags: cohort, retention, day-n-retention, feature-adoption, engagement, churn
---

# Cohort Retention

Cohort analysis groups users by a shared starting event and tracks their behavior over time. It answers "do users come back?" and "do they stick with new features?" more honestly than aggregate metrics like MAU.

## 1. Cohort Definition

**Time-based cohort:** Users grouped by when they first appeared (signup week, first purchase month). The most common type — use for measuring overall product health.

**Behavior-based cohort:** Users grouped by a key action (first checkout, first team invite, first file upload). Use for measuring feature adoption and activation quality.

**Incorrect — comparing raw counts:**
```markdown
January MAU: 10,000
February MAU: 12,000
Conclusion: Growth is healthy.
```

**Correct — cohort view reveals churn:**
```markdown
Jan cohort (10,000 users):
  Week 1 retention: 45%  (4,500 users)
  Week 4 retention: 18%  (1,800 users)
  Week 12 retention: 8%  (800 users)

Feb cohort (12,000 users, including 4,500 Jan survivors):
  New users in February: 7,500
  New user week-1 retention: 38% — declining, not growing

Conclusion: Acquisition is masking a worsening retention problem.
```

## 2. Retention Curve Types

**Day-N retention (point-in-time):** What % of a cohort was active exactly on day N?
- Best for: consumer apps, games, social products
- Signal: Day-1 and Day-7 predict long-term retention

**Rolling retention (cumulative return):** What % of a cohort was active on day N or any later day?
- Best for: low-frequency products (finance, health, productivity)
- Higher numbers than day-N — clarify which type you are reporting

**Week-over-week / Month-over-month:** Cohort measured at weekly or monthly intervals.
- Best for: B2B SaaS, subscription products
- Signal: Week-4 retention is a strong PMF indicator for SaaS

## 3. Retention Benchmarks

Use these as rough orientation, not hard targets. Your benchmark is your own prior cohort.

**Consumer app (social, gaming, media):**
| Interval | Poor | Average | Good |
|----------|------|---------|------|
| Day 1 | < 20% | 25–40% | > 40% |
| Day 7 | < 8%  | 10–20% | > 20% |
| Day 30 | < 3%  | 5–12%  | > 12% |

**B2B SaaS:**
| Interval | Poor | Average | Good |
|----------|------|---------|------|
| Month 1 | < 40% | 50–70% | > 70% |
| Month 3 | < 25% | 35–55% | > 55% |
| Month 12 | < 15% | 25–40% | > 40% |

**Marketplace / e-commerce (repeat purchase):**
| Interval | Poor | Average | Good |
|----------|------|---------|------|
| 30-day repeat | < 10% | 15–25% | > 25% |
| 90-day repeat | < 20% | 30–45% | > 45% |

**Flat retention curve** — retention stabilizes and stops declining. This is the clearest product-market fit signal: a durable core of users who have built a habit.

## 4. Feature Adoption Tracking

Measure adoption as a cohort — not as a total count — to distinguish early-adopter noise from durable behavior change.

**Incorrect — raw adoption count:**
```markdown
Feature X used by 5,000 users in first month.
Conclusion: Feature is successful.
```

**Correct — adoption cohort:**
```markdown
Users who activated feature X in month 1 (adoption cohort): 5,000
  Week 2 return-to-feature rate: 55%
  Week 4 return-to-feature rate: 30%
  Week 8 return-to-feature rate: 22%

Users who never used feature X (control):
  Overall product retention at week 8: 14%

Conclusion: Feature X users retain at 22% vs 14% baseline.
  Feature is correlated with better retention — worth expanding.
```

## 5. SQL Patterns for Cohort Analysis

**Day-N retention query (standard pattern):**
```sql
WITH cohorts AS (
  SELECT
    user_id,
    DATE_TRUNC('week', MIN(created_at)) AS cohort_week
  FROM events
  WHERE event_name = 'user_signed_up'
  GROUP BY user_id
),
activity AS (
  SELECT DISTINCT
    user_id,
    DATE_TRUNC('week', occurred_at) AS activity_week
  FROM events
  WHERE event_name = 'session_start'
)
SELECT
  c.cohort_week,
  COUNT(DISTINCT c.user_id)                          AS cohort_size,
  COUNT(DISTINCT CASE
    WHEN a.activity_week = c.cohort_week + INTERVAL '1 week'
    THEN a.user_id END) * 100.0
    / COUNT(DISTINCT c.user_id)                      AS week_1_retention,
  COUNT(DISTINCT CASE
    WHEN a.activity_week = c.cohort_week + INTERVAL '4 weeks'
    THEN a.user_id END) * 100.0
    / COUNT(DISTINCT c.user_id)                      AS week_4_retention
FROM cohorts c
LEFT JOIN activity a USING (user_id)
GROUP BY c.cohort_week
ORDER BY c.cohort_week;
```

**Feature adoption cohort query:**
```sql
-- Users who adopted feature X, grouped by adoption week
SELECT
  DATE_TRUNC('week', first_feature_use) AS adoption_cohort,
  COUNT(DISTINCT user_id)               AS adopters,
  AVG(days_to_first_use)                AS avg_days_to_adopt
FROM (
  SELECT
    user_id,
    MIN(occurred_at) AS first_feature_use,
    DATEDIFF('day', u.created_at, MIN(e.occurred_at)) AS days_to_first_use
  FROM events e
  JOIN users u USING (user_id)
  WHERE e.event_name = 'feature_x_used'
  GROUP BY user_id, u.created_at
) sub
GROUP BY 1
ORDER BY 1;
```

## 6. Engagement Scoring

Score users by engagement depth to distinguish casual from habitual users. Useful for segmenting cohort analysis.

```markdown
## Engagement Tiers

Power users   (score 8–10): Use core feature 3+ times/week, invite others
Active users  (score 5–7):  Use product weekly, complete core workflow
Casual users  (score 2–4):  Monthly activity, shallow feature use
At-risk users (score 0–1):  No activity in 14+ days

Scoring inputs:
- Frequency: sessions per week (0–3 pts)
- Depth: features used per session (0–3 pts)
- Virality: invites or shares sent (0–2 pts)
- Value event: completed core action this week (0–2 pts)
```

**Key rules:**
- Always use cohort-week granularity, not raw dates — seasonality distorts day-level data.
- Report both cohort size AND retention percentage — small cohorts have noisy percentages.
- Compare new cohorts to prior cohorts of the same age, not to older cohorts at maturity.
- A rising retention curve across sequential cohorts is the best evidence your product is improving.
