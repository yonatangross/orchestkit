---
title: "Prioritize: RICE & ICE Scoring"
category: prioritize
impact: HIGH
impactDescription: "Ensures data-driven feature prioritization using Reach, Impact, Confidence, and Effort scores"
tags: rice, ice, prioritization, scoring, feature-ranking
---

# RICE & ICE Prioritization

## RICE Framework

Developed by Intercom for data-driven feature comparison.

### Formula

```
RICE Score = (Reach x Impact x Confidence) / Effort
```

### Factors

| Factor | Definition | Scale |
|--------|------------|-------|
| **Reach** | Users/customers affected per quarter | Actual number or 1-10 normalized |
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
| 0.3 | Moonshot | Speculative, new territory |

### Example Calculation

```markdown
Feature: Smart search with AI suggestions

Reach: 50,000 users/quarter (active searchers)
Impact: 2 (high - significantly better results)
Confidence: 0.8 (tested in prototype)
Effort: 3 person-months

RICE = (50,000 x 2 x 0.8) / 3 = 26,667
```

### RICE Scoring Template

| Feature | Reach | Impact | Confidence | Effort | RICE Score |
|---------|-------|--------|------------|--------|------------|
| Feature A | 10,000 | 2 | 0.8 | 2 | 8,000 |
| Feature B | 50,000 | 1 | 1.0 | 4 | 12,500 |
| Feature C | 5,000 | 3 | 0.5 | 1 | 7,500 |

## ICE Framework

Simpler than RICE, ideal for fast prioritization.

```
ICE Score = Impact x Confidence x Ease
```

All factors on 1-10 scale.

### ICE vs RICE

| Aspect | RICE | ICE |
|--------|------|-----|
| Complexity | More detailed | Simpler |
| Reach consideration | Explicit | Implicit in Impact |
| Effort | Person-months | 1-10 Ease scale |
| Best for | Data-driven teams | Fast decisions |

## Kano Model

Categorize features by customer satisfaction impact.

| Type | Absent | Present | Example |
|------|--------|---------|---------|
| **Must-Be** | Dissatisfied | Neutral | Login works |
| **Performance** | Dissatisfied | Satisfied | Fast load times |
| **Delighters** | Neutral | Delighted | AI suggestions |
| **Indifferent** | Neutral | Neutral | About page design |
| **Reverse** | Satisfied | Dissatisfied | Forced tutorials |

## Framework Selection Guide

| Situation | Recommended Framework |
|-----------|----------------------|
| Data-driven team with metrics | RICE |
| Fast startup decisions | ICE |
| SAFe/Agile enterprise | WSJF |
| Fixed scope negotiation | MoSCoW |
| Customer satisfaction focus | Kano |

## Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Gaming the scores | Calibrate as a team regularly |
| Ignoring qualitative factors | Use frameworks as input, not gospel |
| Analysis paralysis | Set time limits on scoring sessions |
| Inconsistent scales | Document and share scoring guidelines |

**Incorrect — RICE without documented assumptions:**
```markdown
Feature A: RICE = 8,000
Feature B: RICE = 12,500
Priority: B, then A
```

**Correct — RICE with transparent scoring:**
```markdown
Feature B: Smart search with AI
- Reach: 50,000 users/quarter (active searchers)
- Impact: 2 (high - significantly better results)
- Confidence: 0.8 (tested in prototype)
- Effort: 3 person-months
RICE = (50,000 × 2 × 0.8) / 3 = 26,667
```
