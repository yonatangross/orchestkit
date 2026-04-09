---
name: competitive-analysis
description: "Porter's Five Forces, SWOT analysis, and competitive landscape mapping. Use when analyzing market position, evaluating competitive threats, building battlecards, or assessing industry dynamics."
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: guidance
tags: [porter, swot, competitive, battlecard, moat, five-forces, landscape]
context: fork
agent: product-strategist
metadata:
  category: document-asset-creation
allowed-tools: [Read, Glob, Grep, WebFetch, WebSearch]
---

# Competitive Analysis

Frameworks for analyzing competitive position and industry dynamics.

## When to Use Porter's vs. SWOT

| Framework | Use When |
|-----------|----------|
| **Porter's Five Forces** | Evaluating industry attractiveness; new market entry; strategic positioning |
| **SWOT** | Internal capability assessment; go/no-go decisions; strategy planning |
| **Competitive Landscape Map** | Visualizing whitespace; investor decks; positioning against specific competitors |
| **Competitor Profiles** | Battlecards for sales; feature gap analysis; threat assessment |

Use Porter's to understand the structural forces shaping the industry. Use SWOT to assess your specific position within it. Combine both for a complete picture.

## Porter's Five Forces Template

```markdown
## Porter's Five Forces: [Industry/Market]

### 1. Competitive Rivalry — Intensity: HIGH / MEDIUM / LOW
| Factor | Assessment |
|--------|------------|
| Number of competitors | |
| Industry growth rate | |
| Product differentiation | |
| Exit barriers | |

### 2. Threat of New Entrants — Threat Level: HIGH / MEDIUM / LOW
| Barrier | Strength |
|---------|----------|
| Economies of scale | |
| Brand loyalty | |
| Capital requirements | |
| Network effects | |
| Switching costs | |

### 3. Bargaining Power of Suppliers — Power: HIGH / MEDIUM / LOW
[Key suppliers, switching cost, concentration]

### 4. Bargaining Power of Buyers — Power: HIGH / MEDIUM / LOW
[Price sensitivity, alternatives available, buyer concentration]

### 5. Threat of Substitutes — Threat: HIGH / MEDIUM / LOW
[Alternative ways customers solve the same problem]

### Overall Industry Attractiveness: X/10
[Summary: which forces are most significant and why]
```

## SWOT Analysis

```
+-------------------------+-------------------------+
|       STRENGTHS         |       WEAKNESSES        |
|       (Internal +)      |       (Internal -)      |
| * What we do well       | * Where we lack         |
| * Unique resources      | * Resource gaps         |
| * Competitive advantages| * Capability limits     |
+-------------------------+-------------------------+
|      OPPORTUNITIES      |         THREATS         |
|       (External +)      |       (External -)      |
| * Market trends         | * Competitive pressure  |
| * Unmet needs           | * Regulatory changes    |
| * Technology shifts     | * Economic factors      |
+-------------------------+-------------------------+
```

### TOWS Matrix (SWOT to Strategy)

| | Strengths | Weaknesses |
|---|-----------|------------|
| **Opportunities** | SO: Use strengths to capture opportunities | WO: Fix weaknesses to unlock opportunities |
| **Threats** | ST: Use strengths to mitigate threats | WT: Minimize weaknesses, avoid threats |

## Competitor Profile Template

```markdown
## Competitor: [Name]

### Overview
- Founded: [Year] | Funding: $[Amount] | Employees: [N]
- Target customer: [Segment]
- Pricing: [Model and range]

### Strengths / Weaknesses
+ [Strength 1]
+ [Strength 2]
- [Weakness 1]
- [Weakness 2]

### Threat Assessment: HIGH / MEDIUM / LOW
- [Why this threat level]
- [Our differentiation vs. this competitor]
```

## Competitive Landscape Map

Plot competitors on two axes that matter most to buyers (e.g., price vs. features, ease of use vs. power):

```
                    HIGH PRICE
                        |
     Premium Leaders    |    Luxury Niche
   +-------------+      |      +-------------+
   |  [Comp A]   |      |      |  [Comp B]   |
   +-------------+      |      +-------------+
                        |
LOW ────────────────────+──────────────────── HIGH
FEATURES                |                   FEATURES
                        |
   +-------------+      |      +-------------+
   |  [Comp C]   |      |      |    [US]     |
   +-------------+      |      +-------------+
     Budget Options     |    Value Leaders
                        |
                    LOW PRICE
```

Identify whitespace — quadrants with no incumbents that align with unmet buyer needs.

## GitHub Signals for Competitive Tracking

```bash
# Star count and momentum
gh api repos/owner/repo --jq '{stars: .stargazers_count, forks: .forks_count}'

# Shipping velocity (recent releases)
gh release list --repo owner/repo --limit 5

# Community size
gh api repos/owner/repo/contributors --jq 'length'
```

| Signal | Check Frequency |
|--------|-----------------|
| Star growth | Weekly |
| Release notes | Per release |
| Pricing changes | Monthly |
| Feature launches | Per announcement |
| Full analysis | Quarterly |

## References

- [Competitive Analysis Rules](rules/market-competitive.md) — Porter's, SWOT, landscape map, competitor profile templates
- [Competitive Analysis Guide](references/competitive-analysis-guide.md) — Research methodology, data sources, update cadence

## Related Skills

- `ork:market-sizing` — Quantify opportunity size alongside competitive landscape
- `ork:business-case` — Build financial justification informed by competitive position
- `ork:product-frameworks` — Full product strategy toolkit (value prop, prioritization, OKRs)

---

Version: 1.0.0
