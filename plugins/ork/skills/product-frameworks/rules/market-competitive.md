---
title: "Market: Competitive Analysis"
category: market
impact: HIGH
impactDescription: "Ensures thorough competitive analysis using Porter's Five Forces, SWOT, and competitive landscape mapping"
tags: competitive-analysis, porters-five-forces, swot, market-positioning
---

# Competitive Analysis

Frameworks for analyzing competition and understanding industry dynamics.

## Porter's Five Forces

```
                    +---------------------+
                    |  Threat of New      |
                    |     Entrants        |
                    |    (Barrier height) |
                    +---------+-----------+
                              |
                              v
+-----------------+    +-----------------+    +-----------------+
|   Bargaining    |    |   Competitive   |    |   Bargaining    |
|   Power of      |<---|    Rivalry      |--->|   Power of      |
|   Suppliers     |    |  (Intensity)    |    |    Buyers       |
+-----------------+    +---------+-------+    +-----------------+
                              |
                              v
                    +---------------------+
                    |  Threat of          |
                    |   Substitutes       |
                    | (Alternative ways)  |
                    +---------------------+
```

### Force Analysis Template

```markdown
## Porter's Five Forces: [Industry]

### 1. Competitive Rivalry -- Intensity: HIGH / MEDIUM / LOW
| Factor | Assessment |
|--------|------------|
| Number of competitors | |
| Industry growth rate | |
| Product differentiation | |
| Exit barriers | |

### 2. Threat of New Entrants -- Threat Level: HIGH / MEDIUM / LOW
| Barrier | Strength |
|---------|----------|
| Economies of scale | |
| Brand loyalty | |
| Capital requirements | |
| Network effects | |

### 3-5. [Supplier power, Buyer power, Substitutes]
[Same structure]

### Overall Industry Attractiveness: X/10
```

## SWOT Analysis

```
+-------------------------+-------------------------+
|       STRENGTHS         |       WEAKNESSES        |
|       (Internal +)      |       (Internal -)      |
| * What we do well       | * Where we lack         |
| * Unique resources      | * Resource gaps          |
| * Competitive advantages| * Capability limits     |
+-------------------------+-------------------------+
|      OPPORTUNITIES      |         THREATS         |
|       (External +)      |       (External -)      |
| * Market trends         | * Competitive pressure  |
| * Unmet needs           | * Regulatory changes    |
| * Technology shifts     | * Economic factors      |
+-------------------------+-------------------------+
```

### SWOT to Strategy (TOWS Matrix)

| | Strengths | Weaknesses |
|---|-----------|------------|
| **Opportunities** | **SO Strategies**: Use strengths to capture opportunities | **WO Strategies**: Overcome weaknesses to capture opportunities |
| **Threats** | **ST Strategies**: Use strengths to mitigate threats | **WT Strategies**: Minimize weaknesses and avoid threats |

## Competitive Landscape Map

```
                    HIGH PRICE
                        |
         Premium        |        Luxury
         Leaders        |        Niche
    +-------------+     |     +-------------+
    |  [Comp A]   |     |     |  [Comp B]   |
    +-------------+     |     +-------------+
                        |
LOW --------------------+-------------------- HIGH
FEATURES                |                   FEATURES
                        |
    +-------------+     |     +-------------+
    |  [Comp C]   |     |     |    [US]     |
    +-------------+     |     +-------------+
         Budget         |       Value
         Options        |       Leaders
                        |
                    LOW PRICE
```

## Competitor Profile Template

```markdown
## Competitor: [Name]

### Overview
- **Founded:** [Year]
- **Funding:** $[Amount]
- **Employees:** [N]

### Product
- **Core offering:** [Description]
- **Key features:** [List]
- **Pricing:** [Model]
- **Target customer:** [Segment]

### Strengths / Weaknesses
1. [Strength/Weakness]
2. [Strength/Weakness]

### Threat Assessment: HIGH / MEDIUM / LOW
```

## GitHub Signals to Track

```bash
# Star count and growth
gh api repos/owner/repo --jq '{stars: .stargazers_count}'

# Recent releases (shipping velocity)
gh release list --repo owner/repo --limit 5

# Contributor count
gh api repos/owner/repo/contributors --jq 'length'
```

## Update Frequency

| Signal | Check Frequency |
|--------|-----------------|
| Star growth | Weekly |
| Release notes | Per release |
| Pricing changes | Monthly |
| Feature launches | Per announcement |
| Full analysis | Quarterly |

**Incorrect — Vague competitive assessment:**
```markdown
## Competitors
- Company A: Big player, lots of features
- Company B: Cheaper option
- Company C: New entrant
```

**Correct — Structured competitive analysis with SWOT:**
```markdown
## Competitor: Company A

### Strengths / Weaknesses
+ Established brand, 60% market share
+ Enterprise features (SSO, RBAC)
- Legacy UI, poor mobile experience
- Slow release cycle (quarterly)

### Threat Assessment: HIGH
- Direct competitor in enterprise segment
- Strong sales team, existing relationships

### Our Differentiation
- Modern UX, mobile-first
- Weekly releases, faster iteration
```
