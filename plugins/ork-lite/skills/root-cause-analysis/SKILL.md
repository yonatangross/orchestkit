---
name: root-cause-analysis
description: 5 Whys, Fishbone diagrams, Fault Tree Analysis, and systematic debugging approaches. Use when investigating bugs, analyzing incidents, or identifying root causes of problems.
context: fork
agent: debug-investigator
version: 1.0.0
tags: [debugging, rca, 5-whys, fishbone, fault-tree, incident, 2026]
author: OrchestKit
user-invocable: false
---

# Root Cause Analysis

Systematic approaches for identifying the true source of problems, not just symptoms.

## RCA Methods Overview

| Method | Best For | Complexity | Time |
|--------|----------|------------|------|
| 5 Whys | Simple, linear problems | Low | 15-30 min |
| Fishbone | Multi-factor problems | Medium | 30-60 min |
| Fault Tree | Critical systems, safety | High | 1-4 hours |
| Timeline Analysis | Incident investigation | Medium | 30-90 min |

## 5 Whys Method

Iteratively ask "why" to drill down from symptom to root cause.

### Process

```
Problem Statement: [Clear description of the issue]
    │
    ▼
Why #1: [First level cause]
    │
    ▼
Why #2: [Deeper cause]
    │
    ▼
Why #3: [Even deeper]
    │
    ▼
Why #4: [Getting to root]
    │
    ▼
Why #5: [Root cause identified]
    │
    ▼
Action: [Fix that addresses root cause]
```

### Example: Production Outage

```markdown
**Problem:** Website was down for 2 hours

**Why 1:** Why was the website down?
→ The application server ran out of memory and crashed.

**Why 2:** Why did the server run out of memory?
→ A memory leak in the image processing service accumulated over time.

**Why 3:** Why was there a memory leak?
→ The service wasn't releasing image buffers after processing.

**Why 4:** Why weren't buffers being released?
→ The cleanup code had a bug introduced in last week's release.

**Why 5:** Why wasn't the bug caught before release?
→ We don't have automated memory leak detection in our test suite.

**Root Cause:** Missing automated memory leak testing
**Action:** Add memory profiling to CI pipeline, add cleanup tests
```

### 5 Whys Best Practices

| Do | Don't |
|----|-------|
| Base answers on evidence | Guess or assume |
| Stay focused on one causal chain | Branch too early |
| Keep asking until actionable | Stop at symptoms |
| Involve people closest to issue | Assign blame |
| Document your reasoning | Skip steps |

### When 5 Whys Falls Short

- Multiple contributing factors (use Fishbone)
- Complex system interactions (use Fault Tree)
- Organizational/process issues (need broader analysis)

## Fishbone Diagram (Ishikawa)

Visualize multiple potential causes organized by category.

### Standard Categories (6 M's)

```
                    ┌─────────────┐
        Methods ────┤             │
                    │             │
      Machines ─────┤             │
                    │             ├──── PROBLEM
     Materials ─────┤             │
                    │             │
    Measurement ────┤             │
                    │             │
    Environment ────┤             │
                    │             │
       People ──────┤             │
                    └─────────────┘
```

### Software-Specific Categories

```
                    ┌─────────────┐
          Code ─────┤             │
                    │             │
 Infrastructure ────┤             │
                    │             ├──── BUG/INCIDENT
   Dependencies ────┤             │
                    │             │
   Configuration ───┤             │
                    │             │
        Process ────┤             │
                    │             │
        People ─────┤             │
                    └─────────────┘
```

### Fishbone Example: API Latency Spike

```
                              ┌─────────────────┐
                              │                 │
        Code ─────────────────┤                 │
         │                    │                 │
         ├─ N+1 query issue   │                 │
         ├─ Missing index     │   API LATENCY   │
         └─ Sync blocking call│      SPIKE      │
                              │                 │
  Infrastructure ─────────────┤                 │
         │                    │                 │
         ├─ DB connection pool│                 │
         ├─ Network saturation│                 │
         └─ Insufficient RAM  │                 │
                              │                 │
  Dependencies ───────────────┤                 │
         │                    │                 │
         ├─ External API slow │                 │
         ├─ Redis timeout     │                 │
         └─ CDN cache miss    │                 │
                              └─────────────────┘
```

### Fishbone Process

1. **Define the problem** clearly (the fish head)
2. **Identify major categories** (the bones)
3. **Brainstorm causes** for each category
4. **Analyze relationships** between causes
5. **Prioritize** most likely root causes
6. **Verify** with data/testing
7. **Take action** on confirmed causes

## Fault Tree Analysis (FTA)

Top-down, deductive analysis for critical systems.

### FTA Symbols

```
┌─────┐
│ TOP │  Top Event (the failure being analyzed)
└──┬──┘
   │
┌──┴──┐
│ AND │  All inputs must occur for output
└─────┘

┌──┴──┐
│ OR  │  Any input causes output
└─────┘

┌─────┐
│  ○  │  Basic Event (root cause)
└─────┘

┌─────┐
│  ◇  │  Undeveloped Event (needs more analysis)
└─────┘
```

