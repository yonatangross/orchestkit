---
name: market-analysis-patterns
description: TAM/SAM/SOM market sizing, Porter's Five Forces, competitive analysis, and SWOT frameworks. Use when sizing market opportunities, analyzing competition, or assessing industry dynamics.
context: fork
agent: market-intelligence
version: 1.0.0
tags: [product, market, tam, sam, som, porter, competitive, swot, 2026]
author: OrchestKit
user-invocable: false
---

# Market Analysis Patterns

Frameworks for sizing markets, analyzing competition, and understanding industry dynamics.

## TAM SAM SOM Framework

Market sizing from total opportunity to achievable share.

### Definitions

```
┌─────────────────────────────────────────────────────────┐
│                         TAM                              │
│        Total Addressable Market                         │
│     (Everyone who could possibly buy)                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │                      SAM                           │  │
│  │       Serviceable Addressable Market              │  │
│  │    (Segment you can actually reach)               │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │                   SOM                        │  │  │
│  │  │     Serviceable Obtainable Market           │  │  │
│  │  │   (Realistic share you can capture)         │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

| Metric | Definition | Example |
|--------|------------|---------|
| **TAM** | Total market demand globally | All project management software: $10B |
| **SAM** | Your target segment | Enterprise PM software in North America: $3B |
| **SOM** | What you can realistically capture | First 3 years with current resources: $50M |

### Calculation Methods

**Top-Down Approach:**
```
TAM = (# of potential customers) × (annual value per customer)
SAM = TAM × (% addressable by your solution)
SOM = SAM × (realistic market share %)
```

**Bottom-Up Approach:**
```
SOM = (# of customers you can acquire) × (average deal size)
SAM = SOM / (your expected market share %)
TAM = SAM / (segment % of total market)
```

### Example Analysis

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

## Porter's Five Forces

Analyze industry competitive dynamics.

### The Five Forces

```
                    ┌─────────────────────┐
                    │  Threat of New      │
                    │     Entrants        │
                    │    (Barrier height) │
                    └─────────┬───────────┘
                              │
                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Bargaining    │    │   Competitive   │    │   Bargaining    │
│   Power of      │◄───│    Rivalry      │───►│   Power of      │
│   Suppliers     │    │  (Intensity)    │    │    Buyers       │
└─────────────────┘    └─────────┬───────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Threat of          │
                    │   Substitutes       │
                    │ (Alternative ways)  │
                    └─────────────────────┘
```

### Force Analysis Template

```markdown
## Porter's Five Forces: [Industry]

### 1. Competitive Rivalry
**Intensity: HIGH / MEDIUM / LOW**

| Factor | Assessment |
|--------|------------|
| Number of competitors | |
| Industry growth rate | |
| Product differentiation | |
| Exit barriers | |
| Fixed costs | |

**Implications:** [How this affects strategy]

### 2. Threat of New Entrants
**Threat Level: HIGH / MEDIUM / LOW**

| Barrier | Strength |
|---------|----------|
| Economies of scale | |
| Brand loyalty | |
| Capital requirements | |
| Regulatory barriers | |
| Network effects | |

**Implications:** [How this affects strategy]

### 3. Bargaining Power of Suppliers
**Power Level: HIGH / MEDIUM / LOW**

| Factor | Assessment |
|--------|------------|
| Supplier concentration | |
| Switching costs | |
| Supplier differentiation | |
| Forward integration threat | |

**Implications:** [How this affects strategy]

### 4. Bargaining Power of Buyers
**Power Level: HIGH / MEDIUM / LOW**

| Factor | Assessment |
|--------|------------|
| Buyer concentration | |
| Switching costs | |
| Price sensitivity | |
| Backward integration threat | |

**Implications:** [How this affects strategy]

### 5. Threat of Substitutes
**Threat Level: HIGH / MEDIUM / LOW**

| Substitute | Switching Likelihood |
|------------|---------------------|
| | |

**Implications:** [How this affects strategy]

### Overall Industry Attractiveness
**Score: X/10**
[Summary and strategic recommendations]
```

## Competitive Analysis

### Competitive Landscape Map

```
                    HIGH PRICE
                        │
         Premium        │        Luxury
         Leaders        │        Niche
    ┌─────────────┐     │     ┌─────────────┐
    │  [Comp A]   │     │     │  [Comp B]   │
    └─────────────┘     │     └─────────────┘
                        │
LOW ────────────────────┼──────────────────── HIGH
FEATURES                │                   FEATURES
                        │
    ┌─────────────┐     │     ┌─────────────┐
    │  [Comp C]   │     │     │    [US]     │
    └─────────────┘     │     └─────────────┘
         Budget         │       Value
         Options        │       Leaders
                        │
                    LOW PRICE
```

### Competitor Profile Template

```markdown
## Competitor: [Name]

### Overview
- **Founded:**
- **Funding:**
- **Employees:**
- **Revenue (est):**

### Product
- **Core offering:**
- **Key features:**
- **Pricing:**
- **Target customer:**

### Strengths
1.
2.
3.

### Weaknesses
1.
2.
3.

### Recent Moves
- [Date]: [Action]
- [Date]: [Action]

### Threat Assessment: HIGH / MEDIUM / LOW
```

## SWOT Analysis

```
┌─────────────────────────┬─────────────────────────┐
│       STRENGTHS         │       WEAKNESSES        │
│       (Internal +)      │       (Internal -)      │
├─────────────────────────┼─────────────────────────┤
│ • What we do well       │ • Where we lack         │
│ • Unique resources      │ • Resource gaps         │
│ • Competitive advantages│ • Capability limits     │
│                         │                         │
├─────────────────────────┼─────────────────────────┤
│      OPPORTUNITIES      │         THREATS         │
│       (External +)      │       (External -)      │
├─────────────────────────┼─────────────────────────┤
│ • Market trends         │ • Competitive pressure  │
│ • Unmet needs           │ • Regulatory changes    │
│ • Technology shifts     │ • Economic factors      │
│                         │                         │
└─────────────────────────┴─────────────────────────┘
```

### SWOT to Strategy (TOWS Matrix)

| | Strengths | Weaknesses |
|---|-----------|------------|
| **Opportunities** | **SO Strategies**: Use strengths to capture opportunities | **WO Strategies**: Overcome weaknesses to capture opportunities |
| **Threats** | **ST Strategies**: Use strengths to mitigate threats | **WT Strategies**: Minimize weaknesses and avoid threats |

## 2026 Market Considerations

- **Geopolitical factors**: Trade restrictions impact SAM significantly
- **AI disruption**: Every market being reshaped by AI capabilities
- **Sustainability**: ESG factors increasingly influence buying decisions
- **Remote-first**: Geographic boundaries less relevant for digital products

## Related Skills

- `product-strategy-frameworks` - Strategic decisions based on market analysis
- `business-case-analysis` - Financial implications of market opportunities
- `okr-kpi-patterns` - Measuring market penetration

## References

- [TAM SAM SOM Calculator](references/market-sizing-calculator.md)
- [Competitive Intelligence Template](references/competitive-intel-template.md)

**Version:** 1.0.0 (January 2026)
