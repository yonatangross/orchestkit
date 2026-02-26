---
title: Size markets accurately using top-down and bottom-up approaches with realistic SOM constraints
category: market
impact: HIGH
impactDescription: "Ensures accurate market sizing using both top-down and bottom-up approaches with realistic SOM constraints"
tags: tam, sam, som, market-sizing, market-analysis
---

# TAM/SAM/SOM Market Sizing

Market sizing from total opportunity to achievable share.

## Framework Overview

```
+-------------------------------------------------------+
|                         TAM                            |
|        Total Addressable Market                        |
|     (Everyone who could possibly buy)                  |
|  +---------------------------------------------------+|
|  |                      SAM                           ||
|  |       Serviceable Addressable Market               ||
|  |    (Segment you can actually reach)                ||
|  |  +-----------------------------------------------+||
|  |  |                   SOM                          |||
|  |  |     Serviceable Obtainable Market              |||
|  |  |   (Realistic share you can capture)            |||
|  |  +-----------------------------------------------+||
|  +---------------------------------------------------+|
+-------------------------------------------------------+
```

| Metric | Definition | Example |
|--------|------------|---------|
| **TAM** | Total market demand globally | All project management software: $10B |
| **SAM** | Your target segment | Enterprise PM software in North America: $3B |
| **SOM** | What you can realistically capture | First 3 years with current resources: $50M |

## Calculation Methods

### Top-Down Approach

```
TAM = (# of potential customers) x (annual value per customer)
SAM = TAM x (% addressable by your solution)
SOM = SAM x (realistic market share %)
```

### Bottom-Up Approach

```
SOM = (# of customers you can acquire) x (average deal size)
SAM = SOM / (your expected market share %)
TAM = SAM / (segment % of total market)
```

## Example Analysis

```markdown
## Market Sizing: AI Code Review Tool

### TAM (Total Addressable Market)
- Global developers: 28 million
- % using code review tools: 60%
- Addressable developers: 16.8 million
- Average annual spend: $300/developer
- **TAM = $5.04 billion**

### SAM (Serviceable Addressable Market)
- Focus: Enterprise (>500 employees)
- Enterprise developers: 8 million (48% of addressable)
- Willing to pay premium: 40%
- Target developers: 3.2 million
- **SAM = $960 million**

### SOM (Serviceable Obtainable Market)
- Year 1-3 realistic market share: 2%
- **SOM = $19.2 million**
```

## Cross-Referencing Methods

Always use both methods and reconcile:

| Method | TAM | Notes |
|--------|-----|-------|
| Top-Down | $4.86B | Based on industry reports |
| Bottom-Up | $5.0B | Based on enterprise segments |
| **Reconciled** | **$4.9B** | Average, validated range |

## SOM Constraints

```
SAM: $470M

Constraints:
- Market share goal (3 years): 3%
- Competitive pressure: -20%
- Sales capacity: supports $15M ARR
- Go-to-market reach: 70%

Conservative SOM: min($470M x 3%, $15M, $470M x 70% x 3%)
= min($14.1M, $15M, $9.87M)
= $10M (3-year target)
```

## Confidence Levels

| Confidence | Evidence |
|------------|----------|
| HIGH | Multiple corroborating sources, recent data |
| MEDIUM | Single authoritative source, 1-2 years old |
| LOW | Extrapolated, assumptions, old data |

## Common Mistakes

| Mistake | Correction |
|---------|------------|
| TAM = "everyone" | Define specific customer segment |
| Ignoring competition | SOM must account for competitors |
| Old data | Use most recent (<2 years) |
| Single method | Cross-validate top-down and bottom-up |
| Confusing TAM/SAM | TAM is total, SAM is your reach |

**Incorrect — Unrealistic SOM without constraints:**
```markdown
TAM: $10B
SAM (our segment): $3B
SOM (10% market share): $300M

This is achievable in 3 years!
```

**Correct — SOM constrained by realistic factors:**
```markdown
SAM: $3B

Constraints:
- Sales capacity: supports $15M ARR max
- Competitive pressure: 5 strong incumbents
- Realistic market share (Year 3): 0.5%

Conservative SOM: min($3B × 0.5%, $15M) = $15M
```