### FTA Example: Authentication Failure

```
                    ┌────────────────────┐
                    │   USER CANNOT      │
                    │   AUTHENTICATE     │
                    └─────────┬──────────┘
                              │
                          ┌───┴───┐
                          │  OR   │
                          └───┬───┘
           ┌──────────────────┼──────────────────┐
           │                  │                  │
    ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐
    │  Invalid    │    │   Auth      │    │  Account    │
    │  Credentials│    │   Service   │    │  Locked     │
    │             │    │   Down      │    │             │
    └──────┬──────┘    └──────┬──────┘    └─────────────┘
           │                  │
       ┌───┴───┐          ┌───┴───┐
       │  OR   │          │  OR   │
       └───┬───┘          └───┬───┘
    ┌──────┼──────┐    ┌──────┼──────┐
    │      │      │    │      │      │
   ○       ○      ○    ○      ○      ◇
 Wrong   Expired Token DB   Redis  External
Password  Token  Invalid Down  Down   Auth
```

### When to Use FTA

- Safety-critical systems
- Complex failure modes
- Need to identify all paths to failure
- Regulatory compliance requirements
- Post-incident analysis for serious outages

## Timeline Analysis

Reconstruct sequence of events to identify causation.

### Timeline Template

```markdown
## Incident Timeline: [Incident Name]

### Summary
- **Incident Start:** [Timestamp]
- **Incident Detected:** [Timestamp]
- **Incident Resolved:** [Timestamp]
- **Total Duration:** [X hours Y minutes]
- **Time to Detect:** [X minutes]
- **Time to Resolve:** [X hours Y minutes]

### Detailed Timeline

| Time (UTC) | Event | Source | Actor |
|------------|-------|--------|-------|
| 14:00 | Deployment started | CI/CD | automated |
| 14:05 | Deployment completed | CI/CD | automated |
| 14:15 | Error rate increased 10x | Monitoring | - |
| 14:22 | Alert fired | PagerDuty | - |
| 14:25 | On-call acknowledged | PagerDuty | @alice |
| 14:30 | Root cause identified | Investigation | @alice |
| 14:35 | Rollback initiated | Manual | @alice |
| 14:40 | Services recovered | Monitoring | - |
| 14:45 | Incident resolved | Manual | @alice |

### Analysis

**Contributing Factors:**
1. [Factor 1]
2. [Factor 2]

**What Went Well:**
1. [Positive observation]

**What Could Improve:**
1. [Improvement area]

### Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| | | | |
```

## Debugging Decision Tree

```
                    Problem Reported
                          │
                          ▼
               Can you reproduce it?
                    │           │
                   Yes          No
                    │           │
                    ▼           ▼
            Isolate the      Gather more
            conditions       information
                    │           │
                    ▼           ▼
            Recent changes?  Check logs,
                    │        monitoring
                   Yes          │
                    │           │
                    ▼           ▼
            Review diffs    Correlation
            & deploys       analysis
                    │           │
                    └─────┬─────┘
                          │
                          ▼
                   Form hypothesis
                          │
                          ▼
                    Test hypothesis
                          │
                    ┌─────┴─────┐
                    │           │
               Confirmed     Rejected
                    │           │
                    ▼           ▼
               Fix and      Next hypothesis
               verify
```

## RCA Documentation Template

```markdown
## Root Cause Analysis: [Issue Title]

### Issue Summary
**Reported:** [Date]
**Severity:** P0 / P1 / P2 / P3
**Impact:** [Description of impact]

### Problem Statement
[Clear, specific description of what went wrong]

### Investigation

#### Timeline
[Key events in sequence]

#### Analysis Method Used
[ ] 5 Whys
[ ] Fishbone
[ ] Fault Tree
[ ] Timeline Analysis

#### Findings
[Detailed analysis results]

### Root Cause(s)
1. **Primary:** [Main root cause]
2. **Contributing:** [Secondary factors]

### Immediate Fix
[What was done to resolve the immediate issue]

### Preventive Actions
| Action | Owner | Due | Status |
|--------|-------|-----|--------|
| | | | |

### Lessons Learned
1. [Key takeaway]
2. [Process improvement]

### Appendix
- [Links to logs, graphs, related tickets]
```

## 2026 Best Practices

- **Blameless postmortems**: Focus on systems, not individuals
- **Automated correlation**: Use AI to correlate signals across systems
- **Proactive RCA**: Analyze near-misses, not just incidents
- **Knowledge sharing**: Document and share RCA findings
- **Metrics-driven**: Track time-to-detect, time-to-resolve trends

## Related Skills

- `observability-monitoring` - Gathering data for RCA
- `errors` - Error pattern analysis
- `resilience-patterns` - Preventing future incidents

## References

- [5 Whys Workshop Guide](references/5-whys-workshop.md)
- [Fishbone Template](references/fishbone-template.md)

**Version:** 1.0.0 (January 2026)
