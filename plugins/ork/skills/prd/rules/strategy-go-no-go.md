---
title: Evaluate go/no-go decisions with stage gates and build/buy/partner strategic analysis
category: strategy
impact: HIGH
impactDescription: "Ensures systematic evaluation using stage gates and strategic analysis for build/buy/partner decisions"
tags: go-no-go, build-vs-buy, stage-gates, strategic-decisions
---

# Go/No-Go & Build/Buy/Partner Decisions

## Stage Gate Criteria

```markdown
## Gate 1: Opportunity Validation
- [ ] Clear customer problem identified (JTBD defined)
- [ ] Market size sufficient (TAM > $100M)
- [ ] Strategic alignment confirmed
- [ ] No legal/regulatory blockers

## Gate 2: Solution Validation
- [ ] Value proposition tested with customers
- [ ] Technical feasibility confirmed
- [ ] Competitive differentiation clear
- [ ] Unit economics viable (projected)

## Gate 3: Business Case
- [ ] ROI > hurdle rate (typically 15-25%)
- [ ] Payback period acceptable (< 24 months)
- [ ] Resource requirements confirmed
- [ ] Risk mitigation plan in place

## Gate 4: Launch Readiness
- [ ] MVP complete and tested
- [ ] Go-to-market plan ready
- [ ] Success metrics defined
- [ ] Support/ops prepared
```

## Scoring Template

| Criterion | Weight | Score (1-10) | Weighted |
|-----------|--------|--------------|----------|
| Market opportunity | 20% | | |
| Strategic fit | 20% | | |
| Competitive position | 15% | | |
| Technical feasibility | 15% | | |
| Financial viability | 15% | | |
| Team capability | 10% | | |
| Risk profile | 5% | | |
| **TOTAL** | 100% | | |

**Decision Thresholds:**
- **Go**: Score >= 7.0
- **Conditional Go**: Score 5.0-6.9 (address gaps)
- **No-Go**: Score < 5.0

## Build vs. Buy vs. Partner Decision Matrix

| Factor | Build | Buy | Partner |
|--------|-------|-----|---------|
| **Time to Market** | Slow (6-18 months) | Fast (1-3 months) | Medium (3-6 months) |
| **Cost (Year 1)** | High (dev team) | Medium (license) | Variable |
| **Cost (Year 3+)** | Lower (owned) | Higher (recurring) | Negotiable |
| **Customization** | Full control | Limited | Moderate |
| **Core Competency** | Must be core | Not core | Adjacent |
| **Competitive Advantage** | High | Low | Medium |
| **Risk** | Execution risk | Vendor lock-in | Partnership risk |

## Decision Framework

```python
def build_buy_partner_decision(
    strategic_importance: int,    # 1-10
    differentiation_value: int,   # 1-10
    internal_capability: int,     # 1-10
    time_sensitivity: int,        # 1-10
    budget_availability: int,     # 1-10
) -> str:
    build_score = (
        strategic_importance * 0.3 +
        differentiation_value * 0.3 +
        internal_capability * 0.2 +
        (10 - time_sensitivity) * 0.1 +
        budget_availability * 0.1
    )
    if build_score >= 7:
        return "BUILD: Core capability, invest in ownership"
    elif build_score >= 4:
        return "PARTNER: Strategic integration with flexibility"
    else:
        return "BUY: Commodity, use best-in-class vendor"
```

## Decision Tree

```
Is this a core differentiator?
+-- YES -> BUILD (protects competitive advantage)
+-- NO -> Is there a mature solution available?
         +-- YES -> BUY (fastest time to value)
         +-- NO -> Is there a strategic partner?
                  +-- YES -> PARTNER (shared risk/reward)
                  +-- NO -> BUILD (must create capability)
```

## When to Build / Buy / Partner

### Build When
- Creates lasting competitive advantage
- Core to your value proposition
- Requires deep customization
- Data/IP ownership is critical

### Buy When
- Commodity functionality (auth, payments, email)
- Time-to-market is critical
- Vendor has clear expertise edge
- Total cost of ownership favors vendor

### Partner When
- Need capabilities but not full ownership
- Market access matters (distribution)
- Risk sharing is valuable
- Neither build nor buy fits perfectly

**Incorrect — Go/No-Go without scoring criteria:**
```markdown
Idea: Build AI feature
Team: Excited about it
Decision: GO
```

**Correct — Systematic stage gate evaluation:**
```markdown
Gate 3: Business Case
- [ ] ROI > 15% hurdle rate: YES (22%)
- [ ] Payback < 24 months: YES (18 months)
- [ ] Resource requirements: 3 FTEs available
- [ ] Risk mitigation: Technical POC validated

Weighted Score: 7.2/10
Decision: GO (>= 7.0 threshold)
```
