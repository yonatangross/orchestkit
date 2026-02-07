---
name: business-case-analysis
description: ROI, NPV, IRR, payback period, and total cost of ownership analysis for investment decisions. Use when building financial justification for projects, evaluating SaaS investments, or comparing alternatives.
context: fork
agent: business-case-builder
version: 1.0.0
tags: [product, finance, roi, npv, irr, tco, business-case]
author: OrchestKit
user-invocable: false
complexity: low
---

# Business Case Analysis

Financial frameworks for justifying investments, evaluating projects, and comparing alternatives.

## Key Financial Metrics

### Return on Investment (ROI)

Simple measure of profitability relative to cost.

```
ROI = (Net Benefits - Total Costs) / Total Costs × 100%
```

**Example:**
```
Project cost: $500,000
Annual benefits: $200,000 over 5 years

Total benefits: $1,000,000
ROI = ($1,000,000 - $500,000) / $500,000 × 100% = 100%
```

**Limitation:** Does not account for time value of money.

### Net Present Value (NPV)

Gold standard for project evaluation—discounts future cash flows to present value.

```
NPV = Σ (Cash Flow_t / (1 + r)^t) - Initial Investment
```

Where:
- `t` = time period
- `r` = discount rate (cost of capital)

**Example:**
```python
def calculate_npv(
    initial_investment: float,
    cash_flows: list[float],
    discount_rate: float = 0.10  # 10% typical
) -> float:
    npv = -initial_investment
    for t, cf in enumerate(cash_flows, start=1):
        npv += cf / ((1 + discount_rate) ** t)
    return npv

# Example: $500K investment, $200K/year for 5 years
npv = calculate_npv(500_000, [200_000] * 5, 0.10)
# NPV = $258,157 (positive = good investment)
```

**Decision Rule:**
- NPV > 0: Accept (creates value)
- NPV < 0: Reject (destroys value)
- NPV = 0: Indifferent

### Internal Rate of Return (IRR)

The discount rate at which NPV equals zero.

```python
def calculate_irr(cash_flows: list[float]) -> float:
    """
    cash_flows[0] is initial investment (negative)
    Returns the IRR as a decimal
    """
    from scipy.optimize import brentq

    def npv_at_rate(r):
        return sum(cf / (1 + r) ** t for t, cf in enumerate(cash_flows))

    return brentq(npv_at_rate, -0.99, 10.0)

# Example: -$500K initial, then $200K/year for 5 years
irr = calculate_irr([-500_000, 200_000, 200_000, 200_000, 200_000, 200_000])
# IRR ≈ 28.6%
```

**Decision Rule:**
- IRR > hurdle rate (cost of capital): Accept
- IRR < hurdle rate: Reject

**Typical Hurdle Rates ():**
- Conservative enterprise: 10-12%
- Growth company: 15-20%
- Startup: 25-40%

### Payback Period

Time to recover initial investment.

```
Payback Period = Initial Investment / Annual Cash Flow
```

**Example:**
```
Investment: $500,000
Annual savings: $200,000
Payback = $500,000 / $200,000 = 2.5 years
```

**Typical Expectations ():**
- SaaS investments: 6-12 months
- Enterprise platforms: 12-24 months
- Infrastructure: 24-36 months

## Total Cost of Ownership (TCO)

### Build vs. Buy TCO Comparison

```markdown
## Build Option (3-Year TCO)

### Year 1
| Category | Cost |
|----------|------|
| Development team (4 FTEs × $150K) | $600,000 |
| Infrastructure setup | $50,000 |
| Tools & licenses | $20,000 |
| **Year 1 Total** | **$670,000** |

### Year 2-3 (Maintenance)
| Category | Annual Cost |
|----------|-------------|
| Maintenance team (2 FTEs) | $300,000 |
| Infrastructure | $60,000 |
| Technical debt | $50,000 |
| **Annual Total** | **$410,000** |

### 3-Year Build TCO: $1,490,000

---

## Buy Option (3-Year TCO)

| Category | Annual Cost |
|----------|-------------|
| SaaS license (100 users × $500) | $50,000 |
| Implementation (Year 1 only) | $100,000 |
| Training | $20,000 |
| Integration maintenance | $30,000 |
| **Year 1** | **$200,000** |
| **Year 2-3** | **$100,000/year** |

### 3-Year Buy TCO: $400,000
```

### Hidden Costs to Include

| Category | Build | Buy |
|----------|-------|-----|
| Opportunity cost | Yes - team could work on other things | No |
| Learning curve | Yes - building expertise | Yes - learning vendor |
| Switching costs | N/A | Yes - vendor lock-in |
| Downtime risk | Yes - you own uptime | Partial - SLA coverage |
| Security/compliance | Yes - your responsibility | Shared - vendor handles some |

## SaaS Investment Business Case Template

```markdown
# Business Case: [Project Name]

## Executive Summary
[2-3 sentence summary of investment and expected return]

## Problem Statement
- Current pain points
- Quantified impact (hours lost, revenue impact, etc.)

## Proposed Solution
- What we're investing in
- Key capabilities

## Financial Analysis

### Investment Required
| Item | One-Time | Annual |
|------|----------|--------|
| Software license | | $X |
| Implementation | $X | |
| Training | $X | |
| Integration | $X | $X |
| **Total** | **$X** | **$X** |

### Expected Benefits
| Benefit | Annual Value | Confidence |
|---------|--------------|------------|
| Time savings (X hrs × $Y/hr) | $X | High |
| Error reduction | $X | Medium |
| Revenue increase | $X | Low |
| **Total** | **$X** | |

### Key Metrics
| Metric | Value |
|--------|-------|
| 3-Year TCO | $X |
| 3-Year Benefits | $X |
| NPV (10% discount) | $X |
| IRR | X% |
| Payback Period | X months |
| ROI | X% |

## Risk Analysis
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| | | | |

## Recommendation
[GO / NO-GO with rationale]

## Appendix
- Detailed calculations
- Vendor comparison
- Implementation timeline
```

## Sensitivity Analysis

Test how results change with different assumptions.

```markdown
## NPV Sensitivity Analysis

| Scenario | Discount Rate | Year 1 Benefits | NPV |
|----------|---------------|-----------------|-----|
| Base case | 10% | $200,000 | $258,157 |
| Conservative | 15% | $150,000 | $102,345 |
| Optimistic | 8% | $250,000 | $412,890 |
| Pessimistic | 12% | $120,000 | $32,456 |
```

## Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Overestimating benefits | Use conservative estimates, document assumptions |
| Ignoring soft costs | Include training, change management, productivity dip |
| Underestimating timeline | Add 30-50% buffer to implementation estimates |
| Sunk cost fallacy | Evaluate future costs/benefits only |
| Confirmation bias | Have skeptic review the case |

##  Trends

- **AI cost integration**: Factor in AI/ML infrastructure costs and benefits
- **Carbon accounting**: Include sustainability metrics in TCO
- **Real-time ROI tracking**: Connect to BI dashboards for continuous measurement
- **Vendor consolidation**: Average tech stack dropped from 130 to 106 apps

## Related Skills

- `product-strategy-frameworks` - Strategic context for investments
- `prioritization-frameworks` - Comparing multiple investment options
- `okr-kpi-patterns` - Tracking investment outcomes

## References

- [NPV Calculator](references/npv-calculator.md)
- [SaaS Business Case Template](references/saas-business-case-template.md)

**Version:** 1.0.0 (January )
