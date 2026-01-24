---
name: assess-complexity
description: Assess task complexity with automated codebase metrics. Use before starting work to determine if task needs breakdown.
context: fork
user-invocable: true
allowedTools: [Read, Grep, Glob, Bash, Task, mcp__memory__search_nodes]
skills: [quality-gates, brainstorming, recall]
argument-hint: [file-or-directory]
tags:
  - quality-gates
  - planning
  - complexity
  - assessment
---

# Assess Complexity

Evaluate task complexity using automated codebase analysis before starting implementation work.

## Overview

- Determining if a task is ready for implementation
- Deciding whether to break down a large task
- Estimating effort before committing to work
- Identifying high-risk areas in the codebase
- Planning sprint work with complexity scores

## Usage

Assess complexity for: **$ARGUMENTS**

## Step 1: Gather Metrics

Run the analysis script to collect codebase metrics:

!`./scripts/analyze-codebase.sh $ARGUMENTS`

## Step 2: Assess Each Criterion

Score each criterion from 1-5 based on the metrics and your understanding:

### 1. Lines of Code

| Range | Score |
|-------|-------|
| < 50 lines | 1 |
| 50-200 lines | 2 |
| 200-500 lines | 3 |
| 500-1500 lines | 4 |
| 1500+ lines | 5 |

### 2. Time Estimate

| Duration | Score |
|----------|-------|
| < 30 minutes | 1 |
| 30 min - 2 hours | 2 |
| 2-8 hours | 3 |
| 8-24 hours (1-3 days) | 4 |
| 24+ hours (3+ days) | 5 |

### 3. Number of Files

| Count | Score |
|-------|-------|
| 1 file | 1 |
| 2-3 files | 2 |
| 4-10 files | 3 |
| 11-25 files | 4 |
| 26+ files | 5 |

### 4. Dependencies Count

| Unique Modules | Score |
|----------------|-------|
| 0 dependencies | 1 |
| 1 dependency | 2 |
| 2-3 dependencies | 3 |
| 4-6 dependencies | 4 |
| 7+ dependencies | 5 |

### 5. Unknowns/Uncertainty

| Level | Score |
|-------|-------|
| No unknowns - Everything clear | 1 |
| Minimal - 1-2 minor questions | 2 |
| Some - Several questions, researchable | 3 |
| Significant - Many questions, requires exploration | 4 |
| Many - Unclear scope, needs prototyping | 5 |

### 6. Cross-Cutting Concerns

| Scope | Score |
|-------|-------|
| Isolated change - Single module | 1 |
| Minor integration - 2-3 modules | 2 |
| Multiple integrations - 4-5 modules | 3 |
| Cross-cutting - Affects many modules | 4 |
| Architectural - System-wide impact | 5 |

### 7. Risk Level

| Risk | Score |
|------|-------|
| No risk - Trivial change | 1 |
| Low risk - Well-understood pattern | 2 |
| Medium risk - Some complexity, testable | 3 |
| High risk - Complex logic, many edge cases | 4 |
| Very high risk - Mission-critical, high stakes | 5 |

## Step 3: Calculate Total Score

**Sum all scores:** _____ / 35

**Calculate average:** Total / 7 = _____

### Complexity Level Assignment

| Average Score | Level | Classification |
|---------------|-------|----------------|
| 1.0 - 1.4 | 1 | Trivial |
| 1.5 - 2.4 | 2 | Simple |
| 2.5 - 3.4 | 3 | Moderate |
| 3.5 - 4.4 | 4 | Complex |
| 4.5 - 5.0 | 5 | Very Complex |

## Step 4: Decision

### Level 1-3: Proceed

Task is manageable. Continue with implementation.

### Level 4-5: Break Down

Task is too complex. Decompose into subtasks and reassess each part.

## Output Format

Provide assessment in this format:

```
## Complexity Assessment: [Target]

**Date:** YYYY-MM-DD
**Assessor:** [Agent Name]

### Scores
| Criterion | Score |
|-----------|-------|
| Lines of Code | X/5 |
| Time Estimate | X/5 |
| Files Affected | X/5 |
| Dependencies | X/5 |
| Unknowns | X/5 |
| Cross-Cutting | X/5 |
| Risk Level | X/5 |
| **Total** | **XX/35** |

### Result
**Average Score:** X.X
**Complexity Level:** X ([Classification])
**Can Proceed:** Yes/No

### Recommendation
[Next steps based on complexity level]
```

## Related Skills

- quality-gates - Full gate checking workflow
- brainstorming - Breaking down complex tasks
- architecture-decision-record - Documenting decisions for complex work

## Capability Details

### complexity-scoring
**Keywords:** complexity, assessment, scoring, estimate, effort
**Solves:**
- How complex is this task?
- Should I break this down first?
- What is the effort estimate?

### codebase-analysis
**Keywords:** metrics, lines of code, files, dependencies, analysis
**Solves:**
- How many files will this touch?
- What are the dependencies?
- How much code is involved?

### risk-assessment
**Keywords:** risk, unknowns, cross-cutting, architectural
**Solves:**
- What are the risks of this change?
- Are there unknowns to address first?
- Does this have system-wide impact?
