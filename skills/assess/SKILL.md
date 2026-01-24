---
name: assess
description: Rate quality 0-10 with dimension breakdown, list pros/cons, compare alternatives with scores, suggest improvements with effort estimates. Use when evaluating code, designs, approaches, or asking "is this good?"
context: fork
version: 1.0.0
author: OrchestKit
tags: [assessment, evaluation, quality, comparison, pros-cons, rating]
user-invocable: true
allowedTools: [Read, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes, Bash]
skills: [code-review-playbook, assess-complexity, quality-gates, architecture-decision-record, recall]
argument-hint: [code-path-or-topic]
---

# Assess

Comprehensive assessment skill for answering "is this good?" with structured evaluation, scoring, and actionable recommendations.

## Quick Start

```bash
/assess backend/app/services/auth.py
/assess our caching strategy
/assess the current database schema
/assess frontend/src/components/Dashboard
```

---

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main assessment task IMMEDIATELY
TaskCreate(
  subject="Assess: {target}",
  description="Comprehensive evaluation with quality scores and recommendations",
  activeForm="Assessing {target}"
)

# 2. Create subtasks for each phase (7-phase process)
TaskCreate(subject="Understand assessment target", activeForm="Understanding target")
TaskCreate(subject="Rate quality (0-10)", activeForm="Rating quality")
TaskCreate(subject="List pros and cons", activeForm="Listing pros/cons")
TaskCreate(subject="Compare alternatives", activeForm="Comparing alternatives")
TaskCreate(subject="Generate improvement suggestions", activeForm="Generating suggestions")
TaskCreate(subject="Calculate effort estimates", activeForm="Estimating effort")
TaskCreate(subject="Compile assessment report", activeForm="Compiling report")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

---

## What This Skill Answers

| Question | How It's Answered |
|----------|-------------------|
| "Is this good?" | Quality score 0-10 with reasoning |
| "What are the trade-offs?" | Structured pros/cons list |
| "Should we change this?" | Improvement suggestions with effort |
| "What are the alternatives?" | Comparison with scores |
| "Where should we focus?" | Prioritized recommendations |

---

## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Target Understanding** | Read code/design, identify scope | Context summary |
| **2. Quality Rating** | 6-dimension scoring | 0-10 scores with reasoning |
| **3. Pros/Cons Analysis** | Strengths and weaknesses | Balanced evaluation |
| **4. Alternative Comparison** | Score alternatives | Comparison matrix |
| **5. Improvement Suggestions** | Actionable recommendations | Prioritized list |
| **6. Effort Estimation** | Time and complexity estimates | Effort breakdown |
| **7. Assessment Report** | Compile findings | Final report |

---

## Phase 1: Target Understanding

### Identify What's Being Assessed

```python
# Determine assessment type
assessment_types = {
    "code": "File path or directory",
    "design": "Architecture or system design",
    "approach": "Strategy or methodology",
    "decision": "Architectural decision",
    "pattern": "Code pattern or practice"
}

# PARALLEL - Gather context
Read(file_path="$ARGUMENTS")  # If it's a file
Grep(pattern="$ARGUMENTS", output_mode="files_with_matches")  # Find related files
mcp__memory__search_nodes(query="$ARGUMENTS")  # Check past decisions
```

### Context Summary Template

```markdown
## Assessment Target

**Subject:** [what's being assessed]
**Type:** [code/design/approach/decision/pattern]
**Scope:** [files/components involved]

**Context:**
- [Relevant background]
- [Current usage/purpose]
- [Known constraints]
```

---

## Phase 2: Quality Rating (0-10, 6 Dimensions)

**Goal:** Provide nuanced quality scores with clear reasoning for each dimension.

### Quality Dimensions

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| **Correctness** | 0.20 | Does it work? Does it do what it should? |
| **Maintainability** | 0.20 | How easy to understand and modify? |
| **Performance** | 0.15 | Is it efficient? Any bottlenecks? |
| **Security** | 0.15 | Are there vulnerabilities? Follows best practices? |
| **Scalability** | 0.15 | Will it handle growth? |
| **Testability** | 0.15 | Is it easy to test? Good coverage? |

### Scoring Rubric

| Score | Label | Meaning |
|-------|-------|---------|
| 9-10 | Excellent | Best practices, production-ready, exemplary |
| 7-8 | Good | Solid implementation, minor improvements possible |
| 5-6 | Adequate | Works but has notable issues |
| 3-4 | Poor | Significant problems, needs attention |
| 1-2 | Critical | Major issues, should not ship |
| 0 | Broken | Non-functional or dangerous |

### Parallel Quality Assessment (6 Agents)

