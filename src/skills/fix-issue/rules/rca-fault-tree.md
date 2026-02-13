---
title: Fault Tree Analysis
impact: MEDIUM
impactDescription: "Critical system failures need exhaustive path analysis — missing a failure path leaves the system vulnerable to the same class of failure"
tags: rca, fault-tree, fta, critical-systems, safety, boolean-logic
---

## Fault Tree Analysis (FTA)

Top-down, deductive analysis mapping all paths to a failure using boolean logic (AND/OR gates). Best for critical systems and exhaustive failure analysis.

### FTA Symbols

| Symbol | Meaning |
|--------|---------|
| TOP | Top event — the failure being analyzed |
| AND | All inputs must occur for output |
| OR | Any input causes output |
| Basic Event | Root cause (leaf node) |
| Undeveloped | Needs further analysis |

### Example: Authentication Failure

```
                USER CANNOT
                AUTHENTICATE
                     |
                   [OR]
        +------------+------------+
        |            |            |
    Invalid      Auth Service   Account
   Credentials     Down         Locked
        |            |
      [OR]         [OR]
    +---+---+    +---+---+
    |   |   |    |   |   |
   Wrong Expired Token DB  Redis External
   Pass  Token  Invalid Down Down  Auth
```

### Building a Fault Tree

1. **Define top event** — the failure to analyze
2. **Ask "what causes this?"** — list immediate causes
3. **Classify as AND/OR** — do ALL causes need to happen, or ANY one?
4. **Decompose each cause** — repeat until reaching basic events
5. **Identify minimal cut sets** — smallest combinations that cause failure
6. **Prioritize by probability** — most likely paths first

### Minimal Cut Sets

The smallest set of basic events that together cause the top event:

```
Top: User Cannot Authenticate (OR gate)
  Cut Set 1: {Wrong Password}         — single point of failure
  Cut Set 2: {Expired Token}          — single point of failure
  Cut Set 3: {DB Down}                — single point of failure
  Cut Set 4: {Account Locked}         — single point of failure
```

Single-event cut sets indicate **no redundancy** — add defense-in-depth.

### When to Use FTA

| Scenario | Use FTA? |
|----------|----------|
| Safety-critical system failure | Yes |
| Need exhaustive failure path mapping | Yes |
| Complex multi-component failure | Yes |
| Simple linear bug | No — use 5 Whys |
| Multiple contributing factors | Maybe — Fishbone first |
| Regulatory compliance analysis | Yes |
| Post-incident for serious outages | Yes |

### Key Rules

- Start from the **top event** (failure) and work **downward**
- Every gate must be classified as **AND** (all required) or **OR** (any sufficient)
- Decompose until reaching **basic events** (actionable root causes)
- Identify **minimal cut sets** to find the most vulnerable paths
- Single-event cut sets indicate **missing redundancy**
- Use for **critical systems** where exhaustive analysis is justified
