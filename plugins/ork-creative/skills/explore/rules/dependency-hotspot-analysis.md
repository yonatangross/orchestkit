---
title: Identify highly-coupled code and dependency bottlenecks to reduce change risk
impact: MEDIUM
impactDescription: "Identifies highly-coupled code and dependency bottlenecks to reduce change risk"
tags: dependencies, hotspots, analysis
---

# Dependency Hotspot Analysis

Identify highly-coupled code and dependency bottlenecks. See [dependency-analysis.md](../references/dependency-analysis.md) for metrics and formulas.

```python
Task(
  subagent_type="backend-system-architect",
  prompt="""DEPENDENCY HOTSPOT ANALYSIS for: $ARGUMENTS

  Analyze coupling and dependencies:

  1. IMPORT ANALYSIS
     - Which files import this code?
     - What does this code import?
     - Circular dependencies?

  2. COUPLING SCORE (0-10, 10=highly coupled)
     - How many files would break if this changes?
     - Fan-in (incoming dependencies)
     - Fan-out (outgoing dependencies)

  3. CHANGE IMPACT
     - Blast radius of modifications
     - Files that always change together

  4. HOTSPOT VISUALIZATION
     ```
     [Module A] --depends--> [Target] <--depends-- [Module B]
                                |
                                v
                           [Module C]
     ```

  Output:
  {
    "coupling_score": N,
    "fan_in": N,
    "fan_out": N,
    "circular_deps": [],
    "change_impact": ["file - reason"],
    "hotspot_diagram": "ASCII diagram"
  }

  SUMMARY: End with: "COUPLING: [N]/10 - [N] incoming, [M] outgoing deps - [key concern]"
  """,
  run_in_background=True,
  max_turns=25
)
```

**Incorrect — Listing imports without analysis:**
```markdown
auth.ts imports:
- utils.ts
- config.ts
- db.ts
```

**Correct — Hotspot analysis with coupling score:**
```json
{
  "coupling_score": 8,
  "fan_in": 12,
  "fan_out": 5,
  "circular_deps": ["auth.ts → user.ts → auth.ts"],
  "change_impact": [
    "auth.ts change breaks 12 files",
    "utils.ts and auth.ts always change together"
  ],
  "hotspot_diagram": "
    [12 files] --depend on--> [auth.ts]
                                  |
                              depends on
                                  v
                      [utils, config, db, user, session]
  "
}
```
```
