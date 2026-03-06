---
title: Funnel Analysis — Mapping, Measuring, and Fixing Conversion Drop-offs
impact: HIGH
impactDescription: "Without structured funnel analysis, teams optimize the wrong steps and miss that a single high-drop stage is killing overall conversion."
tags: funnel, conversion, drop-off, micro-conversion, segmentation, optimization
---

# Funnel Analysis

A funnel maps the sequence of steps users take toward a goal and measures what percentage make it through each step. The power of funnel analysis is identifying where to focus — the highest-impact drop-off point — rather than guessing.

## 1. Funnel Definition and Stage Mapping

Start with a clear end goal (conversion event), then work backward to identify each required step.

**Template:**
```markdown
## Funnel: [Goal Name]
Period: [date range]
Entry event: [first measurable action]
Exit event: [conversion / goal completion]

Stages:
1. [Stage name]  — event: [event_name]
2. [Stage name]  — event: [event_name]
3. [Stage name]  — event: [event_name]
4. [Stage name]  — event: [event_name]  ← conversion
```

**Incorrect — stages that are too coarse:**
```markdown
Stage 1: Visit site
Stage 2: Buy
Drop-off: 99%
```

**Correct — granular stages reveal where to fix:**
```markdown
Signup Funnel — Last 30 days

Stage 1: Landing page view      10,000 users  (entry)
Stage 2: Clicked "Sign up"       4,200 users  (42%)
Stage 3: Filled email + password 2,900 users  (69% from stage 2)
Stage 4: Confirmed email         1,800 users  (62% from stage 3)  ← largest absolute drop
Stage 5: Completed onboarding    1,100 users  (61% from stage 4)

Overall: 11% conversion (1,100 / 10,000)
Biggest absolute loss: Stage 1→2 (5,800 lost)
Biggest relative loss: Stage 1→2 (58% drop) — investigate CTA copy and page value prop
```

## 2. Conversion Rate Calculation

Always report both absolute numbers and rates. Rates without volume are misleading.

```markdown
Step conversion rate:    users_at_step_N / users_at_step_(N-1)
Overall conversion rate: users_at_final_step / users_at_entry_step
Drop-off rate:           1 - step_conversion_rate
```

**SQL pattern — ordered funnel with window functions:**
```sql
WITH funnel_events AS (
  SELECT
    user_id,
    MAX(CASE WHEN event_name = 'page_viewed' AND page = 'landing'
             THEN occurred_at END) AS step_1,
    MAX(CASE WHEN event_name = 'cta_clicked'
             THEN occurred_at END) AS step_2,
    MAX(CASE WHEN event_name = 'form_submitted'
             THEN occurred_at END) AS step_3,
    MAX(CASE WHEN event_name = 'email_confirmed'
             THEN occurred_at END) AS step_4,
    MAX(CASE WHEN event_name = 'onboarding_completed'
             THEN occurred_at END) AS step_5
  FROM events
  WHERE occurred_at BETWEEN '2026-02-01' AND '2026-03-01'
  GROUP BY user_id
)
SELECT
  COUNT(*)                                           AS step_1_users,
  COUNT(step_2)                                      AS step_2_users,
  ROUND(COUNT(step_2) * 100.0 / COUNT(*), 1)        AS step_1_to_2_pct,
  COUNT(step_3)                                      AS step_3_users,
  ROUND(COUNT(step_3) * 100.0 / COUNT(step_2), 1)   AS step_2_to_3_pct,
  COUNT(step_4)                                      AS step_4_users,
  ROUND(COUNT(step_4) * 100.0 / COUNT(step_3), 1)   AS step_3_to_4_pct,
  COUNT(step_5)                                      AS step_5_users,
  ROUND(COUNT(step_5) * 100.0 / COUNT(*), 1)        AS overall_pct
FROM funnel_events
WHERE step_1 IS NOT NULL;
```

## 3. Drop-off Identification and Prioritization

Not all drop-offs are equally worth fixing. Prioritize by absolute user volume lost, not by percentage.

**Prioritization formula:**
```
Impact score = users_lost_at_stage * estimated_recovery_rate * value_per_conversion

Where estimated_recovery_rate = reasonable improvement if you fix UX/flow at this step.
Typical range: 10–30% of lost users.
```

**Prioritization example:**
```markdown
Stage A→B: 5,800 lost, 30% recovery estimate = 1,740 recovered users
Stage B→C: 1,300 lost, 50% recovery estimate =   650 recovered users
Stage C→D: 1,100 lost, 20% recovery estimate =   220 recovered users

Highest impact: Fix Stage A→B first (5,800 lost is the biggest pool).
```

**Incorrect — optimizing the wrong step:**
```markdown
Stage C→D has a 38% step conversion rate — that seems low.
Action: A/B test the confirmation email.
```

**Correct — volume-weighted prioritization:**
```markdown
Stage A→B has only 42% step conversion but 5,800 users lost.
Stage C→D has 38% step conversion but only 1,100 users lost.
Action: A/B test the landing page CTA first (5x more users affected).
```

## 4. Micro-Conversion Tracking

Some funnels have invisible steps that explain large drop-offs. Track micro-conversions to find them.

**Micro-conversion examples:**
- User viewed pricing page (between signup CTA and form fill)
- User scrolled past the fold on landing page
- User started typing in form but abandoned
- User opened email but did not click confirm

**Incorrect — treating drop-off as a black box:**
```markdown
Step 2→3 drop-off: 31% of users don't fill the form.
Hypothesis: Form is too long.
Action: Shorten form.
```

**Correct — micro-conversions reveal the real blocker:**
```markdown
Step 2→3 drop-off: 31% of users don't fill the form.
Micro-conversion data:
  - 80% of drop-offs viewed the pricing page first
  - 65% of pricing page viewers bounced immediately
Revised hypothesis: Users are hitting a price shock before they understand value.
Action: Redesign pricing page, not the form.
```

## 5. Segmented Funnel Analysis

The same funnel often performs very differently across segments. Always break down by key dimensions.

**Standard segments to check:**
- Traffic source (organic, paid, referral, direct)
- Device type (mobile vs desktop)
- Geography (market-specific friction)
- User plan or tier (free vs paid)
- Cohort age (new vs returning)

```markdown
Overall signup conversion: 11%

By traffic source:
  Organic search:  18%  ← highest quality
  Paid social:      7%  ← lowest quality — review targeting
  Referral:        24%  ← highest quality — invest here
  Direct:          14%

By device:
  Desktop: 14%
  Mobile:   8%  ← 6pp gap — investigate mobile form UX
```

## 6. Optimization Prioritization

After identifying drop-offs, choose interventions using this ladder:

1. **Remove the step entirely** — is this step necessary? Can users skip it?
2. **Reduce friction** — fewer fields, faster load, clearer copy
3. **Add value signals** — social proof, benefit statements, trust indicators
4. **Personalize** — segment-specific messaging for high-volume segments

**Key rules:**
- Fix funnels top-down by absolute volume lost, not by worst percentage.
- Segment before concluding — aggregate funnel numbers hide segment-level problems.
- Measure time-in-step as well as drop-off rate — long dwell time before drop = confusion, not disinterest.
- Each funnel stage you fix becomes the new constraint — re-prioritize after each improvement ships.
