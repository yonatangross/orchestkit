# ROI Calculation Guide

Comprehensive guide for calculating Return on Investment for product decisions.

## Basic ROI Formula

```
ROI = ((Net Benefit) / Total Investment) × 100%

Net Benefit = Total Benefits - Total Costs
```

## Detailed Cost Breakdown

### One-Time Costs (CAPEX)

```
Development Costs
├── Engineering hours × hourly rate
├── Design/UX hours × hourly rate
├── QA/Testing hours × hourly rate
├── Project management overhead (15-20%)
└── Infrastructure setup

Example:
- 4 engineers × 40 hrs/week × 4 weeks × $100/hr = $64,000
- 1 designer × 40 hrs/week × 2 weeks × $90/hr = $7,200
- QA (20% of eng) = $12,800
- PM overhead (15%) = $12,600
Total Development: $96,600
```

### Recurring Costs (OPEX)

```
Operational Costs (Annual)
├── Infrastructure (hosting, compute)
├── Maintenance (10-20% of dev cost)
├── Support (tickets × cost/ticket)
├── Monitoring/observability
└── Security/compliance

Example:
- Infrastructure: $12,000/year
- Maintenance (15%): $14,490/year
- Support: 50 tickets/month × $20 = $12,000/year
Total Annual: $38,490
```

### Opportunity Costs

What else could we do with these resources?

- Delayed features (revenue impact)
- Team context switching
- Technical debt not addressed
- Market timing missed

## Benefit Categories

### Quantifiable Revenue Benefits

```
Revenue Benefits
├── New customer acquisition
│   └── New customers × ARPU × 12 months
├── Upsell/expansion
│   └── Existing customers × upsell rate × additional ARPU
├── Reduced churn
│   └── Customers retained × ARPU × months retained
└── Price increase enablement
    └── Customers × price increase
```

### Quantifiable Cost Savings

```
Cost Savings
├── Reduced support tickets
│   └── Tickets reduced × cost/ticket
├── Faster onboarding
│   └── Time saved × support hourly rate
├── Automation savings
│   └── Hours automated × employee hourly rate
└── Infrastructure efficiency
    └── Resources freed × cost
```

### Intangible Benefits

Document but don't include in ROI calculation:
- Market positioning
- Developer experience
- Brand/reputation
- Technical foundation for future features

## Example ROI Calculation

```markdown
## Investment: Search Feature Improvement

### Costs (3-Year Total)
| Category | Year 1 | Year 2 | Year 3 | Total |
|----------|--------|--------|--------|-------|
| Development | $96,600 | $0 | $0 | $96,600 |
| Infrastructure | $12,000 | $12,600 | $13,230 | $37,830 |
| Maintenance | $14,490 | $15,215 | $15,975 | $45,680 |
| **Total Costs** | $123,090 | $27,815 | $29,205 | **$180,110** |

### Benefits (3-Year Total)
| Category | Year 1 | Year 2 | Year 3 | Total |
|----------|--------|--------|--------|-------|
| New Revenue | $120,000 | $180,000 | $240,000 | $540,000 |
| Cost Savings | $36,000 | $42,000 | $48,000 | $126,000 |
| **Total Benefits** | $156,000 | $222,000 | $288,000 | **$666,000** |

### ROI Calculation
- Total Investment: $180,110
- Total Benefits: $666,000
- Net Benefit: $485,890
- ROI: (485,890 / 180,110) × 100% = **270%**
- Payback Period: $180,110 / ($666,000/36 months) = **9.7 months**
```

## Payback Period

```
Payback Period = Total Investment / Monthly Net Benefit

Good: < 12 months
Acceptable: 12-24 months
Risky: > 24 months
```

## Sensitivity Analysis

Always calculate three scenarios:

| Scenario | Assumption | ROI |
|----------|------------|-----|
| Conservative (P10) | 50% of expected benefits | X% |
| Base Case (P50) | Expected benefits | Y% |
| Optimistic (P90) | 150% of expected benefits | Z% |

## Common Mistakes

| Mistake | Correction |
|---------|------------|
| Forgetting opportunity cost | Include what else could be built |
| Single-point estimates | Use ranges and scenarios |
| Ignoring maintenance | Add 10-20% annually |
| Counting intangibles | Keep separate from hard ROI |
| Not discounting future | Apply discount rate for NPV |
