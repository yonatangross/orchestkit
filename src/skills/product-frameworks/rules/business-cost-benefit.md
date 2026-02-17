---
title: "Business: Cost-Benefit & TCO"
category: business
impact: HIGH
impactDescription: "Ensures comprehensive cost-benefit analysis including build vs. buy TCO comparisons and hidden costs"
tags: tco, cost-benefit, build-vs-buy, roi, business-case
---

# Cost-Benefit & Total Cost of Ownership

## Build vs. Buy TCO Comparison

```markdown
## Build Option (3-Year TCO)

### Year 1
| Category | Cost |
|----------|------|
| Development team (4 FTEs x $150K) | $600,000 |
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
| SaaS license (100 users x $500) | $50,000 |
| Implementation (Year 1 only) | $100,000 |
| Training | $20,000 |
| Integration maintenance | $30,000 |
| **Year 1** | **$200,000** |
| **Year 2-3** | **$100,000/year** |

### 3-Year Buy TCO: $400,000
```

## Hidden Costs to Include

| Category | Build | Buy |
|----------|-------|-----|
| Opportunity cost | Yes - team could work on other things | No |
| Learning curve | Yes - building expertise | Yes - learning vendor |
| Switching costs | N/A | Yes - vendor lock-in |
| Downtime risk | Yes - you own uptime | Partial - SLA coverage |
| Security/compliance | Yes - your responsibility | Shared - vendor handles some |

## Business Case Template

```markdown
# Business Case: [Project Name]

## Executive Summary
[2-3 sentence summary of investment and expected return]

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
| Time savings (X hrs x $Y/hr) | $X | High |
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
```

## Sensitivity Analysis

Test how results change with different assumptions.

| Scenario | Discount Rate | Year 1 Benefits | NPV |
|----------|---------------|-----------------|-----|
| Base case | 10% | $200,000 | $258,157 |
| Conservative | 15% | $150,000 | $102,345 |
| Optimistic | 8% | $250,000 | $412,890 |
| Pessimistic | 12% | $120,000 | $32,456 |

## Cost Breakdown Framework

### One-Time Costs (CAPEX)

```
Development Costs
+-- Engineering hours x hourly rate
+-- Design/UX hours x hourly rate
+-- QA/Testing hours x hourly rate
+-- Project management overhead (15-20%)
+-- Infrastructure setup
```

### Recurring Costs (OPEX)

```
Operational Costs (Annual)
+-- Infrastructure (hosting, compute)
+-- Maintenance (10-20% of dev cost)
+-- Support (tickets x cost/ticket)
+-- Monitoring/observability
+-- Security/compliance
```

**Incorrect — Ignoring hidden costs and opportunity cost:**
```markdown
## Cost Analysis
Total development cost: $500,000
Expected benefit: $1M over 3 years
ROI: 100% - APPROVED
```

**Correct — Comprehensive TCO with hidden costs:**
```markdown
## 3-Year TCO Analysis
Development: $500,000
Maintenance (Years 2-3): $300,000/year = $600,000
Opportunity cost (team could build $800K revenue feature): $800,000
Total TCO: $1,900,000

Benefits: $1,000,000
Net: -$900,000 - REJECTED
```
