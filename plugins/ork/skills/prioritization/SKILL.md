---
name: prioritization
description: "Prioritization frameworks — RICE, WSJF, ICE, MoSCoW, and opportunity cost scoring for backlog ranking. Use when prioritizing features, comparing initiatives, justifying roadmap decisions, or evaluating trade-offs between competing work items."
tags: [rice, wsjf, ice, moscow, prioritization, backlog, scoring, ranking]
context: fork
agent: product-strategist
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools: [Read, Glob, Grep, WebFetch, WebSearch]
---

# Prioritization Frameworks

Score, rank, and justify backlog decisions using the right framework for the situation.

## Decision Tree: Which Framework to Use

```
Do you have a hard deadline or regulatory pressure?
  YES → WSJF (Cost of Delay drives sequencing)
  NO  → Do you have reach/usage data?
          YES → RICE (data-driven, accounts for user reach)
          NO  → Are you in a time-boxed planning session?
                  YES → ICE (fast, 1-10 scales, no data required)
                  NO  → Is this a scope negotiation with stakeholders?
                          YES → MoSCoW (bucket features, control scope creep)
                          NO  → Value-Effort Matrix (quick 2x2 triage)
```

| Framework | Best For | Data Required | Time to Score |
|-----------|----------|---------------|---------------|
| RICE | Data-rich teams, steady-state prioritization | Analytics, user counts | 30-60 min |
| WSJF | SAFe orgs, time-sensitive or regulated work | Relative estimates only | 15-30 min |
| ICE | Startup speed, early validation, quick triage | None | 5-10 min |
| MoSCoW | Scope negotiation, release planning | Stakeholder input | 1-2 hours |
| Value-Effort | 2x2 visual, quick team alignment | None | 10-15 min |

---

## RICE

```
RICE Score = (Reach × Impact × Confidence) / Effort
```

| Factor | Scale | Notes |
|--------|-------|-------|
| Reach | Actual users/quarter | Use analytics; do not estimate |
| Impact | 0.25 / 0.5 / 1 / 2 / 3 | Minimal → Massive per user |
| Confidence | 0.3 / 0.5 / 0.8 / 1.0 | Moonshot → Strong data |
| Effort | Person-months | Include design, eng, QA |

```markdown
## RICE Scoring: [Feature Name]

| Feature     | Reach  | Impact | Confidence | Effort | Score  |
|-------------|--------|--------|------------|--------|--------|
| Smart search| 50,000 | 2      | 0.8        | 3      | 26,667 |
| CSV export  | 10,000 | 0.5    | 1.0        | 0.5    | 10,000 |
| Dark mode   | 30,000 | 0.25   | 1.0        | 1      |  7,500 |
```

See [rules/prioritize-rice.md](rules/prioritize-rice.md) for ICE, Kano, and full scale tables.

---

## WSJF

```
WSJF = Cost of Delay / Job Size
Cost of Delay = User Value + Time Criticality + Risk Reduction  (1-21 Fibonacci each)
```

Higher WSJF = do first. Fibonacci scale (1, 2, 3, 5, 8, 13, 21) forces relative sizing.

```markdown
## WSJF: GDPR Compliance Update

User Value:       8   (required for EU customers)
Time Criticality: 21  (regulatory deadline this quarter)
Risk Reduction:   13  (avoids significant fines)
Job Size:          8  (medium complexity)

Cost of Delay = 8 + 21 + 13 = 42
WSJF = 42 / 8 = 5.25
```

See [rules/prioritize-wsjf.md](rules/prioritize-wsjf.md) for MoSCoW buckets and practical tips.
See [references/wsjf-guide.md](references/wsjf-guide.md) for the full scoring guide.

---

## ICE

```
ICE Score = Impact × Confidence × Ease    (all factors 1-10)
```

No user data required. Score relative to other backlog items. Useful for early-stage products and rapid triage sessions.

---

## MoSCoW

Bucket features before estimation. Must-Haves alone should ship a viable product.

```markdown
## Release 1.0 MoSCoW

### Must Have (~60% of effort)
- [ ] User authentication
- [ ] Core CRUD operations

### Should Have (~20%)
- [ ] Search, export, notifications

### Could Have (~20%)
- [ ] Dark mode, keyboard shortcuts

### Won't Have (documented out-of-scope)
- Mobile app (Release 2.0)
- AI features (Release 2.0)
```

---

## Opportunity Cost & Trade-Off Analysis

When two items compete for the same team capacity, quantify what delaying each item costs per month.

```markdown
## Trade-Off: AI Search vs Platform Migration (Q2 eng team)

### Option A: AI Search
- Cost of Delay: $25K/month (competitive risk)
- RICE Score: 18,000
- Effort: 6 weeks

### Option B: Platform Migration
- Cost of Delay: $5K/month (tech debt interest)
- RICE Score: 4,000
- Effort: 8 weeks

### Recommendation
Human decides. Key factors:
1. Q2 OKR: Increase trial-to-paid conversion (favors AI Search)
2. Engineering capacity: Only one team, sequential not parallel
3. Customer commitment: No contractual deadline for either
```

See [rules/prioritize-opportunity-cost.md](rules/prioritize-opportunity-cost.md) for the Value-Effort Matrix and full trade-off template.
See [references/rice-scoring-guide.md](references/rice-scoring-guide.md) for detailed RICE calibration.

---

## Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Gaming scores to justify pre-decided work | Calibrate as a team; document assumptions |
| Mixing frameworks in one table | Pick one framework per planning session |
| Only tracking high-RICE items; ignoring cost of delay | Combine RICE with explicit delay cost analysis |
| MoSCoW Must-Have bloat (>70% of scope) | Must-Haves alone must ship a viable product |
| Comparing RICE scores across different goals | Only compare within the same objective |

---

## Related Skills

- `product-frameworks` — Full PM toolkit (value prop, market sizing, competitive analysis, user research, business case)
- `write-prd` — Convert prioritized features into product requirements documents
- `product-analytics` — Define and instrument the metrics that feed RICE reach/impact scores
- `okr-design` — Set the objectives that determine which KPIs drive RICE impact scoring
- `market-sizing` — TAM/SAM/SOM analysis that informs strategic priority
- `competitive-analysis` — Competitor context that raises or lowers WSJF time criticality scores

---

**Version:** 1.0.0
