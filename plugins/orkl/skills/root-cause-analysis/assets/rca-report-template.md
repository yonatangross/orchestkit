# RCA Report Template

```markdown
# Root Cause Analysis: [Issue Title]

**Incident ID:** [INC-XXXX]
**Date:** YYYY-MM-DD
**Author:** [Name]
**Status:** Draft | Review | Complete

---

## Executive Summary

[2-3 sentences: What happened, why, and what we're doing about it]

---

## Issue Summary

| Field | Value |
|-------|-------|
| Reported | YYYY-MM-DD HH:MM UTC |
| Detected | YYYY-MM-DD HH:MM UTC |
| Resolved | YYYY-MM-DD HH:MM UTC |
| Duration | X hours Y minutes |
| Severity | P0 / P1 / P2 / P3 |

### Impact

| Metric | Value |
|--------|-------|
| Users affected | [N] |
| Revenue impact | $[X] |
| SLA breach | Yes / No |
| Data loss | Yes / No |

---

## Problem Statement

[Clear, specific description of what went wrong]

---

## Timeline

| Time (UTC) | Event | Source |
|------------|-------|--------|
| HH:MM | [Event description] | [Logs/Alert/Manual] |
| HH:MM | [Event description] | [Source] |
| HH:MM | [Event description] | [Source] |

---

## Investigation

### Analysis Method

- [x] 5 Whys
- [ ] Fishbone Diagram
- [ ] Fault Tree Analysis
- [ ] Timeline Analysis

### Hypotheses Tested

| # | Hypothesis | Result | Evidence |
|---|------------|--------|----------|
| 1 | [Hypothesis] | Confirmed/Rejected | [Evidence] |
| 2 | [Hypothesis] | Confirmed/Rejected | [Evidence] |

### Detailed Analysis

[Describe the investigation process and findings]

---

## Root Cause(s)

### Primary Root Cause

**What:** [Specific root cause]

**Why it happened:** [Explanation]

**Evidence:** [Supporting data]

### Contributing Factors

1. [Factor 1]
2. [Factor 2]

---

## Immediate Resolution

[What was done to resolve the immediate issue]

- [Action 1]
- [Action 2]

---

## Preventive Actions

| # | Action | Owner | Due Date | Status |
|---|--------|-------|----------|--------|
| 1 | [Action] | @name | YYYY-MM-DD | Open |
| 2 | [Action] | @name | YYYY-MM-DD | Open |
| 3 | [Action] | @name | YYYY-MM-DD | Open |

### Short-term (This Sprint)
- [ ] [Action]

### Medium-term (This Quarter)
- [ ] [Action]

### Long-term (Future)
- [ ] [Action]

---

## Lessons Learned

### What Went Well
1. [Positive observation]
2. [Positive observation]

### What Could Improve
1. [Improvement area]
2. [Improvement area]

---

## Appendix

### A. Logs and Evidence

[Links to relevant logs, graphs, dashboards]

### B. Related Incidents

| Incident | Date | Similarity |
|----------|------|------------|
| [INC-XXX] | YYYY-MM-DD | [How related] |

### C. Relevant Code/Config

```
[Code snippet or config if relevant]
```

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Author | @name | |
| Reviewer | @name | |
| Engineering Lead | @name | |
```
