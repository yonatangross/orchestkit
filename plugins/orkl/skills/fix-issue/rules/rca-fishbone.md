---
title: Fishbone Diagram (Ishikawa)
impact: MEDIUM
impactDescription: "Multi-factor problems need structured category analysis — without it, investigation fixates on one cause and misses contributing factors"
tags: rca, fishbone, ishikawa, debugging, multi-factor, categories
---

## Fishbone Diagram (Ishikawa)

Visualize multiple potential causes organized by category. Best for problems with several contributing factors.

### Software-Specific Categories

```
                    +-------------+
          Code -----+             |
                    |             |
 Infrastructure ----+             +---- BUG/INCIDENT
                    |             |
   Dependencies ----+             |
                    |             |
   Configuration ---+             |
                    |             |
        Process ----+             |
                    |             |
        People -----+             |
                    +-------------+
```

### Example: API Latency Spike

| Category | Potential Causes |
|----------|-----------------|
| **Code** | N+1 query, missing index, sync blocking call |
| **Infrastructure** | DB connection pool exhausted, network saturation, insufficient RAM |
| **Dependencies** | External API slow, Redis timeout, CDN cache miss |
| **Configuration** | Wrong pool size, missing timeout, debug logging on |
| **Process** | No load testing, no perf regression CI |
| **People** | Unfamiliarity with query optimizer, missing review |

### Fishbone Process

1. **Define the problem** clearly (the fish head)
2. **Identify major categories** (the bones) — use software categories above
3. **Brainstorm causes** for each category
4. **Analyze relationships** between causes across categories
5. **Prioritize** most likely root causes by evidence
6. **Verify** with data, metrics, or targeted testing
7. **Take action** on confirmed causes

### When to Use Fishbone

| Scenario | Use Fishbone? |
|----------|---------------|
| Multiple things went wrong | Yes |
| Problem has one clear cause | No — use 5 Whys |
| Team brainstorming session | Yes |
| Safety-critical failure analysis | No — use Fault Tree |
| Recurring issue with no clear pattern | Yes |

### Key Rules

- Use **software-specific categories** (Code, Infrastructure, Dependencies, Configuration, Process, People)
- Brainstorm causes per category **before** analyzing relationships
- Look for **cross-category interactions** (e.g., code + config)
- **Prioritize by evidence**, not by assumption
- Verify top candidates with **data or experiments** before committing to a fix
