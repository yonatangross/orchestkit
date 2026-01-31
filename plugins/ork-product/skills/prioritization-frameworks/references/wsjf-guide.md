# WSJF (Weighted Shortest Job First) Guide

Framework for prioritizing when time-to-market matters.

## WSJF Formula

```
WSJF = Cost of Delay / Job Size
```

Higher WSJF = Higher priority (do first)

## Cost of Delay Components

```
Cost of Delay = User Value + Time Criticality + Risk Reduction
```

### User Value (1-10)
How much do users need this?

| Score | Description |
|-------|-------------|
| 10 | Critical - users leaving without it |
| 7-9 | High - major pain point |
| 4-6 | Medium - nice improvement |
| 1-3 | Low - minor enhancement |

### Time Criticality (1-10)
How urgent is the timing?

| Score | Description |
|-------|-------------|
| 10 | Hard deadline (regulatory, event) |
| 7-9 | Competitive window closing |
| 4-6 | Sooner better, but flexible |
| 1-3 | No time pressure |

### Risk Reduction (1-10)
Does delay increase risk?

| Score | Description |
|-------|-------------|
| 10 | Major risk if delayed (security, stability) |
| 7-9 | Significant risk accumulation |
| 4-6 | Moderate risk growth |
| 1-3 | Risk doesn't change with time |

## Job Size (1-10)

Relative size compared to other work.

| Score | Description |
|-------|-------------|
| 1-2 | XS - days |
| 3-4 | S - 1-2 weeks |
| 5-6 | M - 2-4 weeks |
| 7-8 | L - 1-2 months |
| 9-10 | XL - quarter+ |

## Example Calculation

```markdown
## Feature: Security Patch for CVE

### User Value: 6
- Affects enterprise customers
- Not user-facing but required for compliance

### Time Criticality: 9
- CVE published, 90-day disclosure window
- Competitors already patched

### Risk Reduction: 10
- Active exploitation in the wild
- Potential data breach

### Cost of Delay: 6 + 9 + 10 = 25

### Job Size: 3
- Known fix, straightforward implementation
- ~1 week of work

### WSJF: 25 / 3 = 8.33
```

## When to Use WSJF

- Multiple time-sensitive items competing
- Opportunity windows exist
- Dependencies create bottlenecks
- Need to justify "why now"

## WSJF vs RICE

| Use WSJF When | Use RICE When |
|---------------|---------------|
| Time matters | Value matters |
| Deadlines exist | Steady-state prioritization |
| Dependencies complex | Independent features |
| Opportunity cost high | User reach important |

## Visualization

```
              HIGH Time Criticality
                      │
           ┌──────────┼──────────┐
           │    DO    │   DO     │
           │   FIRST  │  SECOND  │
HIGH ──────┼──────────┼──────────┼────── LOW
User Value │    DO    │   DO     │  User Value
           │  THIRD   │  LAST    │
           └──────────┼──────────┘
                      │
              LOW Time Criticality
```