```python
# PARALLEL - Launch all dimension assessors
Task(
  subagent_type="code-quality-reviewer",
  prompt="""CORRECTNESS ASSESSMENT for: $ARGUMENTS

  Evaluate correctness (0-10):

  1. FUNCTIONAL CORRECTNESS
     - Does the code do what it claims?
     - Are edge cases handled?
     - Are errors handled properly?

  2. LOGICAL CORRECTNESS
     - Is the logic sound?
     - Any race conditions or deadlocks?
     - Proper null/undefined handling?

  3. API CONTRACT
     - Does it match its interface?
     - Are types accurate?
     - Documentation matches behavior?

  Score: [0-10]
  Reasoning:
  - [Specific reason 1 with evidence]
  - [Specific reason 2 with evidence]

  SUMMARY: End with: "CORRECTNESS: [N]/10 - [key finding]"
  """,
  run_in_background=True
)

Task(
  subagent_type="code-quality-reviewer",
  prompt="""MAINTAINABILITY ASSESSMENT for: $ARGUMENTS

  Evaluate maintainability (0-10):

  1. READABILITY
     - Clear naming?
     - Appropriate comments?
     - Logical organization?

  2. SIMPLICITY
     - Single responsibility?
     - Minimal nesting?
     - Reasonable function length?

  3. MODULARITY
     - Low coupling?
     - High cohesion?
     - Easy to modify in isolation?

  Score: [0-10]
  Reasoning:
  - [Specific reason with evidence]

  SUMMARY: End with: "MAINTAINABILITY: [N]/10 - [key finding]"
  """,
  run_in_background=True
)

Task(
  subagent_type="backend-system-architect",
  prompt="""PERFORMANCE ASSESSMENT for: $ARGUMENTS

  Evaluate performance (0-10):

  1. TIME COMPLEXITY
     - Algorithm efficiency?
     - Any O(n^2) in hot paths?
     - Unnecessary iterations?

  2. SPACE COMPLEXITY
     - Memory usage appropriate?
     - Leaks possible?
     - Caching strategy?

  3. I/O EFFICIENCY
     - Database query optimization?
     - Network call batching?
     - Async where beneficial?

  Score: [0-10]
  Reasoning:
  - [Specific finding with evidence]

  SUMMARY: End with: "PERFORMANCE: [N]/10 - [key finding]"
  """,
  run_in_background=True
)

Task(
  subagent_type="security-auditor",
  prompt="""SECURITY ASSESSMENT for: $ARGUMENTS

  Evaluate security (0-10):

  1. INPUT VALIDATION
     - All inputs validated?
     - Injection prevention?
     - Sanitization?

  2. AUTHENTICATION/AUTHORIZATION
     - Proper auth checks?
     - Least privilege?
     - Secure defaults?

  3. DATA PROTECTION
     - Sensitive data handled correctly?
     - Encryption where needed?
     - No secrets in code?

  Score: [0-10]
  Reasoning:
  - [Specific finding with evidence]

  SUMMARY: End with: "SECURITY: [N]/10 - [key finding]"
  """,
  run_in_background=True
)

Task(
  subagent_type="backend-system-architect",
  prompt="""SCALABILITY ASSESSMENT for: $ARGUMENTS

  Evaluate scalability (0-10):

  1. HORIZONTAL SCALING
     - Can run multiple instances?
     - Stateless design?
     - Load balancer ready?

  2. DATA SCALING
     - Handles data growth?
     - Pagination implemented?
     - Archiving strategy?

  3. BOTTLENECKS
     - Single points of failure?
     - Resource contention?
     - Queue-based decoupling?

  Score: [0-10]
  Reasoning:
  - [Specific finding with evidence]

  SUMMARY: End with: "SCALABILITY: [N]/10 - [key finding]"
  """,
  run_in_background=True
)

Task(
  subagent_type="test-generator",
  prompt="""TESTABILITY ASSESSMENT for: $ARGUMENTS

  Evaluate testability (0-10):

  1. TEST COVERAGE
     - Current coverage level?
     - Critical paths tested?
     - Edge cases covered?

  2. TEST QUALITY
     - Meaningful assertions?
     - Not testing implementation details?
     - Fast and deterministic?

  3. DESIGN FOR TESTING
     - Dependency injection?
     - Pure functions where possible?
     - Mockable interfaces?

  Score: [0-10]
  Reasoning:
  - [Specific finding with evidence]

  SUMMARY: End with: "TESTABILITY: [N]/10 - [key finding]"
  """,
  run_in_background=True
)
```

### Composite Score Calculation

```python
composite_score = (
    correctness * 0.20 +
    maintainability * 0.20 +
    performance * 0.15 +
    security * 0.15 +
    scalability * 0.15 +
    testability * 0.15
)
```

