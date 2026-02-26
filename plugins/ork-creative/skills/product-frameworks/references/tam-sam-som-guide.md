# TAM/SAM/SOM Market Sizing Guide

Comprehensive guide for market size estimation.

## Definitions

```
TAM (Total Addressable Market)
└── "If we had 100% of the entire market"
└── The total market demand for a product/service

SAM (Serviceable Addressable Market)
└── "Segment we can actually reach"
└── TAM filtered by geography, segment, channel

SOM (Serviceable Obtainable Market)
└── "Realistic capture in 3 years"
└── SAM filtered by competition, capacity, go-to-market
```

## Visual Hierarchy

```
┌─────────────────────────────────────────────────┐
│                    TAM                           │
│                 $10 Billion                      │
│  ┌─────────────────────────────────────────┐    │
│  │                SAM                       │    │
│  │             $500 Million                 │    │
│  │  ┌────────────────────────────────────┐ │    │
│  │  │              SOM                    │ │    │
│  │  │           $10 Million               │ │    │
│  │  └────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## TAM Calculation Methods

### Top-Down Approach

Start with industry reports and filter down.

```
Example: AI Developer Tools
1. Global software developer population: 27M (Statista 2026)
2. Developers using AI tools: 60% = 16.2M
3. Average spend on AI tools: $300/year
4. TAM = 16.2M × $300 = $4.86B
```

### Bottom-Up Approach

Start with unit economics and scale up.

```
Example: AI Developer Tools
1. Target customer: Enterprise dev team (10+ devs)
2. Estimated teams globally: 500,000
3. Average contract value: $10,000/year
4. TAM = 500,000 × $10,000 = $5B
```

### Cross-Reference

Always use both methods and reconcile:

| Method | TAM | Notes |
|--------|-----|-------|
| Top-Down | $4.86B | Based on Statista data |
| Bottom-Up | $5.0B | Based on enterprise segments |
| **Reconciled** | **$4.9B** | Average, validated range |

## SAM Calculation

Filter TAM by your actual reach:

```
Example: AI Developer Tools (US/EU focus)
TAM: $4.9B

Filters:
- Geography (US/EU only): 40% → $1.96B
- Segment (Enterprise only): 30% → $588M
- Use case (Python/TS devs): 80% → $470M

SAM: $470M
```

## SOM Calculation

What you can realistically capture:

```
Example: AI Developer Tools
SAM: $470M

Constraints:
- Market share goal (3 years): 3%
- Competitive pressure: -20%
- Sales capacity: supports $15M ARR
- Go-to-market reach: 70%

Conservative SOM: min($470M × 3%, $15M, $470M × 70% × 3%)
= min($14.1M, $15M, $9.87M)
= $9.87M → Round to $10M

SOM: $10M (3-year target)
```

## Data Sources

### Primary Sources (Higher Confidence)
- Gartner, Forrester, IDC reports
- Company financials (public competitors)
- Industry associations
- Government statistics

### Secondary Sources (Lower Confidence)
- Press releases
- Expert interviews
- Survey data
- LinkedIn data (company sizes)

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
