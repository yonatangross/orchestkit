# RICE Scoring Guide

Comprehensive guide for using RICE prioritization effectively.

## RICE Formula

```
RICE Score = (Reach × Impact × Confidence) / Effort
```

## Reach Scoring

Estimate how many users/customers will be affected per quarter.

| Score | % of Users | Description |
|-------|------------|-------------|
| 10 | 100% | All users |
| 8 | 80% | Most users |
| 5 | 50% | Half of users |
| 3 | 30% | Some users |
| 1 | 10% | Few users |

### Calculating Reach

```
Reach = (Users affected) / (Total users) × 10

Example:
- Total MAU: 10,000
- Users who use search: 8,000
- Reach for search improvement: 8,000/10,000 × 10 = 8
```

## Impact Scoring

How much will this move the needle on your goal?

| Score | Impact Level | Description |
|-------|--------------|-------------|
| 3.0 | Massive | 3x or more improvement |
| 2.0 | High | 2x improvement |
| 1.0 | Medium | Notable improvement |
| 0.5 | Low | Minor improvement |
| 0.25 | Minimal | Barely noticeable |

### Impact Assessment Questions

1. What metric does this affect?
2. By how much will it change?
3. What's the baseline?
4. What's the target?

## Confidence Scoring

How certain are you about Reach and Impact estimates?

| Score | Confidence | Evidence Level |
|-------|------------|----------------|
| 1.0 | High | Data-backed (analytics, A/B tests) |
| 0.8 | Medium | Some validation (user interviews, surveys) |
| 0.5 | Low | Gut feel (experienced intuition) |
| 0.3 | Moonshot | Speculative (new territory) |

### Confidence Calibration

- Used similar feature before? → +0.2
- Have user research? → +0.2
- Have analytics data? → +0.2
- New domain/technology? → -0.2
- Many unknowns? → -0.2

## Effort Scoring

Person-weeks of work to ship (design, development, testing).

| Score | Effort | Timeline |
|-------|--------|----------|
| 0.5 | Trivial | < 1 week |
| 1 | Small | 1 week |
| 2 | Medium | 2 weeks |
| 4 | Large | 1 month |
| 8 | XL | 2 months |
| 16 | XXL | Quarter |

### Effort Estimation Tips

- Include all disciplines (design, eng, QA)
- Add buffer for unknowns (1.2-1.5x)
- Consider dependencies
- Account for coordination overhead

## Example Scoring

```markdown
## Feature: Advanced Search Filters

### Reach: 8
- 80% of users use search at least once/week
- Source: Analytics dashboard

### Impact: 2.0
- Support tickets about search: 40/week
- Expected reduction: 50%
- Secondary: +10% search completion rate

### Confidence: 0.8
- Have user interview data (5 users)
- Similar feature at competitor successful
- No A/B test yet

### Effort: 2
- Design: 0.5 weeks
- Backend: 1 week
- Frontend: 0.5 weeks

### RICE Score
(8 × 2.0 × 0.8) / 2 = 6.4
```

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Overestimating reach | Use actual data, not hopes |
| Impact without baseline | Define current state first |
| 100% confidence | Nothing is certain |
| Underestimating effort | Include all work, add buffer |
| Comparing across goals | Only compare within same goal |

## When NOT to Use RICE

- Mandatory compliance/security work
- Technical debt paydown
- Infrastructure investments
- Strategic bets with long payoff