---

## Phase 3: Pros/Cons Analysis

**Goal:** Provide balanced evaluation of strengths and weaknesses.

### Pros/Cons Template

```markdown
## Pros (Strengths)

| # | Strength | Impact | Evidence |
|---|----------|--------|----------|
| 1 | [strength] | High/Med/Low | [specific example] |
| 2 | [strength] | High/Med/Low | [specific example] |
| 3 | [strength] | High/Med/Low | [specific example] |

## Cons (Weaknesses)

| # | Weakness | Severity | Evidence |
|---|----------|----------|----------|
| 1 | [weakness] | High/Med/Low | [specific example] |
| 2 | [weakness] | High/Med/Low | [specific example] |
| 3 | [weakness] | High/Med/Low | [specific example] |

## Net Assessment

**Strengths outweigh weaknesses:** [Yes/No/Balanced]
**Recommended action:** [Keep as-is / Improve / Reconsider / Rewrite]
```

---

## Phase 4: Alternative Comparison

**Goal:** Compare current approach against alternatives with scores.

### Comparison Matrix Template

| Criteria | Current | Alternative A | Alternative B |
|----------|---------|---------------|---------------|
| Correctness | [N]/10 | [N]/10 | [N]/10 |
| Maintainability | [N]/10 | [N]/10 | [N]/10 |
| Performance | [N]/10 | [N]/10 | [N]/10 |
| Security | [N]/10 | [N]/10 | [N]/10 |
| Scalability | [N]/10 | [N]/10 | [N]/10 |
| Testability | [N]/10 | [N]/10 | [N]/10 |
| **Composite** | **[N.N]** | **[N.N]** | **[N.N]** |
| Migration Effort | N/A | [1-5] | [1-5] |

### Alternative Analysis Agent

```python
Task(
  subagent_type="workflow-architect",
  prompt="""ALTERNATIVE ANALYSIS for: $ARGUMENTS

  Identify and evaluate alternatives:

  1. ALTERNATIVE A: [Name]
     - Description: [what it is]
     - Pros: [advantages over current]
     - Cons: [disadvantages]
     - Score: [0-10]
     - Migration effort: [1-5]

  2. ALTERNATIVE B: [Name]
     - Description: [what it is]
     - Pros: [advantages over current]
     - Cons: [disadvantages]
     - Score: [0-10]
     - Migration effort: [1-5]

  RECOMMENDATION:
  - Best option: [current/A/B]
  - Rationale: [why]
  - Switch recommended: [yes/no]
  - If switching, expected improvement: [+N points]

  SUMMARY: End with: "ALTERNATIVES: Current [N]/10 vs Best [M]/10 - [recommendation]"
  """,
  run_in_background=True
)
```

---

## Phase 5: Improvement Suggestions

**Goal:** Provide actionable recommendations prioritized by impact/effort.

### Suggestion Format

| # | Suggestion | Effort | Impact | Priority | Category |
|---|------------|--------|--------|----------|----------|
| 1 | [specific action] | [1-5] | [1-5] | [I/E] | [category] |
| 2 | [specific action] | [1-5] | [1-5] | [I/E] | [category] |

### Effort Scale

| Points | Level | Time Estimate |
|--------|-------|---------------|
| 1 | Trivial | < 15 minutes |
| 2 | Easy | 15-60 minutes |
| 3 | Medium | 1-4 hours |
| 4 | Hard | 4-8 hours |
| 5 | Very Hard | 1+ days |

### Impact Scale

| Points | Level | Score Improvement |
|--------|-------|-------------------|
| 1 | Minimal | +0.1-0.2 |
| 2 | Low | +0.3-0.5 |
| 3 | Medium | +0.6-1.0 |
| 4 | High | +1.1-2.0 |
| 5 | Critical | +2.0+ |

### Priority Calculation

```python
priority = impact / effort  # Higher = do first
# Tie-breaker: prefer lower effort at same priority
```

### Quick Wins

**Quick Wins** = Effort <= 2 AND Impact >= 4

Always highlight quick wins at the top of recommendations.

---

## Phase 6: Effort Estimation

**Goal:** Provide realistic time estimates for improvements.

### Effort Breakdown

```markdown
## Effort Estimation

### Quick Wins (< 1 hour total)
| Task | Estimate |
|------|----------|
| [task 1] | 15 min |
| [task 2] | 30 min |

### Short-term (< 1 day total)
| Task | Estimate |
|------|----------|
| [task 1] | 2 hours |
| [task 2] | 4 hours |

### Medium-term (1-3 days)
| Task | Estimate |
|------|----------|
| [task 1] | 1 day |

### Long-term (> 3 days)
| Task | Estimate |
|------|----------|
| [task 1] | 1 week |

### Total Effort
- **Minimum (quick wins only):** X hours
- **Recommended (quick wins + short-term):** X days
- **Comprehensive (all improvements):** X days/weeks
```

