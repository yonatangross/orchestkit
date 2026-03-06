---
name: business-case
description: "ROI, NPV, IRR, payback period, and TCO calculations for investment decisions. Use when building financial justification, cost-benefit analysis, build-vs-buy comparisons, or sensitivity analysis."
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
tags: [roi, npv, irr, tco, build-vs-buy, financial-analysis, cost-benefit]
context: fork
agent: product-strategist
metadata:
  category: document-asset-creation
allowed-tools: [Read, Glob, Grep, WebFetch, WebSearch]
---

# Business Case

Financial frameworks for investment justification and decision support.

## When to Use Each Framework

| Framework | Use When |
|-----------|----------|
| **ROI** | Quick sanity check; time value of money doesn't matter much |
| **NPV** | Multi-year investments; gold standard for GO/NO-GO |
| **IRR** | Comparing projects competing for the same budget |
| **Payback Period** | Leadership asks "how fast do we break even?" |
| **TCO** | Build vs. buy; total cost including hidden/ongoing costs |
| **Sensitivity Analysis** | High uncertainty; need to stress-test assumptions |

## Decision Tree

```
Is the investment multi-year?
  YES → Use NPV (+ IRR to compare alternatives)
  NO  → ROI is sufficient

Is this a build vs. buy decision?
  YES → TCO comparison across all three options
  NO  → Skip TCO, use NPV/ROI

Are assumptions uncertain?
  YES → Add sensitivity analysis (3 scenarios)
  NO  → Base case only
```

## Quick Reference Formulas

```
ROI = (Net Benefits - Total Costs) / Total Costs × 100%

NPV = Sum(Cash Flow_t / (1 + r)^t) - Initial Investment
  r = discount rate (10% enterprise, 15-20% growth, 25-40% startup)
  Decision: Accept if NPV > 0

IRR = discount rate where NPV = 0
  Decision: Accept if IRR > hurdle rate

Payback Period = Initial Investment / Annual Cash Flow
  Benchmarks: SaaS 6-12 mo, Enterprise platform 12-24 mo, Infra 24-36 mo

TCO = CAPEX + (OPEX × years) + Opportunity Cost + Hidden Costs
```

## Business Case Template

```markdown
# Business Case: [Project Name]

## Executive Summary
[2-3 sentences: what we're investing in and expected return]

## Financial Analysis

### Investment Required
| Item | One-Time | Annual |
|------|----------|--------|
| Development | $X | |
| License / SaaS | | $X |
| Implementation | $X | |
| Training | $X | |
| Maintenance | | $X |
| **Total** | **$X** | **$X** |

### Expected Benefits
| Benefit | Annual Value | Confidence |
|---------|--------------|------------|
| Time savings (X hrs × $Y/hr) | $X | High |
| Error reduction | $X | Medium |
| Revenue uplift | $X | Low |
| **Total** | **$X** | |

### Key Metrics
| Metric | Value |
|--------|-------|
| 3-Year TCO | $X |
| NPV (10% discount) | $X |
| IRR | X% |
| Payback Period | X months |
| ROI | X% |

## Sensitivity Analysis
| Scenario | Discount Rate | Year 1 Benefits | NPV |
|----------|---------------|-----------------|-----|
| Base case | 10% | $X | $X |
| Conservative | 15% | $X × 0.75 | $X |
| Optimistic | 8% | $X × 1.25 | $X |

## Risk Analysis
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| | | | |

## Recommendation
[GO / NO-GO] — [one-sentence rationale]
```

## TCO: Build vs. Buy vs. Partner

See [rules/business-cost-benefit.md](rules/business-cost-benefit.md) for the full 3-year TCO template and hidden cost checklist.

Key hidden costs to never omit:

| Category | Build | Buy |
|----------|-------|-----|
| Opportunity cost | Yes — team blocked from other work | No |
| Switching costs | N/A | Yes — vendor lock-in |
| Downtime risk | You own uptime | Partial SLA coverage |
| Security/compliance | Your responsibility | Shared |

## Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Simple ROI without time value | Always use NPV for multi-year decisions |
| Ignoring soft costs (training, change mgmt) | Add 30% buffer to implementation estimates |
| Optimistic benefit estimates | Use conservative estimates, document assumptions |
| Sunk cost included in forward analysis | Evaluate future costs/benefits only |
| No sensitivity analysis | Always test conservative + optimistic scenarios |

## References

- [ROI & Financial Metrics](rules/business-roi.md) — NPV, IRR, payback period formulas with code examples
- [Cost-Benefit & TCO](rules/business-cost-benefit.md) — Build vs. buy TCO template, hidden costs, sensitivity analysis
- [ROI Calculation Guide](references/roi-calculation-guide.md) — Detailed cost breakdown (CAPEX/OPEX/opportunity cost)
- [Build-Buy-Partner Decision](references/build-buy-partner-decision.md) — Scoring matrix across 5 dimensions

## Related Skills

- `ork:market-sizing` — Size the opportunity before building the business case
- `ork:competitive-analysis` — Assess competitive context and moat for the investment
- `ork:product-frameworks` — Full product strategy toolkit (prioritization, OKRs, personas)

---

Version: 1.0.0
