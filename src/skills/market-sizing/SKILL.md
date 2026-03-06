---
name: market-sizing
description: "TAM, SAM, SOM market sizing with top-down and bottom-up methods. Use when estimating addressable market, validating opportunity size, sizing new segments, or preparing investor pitch materials."
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
tags: [tam, sam, som, market-size, addressable-market, opportunity-sizing]
context: fork
agent: product-strategist
metadata:
  category: document-asset-creation
allowed-tools: [Read, Glob, Grep, WebFetch, WebSearch]
---

# Market Sizing

TAM/SAM/SOM framework for estimating addressable market and validating opportunity size.

## Definitions

| Metric | Definition | Question It Answers |
|--------|------------|---------------------|
| **TAM** | Total Addressable Market — everyone who could possibly buy | "What's the theoretical ceiling?" |
| **SAM** | Serviceable Addressable Market — segment you can actually reach | "What can we realistically target?" |
| **SOM** | Serviceable Obtainable Market — realistic share in 3 years | "What will we actually capture?" |

```
+-------------------------------------------------------+
|                         TAM                            |
|  +---------------------------------------------------+ |
|  |                      SAM                           | |
|  |  +-----------------------------------------------+| |
|  |  |                   SOM                          || |
|  |  +-----------------------------------------------+| |
|  +---------------------------------------------------+ |
+-------------------------------------------------------+
```

## When to Use Top-Down vs. Bottom-Up

| Method | Use When | Risk |
|--------|----------|------|
| **Top-Down** | Industry reports exist; investor pitch; quick estimate | Overestimates SOM |
| **Bottom-Up** | Sales capacity known; pricing validated; more credible | More work; requires assumptions |
| **Both (recommended)** | High-stakes decisions; fundraising; board decks | Cross-validate to build confidence |

Always cross-validate both methods and reconcile within 20%. If they diverge by more than that, revisit your assumptions.

## Quick Formulas

```
Top-Down
  TAM = (# potential customers) × (annual value per customer)
  SAM = TAM × (% your solution can address)
  SOM = SAM × (realistic market share % in 3 years)

Bottom-Up
  SOM = (# customers you can acquire) × (average deal size)
  SAM = SOM / (your expected market share %)
  TAM = SAM / (your segment as % of total market)
```

## Example: AI Code Review Tool

```markdown
## Market Sizing: AI Code Review Tool

### Top-Down

TAM
- Global developers: 28M
- Using code review tools: 60% → 16.8M
- Average annual spend: $300/developer
- TAM = $5.04B

SAM
- Enterprise only (>500 employees): 8M developers
- Willing to pay premium: 40% → 3.2M
- SAM = $960M

SOM
- Sales capacity supports ~$15M ARR (Year 3)
- Realistic market share: 2%
- Unconstrained SOM = $960M × 2% = $19.2M
- Constrained SOM = min($19.2M, $15M) = $15M

### Bottom-Up
- Target accounts Year 1: 50 enterprise deals
- Average ACV: $100K
- Year 1 ARR: $5M
- Year 3 (3× growth): $15M ARR → SOM = $15M

### Reconciled SOM: $15M (confirmed by both methods)
```

## SOM Constraint Model

Do not report an unconstrained SOM. Always apply real-world limits:

```
SOM constraints:
  Sales capacity:       supports $15M ARR max
  Competitive pressure: 5 strong incumbents → −20% market share
  Go-to-market reach:   70% of SAM reachable with current channels

Conservative SOM = min(
  SAM × target_share%,
  sales_capacity_ceiling,
  SAM × gtm_reach% × target_share%
)
```

## Confidence Levels

| Confidence | Evidence Required |
|------------|------------------|
| HIGH | Multiple corroborating sources, data < 2 years old |
| MEDIUM | Single authoritative source, 1-2 years old |
| LOW | Extrapolated, heavy assumptions, data > 2 years old |

Always label each number with its confidence level in deliverables.

## Common Mistakes

| Mistake | Correction |
|---------|------------|
| TAM = "everyone on earth" | Define a specific, bounded customer segment |
| SOM = 10% of a billion-dollar market | Apply actual sales capacity and GTM constraints |
| Single method only | Cross-validate top-down and bottom-up |
| Old data | Use sources < 2 years old; flag if older |
| Ignoring competition | SOM must account for incumbents' share |

## References

- [TAM/SAM/SOM Rules](rules/market-tam-sam-som.md) — Calculation methods, SOM constraint model, cross-referencing
- [TAM/SAM/SOM Guide](references/tam-sam-som-guide.md) — Detailed guide with data source recommendations

## Related Skills

- `ork:competitive-analysis` — Understand competitive dynamics that constrain SOM
- `ork:business-case` — Build financial justification once opportunity is sized
- `ork:product-frameworks` — Full product strategy toolkit

---

Version: 1.0.0
