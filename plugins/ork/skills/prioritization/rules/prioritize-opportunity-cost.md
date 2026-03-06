---
title: Evaluate opportunity cost with value-effort matrices, cost of delay analysis, and trade-off flagging
impact: HIGH
impactDescription: "Ensures prioritization decisions account for opportunity cost and surface trade-offs for human decision-makers"
tags: opportunity-cost, trade-off, sequencing, value-effort
---

# Opportunity Cost & Trade-Off Analysis

Patterns for making prioritization decisions that account for what you give up, not just what you gain. Complements RICE and WSJF scoring with opportunity cost reasoning.

## Value-Effort Matrix

A 2x2 matrix for rapid feature sequencing based on expected value and required effort.

```
               HIGH VALUE
                   |
    Do Next        |     Do First
    (High value,   |     (High value,
     high effort)  |      low effort)
                   |
  -----------------+-----------------
                   |
    Consider       |     Quick Win
    (Low value,    |     (Low value,
     high effort)  |      low effort)
                   |
               LOW VALUE
  HIGH EFFORT                LOW EFFORT
```

| Quadrant | Action | Example |
|----------|--------|---------|
| **Do First** | Ship immediately -- high ROI | Fix broken onboarding step |
| **Quick Win** | Batch into next sprint | Add CSV export button |
| **Do Next** | Plan and resource properly | Platform migration |
| **Consider** | Challenge whether to do at all | Redesign rarely-used admin page |

### Scoring for Placement

- **Value** (1-10): Combine user impact, strategic alignment, revenue potential
- **Effort** (1-10): Engineering weeks, cross-team coordination, risk
- **Threshold**: Value >= 6 is "high value", Effort >= 6 is "high effort"

## Cost of Delay Analysis

Quantify what it costs to NOT do something each time period it is delayed.

```markdown
## Cost of Delay: [Feature Name]

### Revenue Impact
- Lost revenue per month of delay: $X
- Source: [Pipeline data, churn analysis, competitive loss]

### User Impact
- Users affected: N
- Workaround cost per user per month: X hours

### Strategic Impact
- Competitive window closes in: N months
- Regulatory deadline: [date or N/A]

### Total Cost of Delay
$X/month (quantified) + [qualitative strategic cost]
```

### Delay Cost Categories

| Type | How to Estimate | Example |
|------|-----------------|---------|
| **Revenue delay** | Pipeline deals blocked by missing feature | $50K/month in stalled deals |
| **Churn risk** | Customers citing this in exit surveys | 3 enterprise accounts at risk |
| **Competitive** | Competitor ships first, window shrinks | Market share loss |
| **Compliance** | Fines or market access loss after deadline | GDPR: $20M max fine |
| **Compounding** | Delay makes future work harder | Tech debt interest |

## Trade-Off Flagging Template

When two options compete for the same resources, surface the trade-off explicitly for human decision-makers. Do not make the call -- present the data.

```markdown
## Trade-Off: [Decision Title]

### Context
[Why this trade-off exists -- shared resources, timeline conflict, etc.]

### Option A: [Name]
- **Pros:** [List 2-3 concrete benefits with data]
- **Cons:** [List 2-3 concrete downsides with data]
- **RICE Score:** [If available]
- **Cost of Delay:** [$/month]

### Option B: [Name]
- **Pros:** [List 2-3 concrete benefits with data]
- **Cons:** [List 2-3 concrete downsides with data]
- **RICE Score:** [If available]
- **Cost of Delay:** [$/month]

### Recommendation
Human decides. Key factors to weigh:
1. [Factor 1 -- e.g., Q2 OKR alignment]
2. [Factor 2 -- e.g., team capacity next sprint]
3. [Factor 3 -- e.g., customer commitment]
```

## Sequencing Principles

When features have dependencies or shared resources, use these sequencing rules:

1. **Highest cost-of-delay first** -- unless blocked by dependencies
2. **Unblock others early** -- a low-value enabler that unblocks 3 high-value items ships first
3. **Reduce risk early** -- unknowns first, known work later (fail fast)
4. **Batch small items** -- group Quick Wins into a single sprint to clear the backlog

**Incorrect -- prioritizing by gut feel:**
```markdown
Priority list:
1. AI search (CEO wants it)
2. Dashboard redesign (designer is excited)
3. CSV import (seems easy)
```

**Correct -- opportunity cost matrix with explicit trade-offs:**
```markdown
Priority list (by cost of delay):
1. CSV import -- $30K/month blocked deals, 1 week effort (Do First)
2. AI search -- $25K/month competitive risk, 6 week effort (Do Next)
3. Dashboard redesign -- $0 cost of delay, nice-to-have (Consider)

Trade-off flagged: AI search vs platform migration for same
eng team in Q2. See trade-off analysis doc for decision.
```
