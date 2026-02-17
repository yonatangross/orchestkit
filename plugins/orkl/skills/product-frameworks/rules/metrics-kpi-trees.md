---
title: "Metrics: KPI Trees & North Star"
category: metrics
impact: HIGH
impactDescription: "Ensures hierarchical metric decomposition with clear cause-effect relationships and North Star alignment"
tags: kpi-trees, north-star, metrics-hierarchy, input-metrics
---

# KPI Trees & North Star Metric

Hierarchical breakdown of metrics showing cause-effect relationships.

## Revenue KPI Tree

```
                         Revenue
                            |
          +-----------------+-----------------+
          |                 |                 |
     New Revenue      Expansion         Retained
          |            Revenue           Revenue
          |                |                 |
    +-----+-----+    +-----+-----+    +-----+-----+
    |           |    |           |    |           |
  Leads x    Conv  Users x   Upsell  Existing x (1-Churn)
  Rate       Rate   ARPU      Rate    Revenue     Rate
```

## Product Health KPI Tree

```
                    Product Health Score
                            |
         +------------------+------------------+
         |                  |                  |
    Engagement          Retention         Satisfaction
         |                  |                  |
    +----+----+       +----+----+       +----+----+
    |         |       |         |       |         |
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

## Building a KPI Tree

### Step 1: Start with the Business Outcome
What is the top-level metric leadership cares about? (Revenue, Users, Engagement)

### Step 2: Decompose into Components
Break the metric into its mathematical components (multiplied or added).

### Step 3: Identify Input Metrics
For each component, identify what leading indicators predict it.

### Step 4: Assign Owners
Each metric should have a clear team owner.

### Step 5: Set Targets
Baseline + target for each metric in the tree.

## Best Practices

- **Keep trees 3 levels deep** -- deeper than that and it loses clarity
- **Every metric has an owner** -- no orphan metrics
- **Leading indicators at the leaves** -- actionable by teams
- **Lagging indicators at the root** -- confirms outcomes
- **Dashboard the tree** -- make it visible to the whole organization

**Incorrect — Flat metrics without hierarchy:**
```markdown
Q1 Goals:
- Increase revenue
- Improve engagement
- Reduce churn
```

**Correct — KPI tree with cause-effect relationships:**
```markdown
Revenue (Lagging)
├── New Revenue = Leads × Conv Rate (Leading)
├── Expansion = Users × Upsell Rate (Leading)
└── Retained = Existing × (1 - Churn Rate) (Lagging)
```
