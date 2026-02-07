---
name: prioritization-frameworks
description: RICE, ICE, WSJF, MoSCoW and other prioritization frameworks for product backlogs. Use when scoring features, ranking initiatives, or deciding what to build next.
context: fork
agent: prioritization-analyst
version: 1.0.0
tags: [product, prioritization, rice, ice, wsjf, moscow, backlog]
author: OrchestKit
user-invocable: false
complexity: low
---

# Prioritization Frameworks

Quantitative and qualitative frameworks for ranking features, initiatives, and backlog items.

## RICE Framework

Developed by Intercom, RICE provides a data-driven score for comparing features.

### Formula

```
RICE Score = (Reach × Impact × Confidence) / Effort
```

### Factors

| Factor | Definition | Scale |
|--------|------------|-------|
| **Reach** | Users/customers affected per quarter | Actual number |
| **Impact** | Effect on individual user | 0.25 (minimal) to 3 (massive) |
| **Confidence** | How sure are you? | 0.5 (low) to 1.0 (high) |
| **Effort** | Person-months required | Actual estimate |

### Impact Scale

| Score | Level | Description |
|-------|-------|-------------|
| 3 | Massive | Fundamental improvement |
| 2 | High | Significant improvement |
| 1 | Medium | Noticeable improvement |
| 0.5 | Low | Minor improvement |
| 0.25 | Minimal | Barely noticeable |

### Confidence Scale

| Score | Level | Evidence |
|-------|-------|----------|
| 1.0 | High | Strong data, validated |
| 0.8 | Medium | Some data, reasonable assumptions |
| 0.5 | Low | Gut feeling, little data |

### Example Calculation

```markdown
Feature: Smart search with AI suggestions

Reach: 50,000 users/quarter (active searchers)
Impact: 2 (high - significantly better results)
Confidence: 0.8 (tested in prototype)
Effort: 3 person-months

RICE = (50,000 × 2 × 0.8) / 3 = 26,667
```

### RICE Template

```markdown
| Feature | Reach | Impact | Confidence | Effort | RICE Score |
|---------|-------|--------|------------|--------|------------|
| Feature A | 10,000 | 2 | 0.8 | 2 | 8,000 |
| Feature B | 50,000 | 1 | 1.0 | 4 | 12,500 |
| Feature C | 5,000 | 3 | 0.5 | 1 | 7,500 |
```

## ICE Framework

Simpler than RICE, ICE is ideal for fast prioritization.

### Formula

```
ICE Score = Impact × Confidence × Ease
```

### Factors (All 1-10 Scale)

| Factor | Question |
|--------|----------|
| **Impact** | How much will this move the metric? |
| **Confidence** | How sure are we this will work? |
| **Ease** | How easy is this to implement? |

### Example

```markdown
Feature: One-click checkout

Impact: 9 (directly increases conversion)
Confidence: 7 (similar features work elsewhere)
Ease: 4 (requires payment integration work)

ICE = 9 × 7 × 4 = 252
```

### ICE vs RICE

| Aspect | RICE | ICE |
|--------|------|-----|
| Complexity | More detailed | Simpler |
| Reach consideration | Explicit | Implicit in Impact |
| Effort | Person-months | 1-10 Ease scale |
| Best for | Data-driven teams | Fast decisions |

## WSJF (Weighted Shortest Job First)

SAFe framework optimizing for economic value delivery.

### Formula

```
WSJF = Cost of Delay / Job Size
```

### Cost of Delay Components

```
Cost of Delay = User Value + Time Criticality + Risk Reduction
```

| Component | Question | Scale |
|-----------|----------|-------|
| **User Value** | How much do users/business want this? | 1-21 (Fibonacci) |
| **Time Criticality** | Does value decay over time? | 1-21 |
| **Risk Reduction** | Does this reduce risk or enable opportunities? | 1-21 |
| **Job Size** | Relative effort compared to other items | 1-21 |

### Time Criticality Guidelines

| Score | Situation |
|-------|-----------|
| 21 | Must ship this quarter or lose the opportunity |
| 13 | Competitor pressure, 6-month window |
| 8 | Customer requested, flexible timeline |
| 3 | Nice to have, no deadline |
| 1 | Can wait indefinitely |

### Example

```markdown
Feature: GDPR compliance update

User Value: 8 (required for EU customers)
Time Criticality: 21 (regulatory deadline)
Risk Reduction: 13 (avoids fines)
Job Size: 8 (medium complexity)

Cost of Delay = 8 + 21 + 13 = 42
WSJF = 42 / 8 = 5.25
```

## MoSCoW Method

Qualitative prioritization for scope management.

### Categories

| Priority | Meaning | Guideline |
|----------|---------|-----------|
| **Must Have** | Non-negotiable for release | ~60% of effort |
| **Should Have** | Important but not critical | ~20% of effort |
| **Could Have** | Nice to have if time permits | ~20% of effort |
| **Won't Have** | Explicitly out of scope | Documented |

### Application Rules

1. **Must Have** items alone should deliver a viable product
2. **Should Have** items make product competitive
3. **Could Have** items delight users
4. **Won't Have** prevents scope creep

### Template

```markdown
## Release 1.0 MoSCoW

### Must Have (M)
- [ ] User authentication
- [ ] Core data model
- [ ] Basic CRUD operations

### Should Have (S)
- [ ] Search functionality
- [ ] Export to CSV
- [ ] Email notifications

### Could Have (C)
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] Custom themes

### Won't Have (W)
- Mobile app (Release 2.0)
- AI recommendations (Release 2.0)
- Multi-language support (Release 3.0)
```

## Kano Model

Categorize features by customer satisfaction impact.

### Categories

| Type | Absent | Present | Example |
|------|--------|---------|---------|
| **Must-Be** | Dissatisfied | Neutral | Login works |
| **Performance** | Dissatisfied | Satisfied | Fast load times |
| **Delighters** | Neutral | Delighted | AI suggestions |
| **Indifferent** | Neutral | Neutral | About page design |
| **Reverse** | Satisfied | Dissatisfied | Forced tutorials |

### Kano Survey Questions

For each feature, ask two questions:
1. "How would you feel if this feature was present?"
2. "How would you feel if this feature was absent?"

Answer options: Like it, Expect it, Neutral, Can tolerate, Dislike

## Framework Selection Guide

| Situation | Recommended Framework |
|-----------|----------------------|
| Data-driven team with metrics | RICE |
| Fast startup decisions | ICE |
| SAFe/Agile enterprise | WSJF |
| Fixed scope negotiation | MoSCoW |
| Customer satisfaction focus | Kano |
| Strategic alignment | Value vs. Effort Matrix |

## Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Gaming the scores | Calibrate as a team regularly |
| Ignoring qualitative factors | Use frameworks as input, not gospel |
| Analysis paralysis | Set time limits on scoring sessions |
| Inconsistent scales | Document and share scoring guidelines |

## Practical Tips

1. **Calibrate together**: Score several items as a team to align understanding
2. **Revisit regularly**: Priorities shift—rescore quarterly
3. **Document assumptions**: Why did you give that Impact score?
4. **Combine frameworks**: Use ICE for quick triage, RICE for final decisions

## Related Skills

- `product-strategy-frameworks` - Strategic context for prioritization
- `okr-kpi-patterns` - Connect priorities to measurable goals
- `requirements-engineering` - Detailed specs for prioritized items

## References

- [RICE Deep Dive](references/rice-deep-dive.md)
- [WSJF Calculator](references/wsjf-calculator.md)

**Version:** 1.0.0 (January )