---

## Phase 7: Assessment Report

### Final Report Template

```markdown
# Assessment Report: $ARGUMENTS

**Date:** [TODAY'S DATE]
**Assessor:** Claude Code with 6 parallel agents
**Assessment Duration:** [X minutes]

---

## Executive Summary

**Overall Score: [N.N]/10** (Grade: [A+/A/B/C/D/F])

[2-3 sentence summary answering "is this good?"]

**Verdict:** [EXCELLENT | GOOD | ADEQUATE | NEEDS WORK | CRITICAL]

---

## Quality Scores

| Dimension | Score | Status |
|-----------|-------|--------|
| Correctness | [N]/10 | [emoji bar] |
| Maintainability | [N]/10 | [emoji bar] |
| Performance | [N]/10 | [emoji bar] |
| Security | [N]/10 | [emoji bar] |
| Scalability | [N]/10 | [emoji bar] |
| Testability | [N]/10 | [emoji bar] |

**Strongest:** [dimension]
**Weakest:** [dimension]

---

## Pros and Cons

### Strengths
1. [strength with evidence]
2. [strength with evidence]
3. [strength with evidence]

### Weaknesses
1. [weakness with evidence]
2. [weakness with evidence]
3. [weakness with evidence]

---

## Alternatives Considered

| Option | Score | Verdict |
|--------|-------|---------|
| Current | [N.N] | [status] |
| [Alt A] | [N.N] | [status] |
| [Alt B] | [N.N] | [status] |

**Recommendation:** [Keep current / Consider switching to X]

---

## Improvement Roadmap

### Quick Wins (Do Now)
1. [suggestion] - [effort] effort, [impact] impact

### Short-term (This Sprint)
1. [suggestion] - [effort] effort, [impact] impact

### Medium-term (Next Sprint)
1. [suggestion] - [effort] effort, [impact] impact

### Total Effort: [X hours/days]
### Expected Score After Improvements: [N.N]/10 (+[X.X])

---

## Answer: Is This Good?

**[YES / MOSTLY / SOMEWHAT / NO]**

[Detailed reasoning explaining the verdict, what makes it good/bad, and what would change the answer]
```

---

## Grade Interpretation

| Score | Grade | Verdict | Meaning |
|-------|-------|---------|---------|
| 9.0-10.0 | A+ | EXCELLENT | Best practices, production-ready |
| 8.0-8.9 | A | GOOD | Solid, minor improvements possible |
| 7.0-7.9 | B | GOOD | Good with some issues |
| 6.0-6.9 | C | ADEQUATE | Works but needs attention |
| 5.0-5.9 | D | NEEDS WORK | Significant improvements needed |
| 0.0-4.9 | F | CRITICAL | Major problems, do not ship |

---

**Version:** 1.0.0 (January 2026)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 6 dimensions | Comprehensive yet manageable | Covers all quality aspects without overwhelming |
| 0-10 scale | Industry standard, intuitive | Easy to understand and compare |
| Parallel assessment | 6 agents simultaneously | Fast, thorough evaluation |
| Effort/Impact scoring | 1-5 for both | Simple prioritization math |
| Alternative comparison | Always included | Context for "is this good?" |

## Related Skills

- `assess-complexity` - Task complexity assessment (complements this skill)
- `verify` - Post-implementation verification (uses similar patterns)
- `code-review-playbook` - Code review patterns (integrated here)
- `quality-gates` - Quality gate patterns

## Capability Details

### quality-rating
**Keywords:** quality, rating, score, grade, evaluate, assess
**Solves:**
- Is this code good?
- What's the quality of this design?
- Rate this approach

### pros-cons-analysis
**Keywords:** pros, cons, advantages, disadvantages, strengths, weaknesses
**Solves:**
- What are the trade-offs?
- What's good and bad about this?
- Should we keep this?

### alternative-comparison
**Keywords:** alternative, compare, better way, different approach
**Solves:**
- Is there a better way?
- Compare approaches
- Which option is best?

### improvement-suggestions
**Keywords:** improve, fix, enhance, better, recommendations
**Solves:**
- How can we improve this?
- What should we fix?
- Where should we focus?

### effort-estimation
**Keywords:** effort, time, estimate, how long, how much work
**Solves:**
- How long would improvements take?
- What's the effort involved?
- Quick wins vs long-term
