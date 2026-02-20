---
title: Apply the 5 Whys technique to reach root causes instead of fixing symptoms
impact: HIGH
impactDescription: "Stopping at symptoms instead of root causes leads to recurring bugs — the same issue returns in different forms"
tags: rca, 5-whys, debugging, root-cause, investigation
---

## 5 Whys Technique

Iteratively ask "why" to drill down from symptom to root cause. Simple, fast, and effective for linear causal chains.

### Process

```
Problem Statement: [Clear description of the issue]
    |
    v
Why #1: [First level cause]
    |
    v
Why #2: [Deeper cause]
    |
    v
Why #3: [Even deeper]
    |
    v
Why #4: [Getting to root]
    |
    v
Why #5: [Root cause identified]
    |
    v
Action: [Fix that addresses root cause]
```

### Example: Production Outage

```markdown
**Problem:** Website was down for 2 hours

**Why 1:** The application server ran out of memory and crashed.
**Why 2:** A memory leak in the image processing service accumulated over time.
**Why 3:** The service wasn't releasing image buffers after processing.
**Why 4:** The cleanup code had a bug introduced in last week's release.
**Why 5:** We don't have automated memory leak detection in our test suite.

**Root Cause:** Missing automated memory leak testing
**Action:** Add memory profiling to CI pipeline, add cleanup tests
```

### Best Practices

| Do | Don't |
|----|-------|
| Base answers on evidence | Guess or assume |
| Stay focused on one causal chain | Branch too early |
| Keep asking until actionable | Stop at symptoms |
| Involve people closest to issue | Assign blame |
| Document your reasoning | Skip steps |

### When 5 Whys Falls Short

- **Multiple contributing factors** — use Fishbone diagram instead
- **Complex system interactions** — use Fault Tree Analysis
- **Organizational/process issues** — needs broader systemic analysis
- **Concurrent failures** — 5 Whys assumes linear causation

**Incorrect — stopping at symptom without root cause:**
```markdown
**Problem:** Website was down for 2 hours

**Why 1:** The application server crashed.
**Action:** Restart the server
```

**Correct — drilling down to root cause with 5 Whys:**
```markdown
**Problem:** Website was down for 2 hours

**Why 1:** The application server ran out of memory and crashed.
  Evidence: Out-of-memory error in logs

**Why 2:** A memory leak in the image processing service accumulated over time.
  Evidence: Memory usage increased 2GB/hour in metrics

**Why 3:** The service wasn't releasing image buffers after processing.
  Evidence: Code review shows missing .dispose() calls

**Why 4:** The cleanup code had a bug introduced in last week's release.
  Evidence: Git blame + diff shows removal of cleanup in PR #234

**Why 5:** We don't have automated memory leak detection in our test suite.
  Evidence: No memory profiling in CI pipeline

**Root Cause:** Missing automated memory leak testing
**Actions:**
- Add memory profiling to CI pipeline
- Add cleanup tests for image processing
- Revert PR #234's cleanup removal
```

### Key Rules

- Always start with a **clear, specific problem statement**
- Each "why" must be **supported by evidence** (logs, metrics, code)
- Stop when you reach an **actionable root cause** (not always exactly 5)
- The fix should address the **root cause**, not the symptom
- Document the full chain for **knowledge sharing**
