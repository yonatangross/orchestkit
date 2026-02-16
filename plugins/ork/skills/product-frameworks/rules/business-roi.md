---
title: "Business: ROI & Financial Metrics"
category: business
impact: HIGH
impactDescription: "Ensures accurate financial analysis using NPV, IRR, and ROI calculations with time value of money"
tags: roi, npv, irr, financial-metrics, payback-period
---

# ROI & Financial Metrics

Financial frameworks for justifying investments and evaluating projects.

## Return on Investment (ROI)

```
ROI = (Net Benefits - Total Costs) / Total Costs x 100%
```

**Example:**
```
Project cost: $500,000
Annual benefits: $200,000 over 5 years

Total benefits: $1,000,000
ROI = ($1,000,000 - $500,000) / $500,000 x 100% = 100%
```

**Limitation:** Does not account for time value of money.

## Net Present Value (NPV)

Gold standard for project evaluation -- discounts future cash flows to present value.

```
NPV = Sum(Cash Flow_t / (1 + r)^t) - Initial Investment
```

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

## Internal Rate of Return (IRR)

The discount rate at which NPV equals zero.

```python
def calculate_irr(cash_flows: list[float]) -> float:
    """cash_flows[0] is initial investment (negative)"""
    from scipy.optimize import brentq

    def npv_at_rate(r):
        return sum(cf / (1 + r) ** t for t, cf in enumerate(cash_flows))

    return brentq(npv_at_rate, -0.99, 10.0)

# Example: -$500K initial, then $200K/year for 5 years
irr = calculate_irr([-500_000, 200_000, 200_000, 200_000, 200_000, 200_000])
# IRR ~ 28.6%
```

**Decision Rule:**
- IRR > hurdle rate: Accept
- IRR < hurdle rate: Reject

**Typical Hurdle Rates:**
- Conservative enterprise: 10-12%
- Growth company: 15-20%
- Startup: 25-40%

## Payback Period

```
Payback Period = Initial Investment / Annual Cash Flow
```

**Typical Expectations:**
- SaaS investments: 6-12 months
- Enterprise platforms: 12-24 months
- Infrastructure: 24-36 months

## Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Overestimating benefits | Use conservative estimates, document assumptions |
| Ignoring soft costs | Include training, change management, productivity dip |
| Underestimating timeline | Add 30-50% buffer to implementation estimates |
| Sunk cost fallacy | Evaluate future costs/benefits only |
| Confirmation bias | Have skeptic review the case |
