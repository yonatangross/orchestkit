---
title: "Prioritize: WSJF & MoSCoW"
category: prioritize
impact: HIGH
---

# WSJF & MoSCoW Prioritization

## WSJF (Weighted Shortest Job First)

SAFe framework optimizing for economic value delivery.

### Formula

```
WSJF = Cost of Delay / Job Size
```

Higher WSJF = Higher priority (do first)

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

### WSJF vs RICE

| Use WSJF When | Use RICE When |
|---------------|---------------|
| Time matters | Value matters |
| Deadlines exist | Steady-state prioritization |
| Dependencies complex | Independent features |
| Opportunity cost high | User reach important |

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

## Practical Tips

1. **Calibrate together**: Score several items as a team to align understanding
2. **Revisit regularly**: Priorities shift -- rescore quarterly
3. **Document assumptions**: Why did you give that Impact score?
4. **Combine frameworks**: Use ICE for quick triage, RICE for final decisions
