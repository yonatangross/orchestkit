---
name: product-strategy-frameworks
description: Value Proposition Canvas, Jobs-to-be-Done (JTBD), Build/Buy/Partner decisions, and strategic product frameworks. Use when validating value propositions, understanding customer needs, or making strategic technology decisions.
context: fork
agent: product-strategist
version: 1.0.0
tags: [product, strategy, jtbd, value-proposition, build-buy-partner]
author: OrchestKit
user-invocable: false
complexity: medium
---

# Product Strategy Frameworks

Strategic frameworks for validating value propositions, understanding customer jobs, and making build/buy/partner decisions.

## Jobs-to-be-Done (JTBD) Framework

JTBD shifts focus from what a product is to why it's used. People don't buy products—they hire them to do specific jobs.

### JTBD Statement Format

```
When [situation], I want to [motivation], so I can [expected outcome].
```

**Example:**
```
When I'm commuting to work, I want to catch up on industry news,
so I can appear informed in morning meetings.
```

### Job Dimensions

| Dimension | Description | Example |
|-----------|-------------|---------|
| **Functional** | Practical task to accomplish | "Transfer money to a friend" |
| **Emotional** | How user wants to feel | "Feel confident I didn't make a mistake" |
| **Social** | How user wants to be perceived | "Appear tech-savvy to peers" |

### JTBD Discovery Process

```markdown
## Step 1: Identify Target Customer
- Who struggles most with this job?
- Who pays the most to get this job done?

## Step 2: Define the Core Job
- What is the customer ultimately trying to accomplish?
- Strip away solutions—focus on the outcome

## Step 3: Map Job Steps
1. Define what success looks like
2. Locate inputs needed
3. Prepare for the job
4. Confirm readiness
5. Execute the job
6. Monitor progress
7. Modify as needed
8. Conclude the job

## Step 4: Identify Pain Points
- Where do customers struggle?
- What causes anxiety or frustration?
- What workarounds exist?

## Step 5: Quantify Opportunity
- Importance: How important is this job? (1-10)
- Satisfaction: How satisfied with current solutions? (1-10)
- Opportunity = Importance + (Importance - Satisfaction)
```

## Value Proposition Canvas

The VPC aligns what you offer with what customers actually need.

### Customer Profile (Right Side)

```
┌─────────────────────────────────────┐
│         CUSTOMER PROFILE            │
├─────────────────────────────────────┤
│  JOBS                               │
│  • Functional jobs (tasks)          │
│  • Social jobs (how seen)           │
│  • Emotional jobs (how feel)        │
│                                     │
│  PAINS                              │
│  • Undesired outcomes               │
│  • Obstacles                        │
│  • Risks                            │
│                                     │
│  GAINS                              │
│  • Required outcomes                │
│  • Expected outcomes                │
│  • Desired outcomes                 │
│  • Unexpected outcomes              │
└─────────────────────────────────────┘
```

### Value Map (Left Side)

```
┌─────────────────────────────────────┐
│           VALUE MAP                 │
├─────────────────────────────────────┤
│  PRODUCTS & SERVICES                │
│  • What we offer                    │
│  • Features and capabilities        │
│                                     │
│  PAIN RELIEVERS                     │
│  • How we eliminate pains           │
│  • Risk reduction                   │
│  • Cost savings                     │
│                                     │
│  GAIN CREATORS                      │
│  • How we create gains              │
│  • Performance improvements         │
│  • Social/emotional benefits        │
└─────────────────────────────────────┘
```

### Fit Assessment

| Fit Level | Description | Action |
|-----------|-------------|--------|
| **Problem-Solution Fit** | Value map addresses jobs/pains/gains | Validate with interviews |
| **Product-Market Fit** | Customers actually buy/use | Measure retention, NPS |
| **Business Model Fit** | Sustainable unit economics | Track CAC, LTV, margins |

## Build vs. Buy vs. Partner Decision Matrix

### Evaluation Criteria

| Factor | Build | Buy | Partner |
|--------|-------|-----|---------|
| **Time to Market** | Slow (6-18 months) | Fast (1-3 months) | Medium (3-6 months) |
| **Cost (Year 1)** | High (dev team) | Medium (license) | Variable |
| **Cost (Year 3+)** | Lower (owned) | Higher (recurring) | Negotiable |
| **Customization** | Full control | Limited | Moderate |
| **Core Competency** | Must be core | Not core | Adjacent |
| **Competitive Advantage** | High | Low | Medium |
| **Risk** | Execution risk | Vendor lock-in | Partnership risk |

### Decision Framework

```python
def build_buy_partner_decision(
    strategic_importance: int,    # 1-10: How critical to business?
    differentiation_value: int,   # 1-10: Creates competitive advantage?
    internal_capability: int,     # 1-10: Do we have skills?
    time_sensitivity: int,        # 1-10: How urgent?
    budget_availability: int,     # 1-10: Can we fund build?
) -> str:
    """
    Returns recommended approach based on weighted factors.
    """
    build_score = (
        strategic_importance * 0.3 +
        differentiation_value * 0.3 +
        internal_capability * 0.2 +
        (10 - time_sensitivity) * 0.1 +  # Inverse: less urgent = more build
        budget_availability * 0.1
    )

    if build_score >= 7:
        return "BUILD: Core capability, invest in ownership"
    elif build_score >= 4:
        return "PARTNER: Strategic integration with flexibility"
    else:
        return "BUY: Commodity, use best-in-class vendor"
```

### Build When

- Creates lasting competitive advantage
- Core to your value proposition
- Requires deep customization
- You have the team and time
- Data/IP ownership is critical

### Buy When

- Commodity functionality (auth, payments, email)
- Time-to-market is critical
- Vendor has clear expertise edge
- Total cost of ownership favors vendor
- Maintenance burden not worth it

### Partner When

- Need capabilities but not full ownership
- Market access matters (distribution)
- Risk sharing is valuable
- Co-development opportunities exist
- Neither build nor buy fits perfectly

## Go/No-Go Decision Framework

### Stage Gate Criteria

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

### Scoring Template

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

## Key Principles

| Principle | Application |
|-----------|-------------|
| **Customer-first** | Start with jobs, not features |
| **Evidence-based** | Validate assumptions with data |
| **Strategic alignment** | Every initiative serves the mission |
| **Reversible decisions** | Prefer options that preserve flexibility |

## Related Skills

- `market-analysis-patterns` - TAM/SAM/SOM and competitive analysis
- `business-case-analysis` - ROI and financial modeling
- `requirements-engineering` - Translating strategy to specs

## References

- [Value Proposition Canvas](references/value-proposition-canvas.md)
- [JTBD Interview Guide](references/jtbd-interview-guide.md)

**Version:** 1.0.0 (January )
