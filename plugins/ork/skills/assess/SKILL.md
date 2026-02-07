---
name: assess
description: "Assesses and rates quality 0-10 with pros/cons analysis. Use when evaluating code, designs, or approaches."
context: fork
version: 1.1.0
author: OrchestKit
tags: [assessment, evaluation, quality, comparison, pros-cons, rating]
user-invocable: true
allowedTools: [AskUserQuestion, Read, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes, Bash]
skills: [code-review-playbook, assess-complexity, quality-gates, architecture-decision-record, memory]
argument-hint: [code-path-or-topic]
complexity: low
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

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify assessment dimensions:

```python
AskUserQuestion(
  questions=[{
    "question": "What dimensions to assess?",
    "header": "Dimensions",
    "options": [
      {"label": "Full assessment (Recommended)", "description": "All dimensions: quality, maintainability, security, performance"},
      {"label": "Code quality only", "description": "Readability, complexity, best practices"},
      {"label": "Security focus", "description": "Vulnerabilities, attack surface, compliance"},
      {"label": "Quick score", "description": "Just give me a 0-10 score with brief notes"}
    ],
    "multiSelect": false
  }]
)
```

**Based on answer, adjust workflow:**
- **Full assessment**: All 7 phases, parallel agents
- **Code quality only**: Skip security and performance phases
- **Security focus**: Prioritize security-auditor agent
- **Quick score**: Single pass, brief output

---

## STEP 0b: Select Orchestration Mode

Choose **Agent Teams** (mesh — assessors cross-validate scores) or **Task tool** (star — all report to lead):

1. `ORCHESTKIT_PREFER_TEAMS=1` → **Agent Teams mode**
2. Agent Teams unavailable → **Task tool mode** (default)
3. Otherwise: Full assessment with 6 dimension agents → recommend **Agent Teams**; Quick score or single-dimension → **Task tool**

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Score calibration | Lead normalizes independently | Assessors discuss disagreements |
| Cross-dimension findings | Lead correlates after completion | Security assessor alerts performance assessor of overlap |
| Cost | ~200K tokens | ~500K tokens |
| Best for | Quick scores, single dimension | Full multi-dimensional assessment |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining assessment.

---

## Task Management (CC 2.1.16)

```python
# Create main assessment task
TaskCreate(
  subject="Assess: {target}",
  description="Comprehensive evaluation with quality scores and recommendations",
  activeForm="Assessing {target}"
)

# Create subtasks for 7-phase process
for phase in ["Understand target", "Rate quality", "List pros/cons",
              "Compare alternatives", "Generate suggestions",
              "Estimate effort", "Compile report"]:
    TaskCreate(subject=phase, activeForm=f"{phase}ing")
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
| **2. Quality Rating** | 6-dimension scoring (0-10) | Scores with reasoning |
| **3. Pros/Cons Analysis** | Strengths and weaknesses | Balanced evaluation |
| **4. Alternative Comparison** | Score alternatives | Comparison matrix |
| **5. Improvement Suggestions** | Actionable recommendations | Prioritized list |
| **6. Effort Estimation** | Time and complexity estimates | Effort breakdown |
| **7. Assessment Report** | Compile findings | Final report |

---

## Phase 1: Target Understanding

Identify what's being assessed (code, design, approach, decision, pattern) and gather context:

```python
# PARALLEL - Gather context
Read(file_path="$ARGUMENTS")  # If file path
Grep(pattern="$ARGUMENTS", output_mode="files_with_matches")
mcp__memory__search_nodes(query="$ARGUMENTS")  # Past decisions
```

---

## Phase 2: Quality Rating (6 Dimensions)

Rate each dimension 0-10 with weighted composite score. See [Scoring Rubric](references/scoring-rubric.md) for details.

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Correctness | 0.20 | Does it work correctly? |
| Maintainability | 0.20 | Easy to understand/modify? |
| Performance | 0.15 | Efficient, no bottlenecks? |
| Security | 0.15 | Follows best practices? |
| Scalability | 0.15 | Handles growth? |
| Testability | 0.15 | Easy to test? |

**Composite Score:** Weighted average of all dimensions.

Launch 6 parallel agents (one per dimension) with `run_in_background=True`.

### Phase 2 — Agent Teams Alternative

In Agent Teams mode, form an assessment team where dimension assessors cross-validate scores and discuss disagreements:

```python
TeamCreate(team_name="assess-{target-slug}", description="Assess {target}")

Task(subagent_type="code-quality-reviewer", name="correctness-assessor",
     team_name="assess-{target-slug}",
     prompt="""Assess CORRECTNESS (0-10) and MAINTAINABILITY (0-10) for: {target}
     When you find issues that affect security, message security-assessor.
     When you find issues that affect performance, message perf-assessor.
     Share your scores with all teammates for calibration — if scores diverge
     significantly (>2 points), discuss the disagreement.""")

Task(subagent_type="security-auditor", name="security-assessor",
     team_name="assess-{target-slug}",
     prompt="""Assess SECURITY (0-10) for: {target}
     When correctness-assessor flags security-relevant patterns, investigate deeper.
     When you find performance-impacting security measures, message perf-assessor.
     Share your score and flag any cross-dimension trade-offs.""")

Task(subagent_type="performance-engineer", name="perf-assessor",
     team_name="assess-{target-slug}",
     prompt="""Assess PERFORMANCE (0-10) and SCALABILITY (0-10) for: {target}
     When security-assessor flags performance trade-offs, evaluate the impact.
     When you find testability issues (hard-to-benchmark code), message test-assessor.
     Share your scores with reasoning for the composite calculation.""")

Task(subagent_type="test-generator", name="test-assessor",
     team_name="assess-{target-slug}",
     prompt="""Assess TESTABILITY (0-10) for: {target}
     Evaluate test coverage, test quality, and ease of testing.
     When other assessors flag dimension-specific concerns, verify test coverage
     for those areas. Share your score and any coverage gaps found.""")
```

**Team teardown** after report compilation:
```python
SendMessage(type="shutdown_request", recipient="correctness-assessor", content="Assessment complete")
SendMessage(type="shutdown_request", recipient="security-assessor", content="Assessment complete")
SendMessage(type="shutdown_request", recipient="perf-assessor", content="Assessment complete")
SendMessage(type="shutdown_request", recipient="test-assessor", content="Assessment complete")
TeamDelete()
```

> **Fallback:** If team formation fails, use standard Phase 2 Task spawns above.

---

## Phase 3: Pros/Cons Analysis

```markdown
## Pros (Strengths)
| # | Strength | Impact | Evidence |
|---|----------|--------|----------|
| 1 | [strength] | High/Med/Low | [example] |

## Cons (Weaknesses)
| # | Weakness | Severity | Evidence |
|---|----------|----------|----------|
| 1 | [weakness] | High/Med/Low | [example] |

**Net Assessment:** [Strengths outweigh / Balanced / Weaknesses dominate]
**Recommended action:** [Keep as-is / Improve / Reconsider / Rewrite]
```

---

## Phase 4: Alternative Comparison

See [Alternative Analysis](references/alternative-analysis.md) for full comparison template.

| Criteria | Current | Alternative A | Alternative B |
|----------|---------|---------------|---------------|
| Composite | [N.N] | [N.N] | [N.N] |
| Migration Effort | N/A | [1-5] | [1-5] |

---

## Phase 5: Improvement Suggestions

See [Improvement Prioritization](references/improvement-prioritization.md) for effort/impact guidelines.

| Suggestion | Effort (1-5) | Impact (1-5) | Priority (I/E) |
|------------|--------------|--------------|----------------|
| [action] | [N] | [N] | [ratio] |

**Quick Wins** = Effort <= 2 AND Impact >= 4. Always highlight these first.

---

## Phase 6: Effort Estimation

| Timeframe | Tasks | Total |
|-----------|-------|-------|
| Quick wins (< 1hr) | [list] | X min |
| Short-term (< 1 day) | [list] | X hrs |
| Medium-term (1-3 days) | [list] | X days |

---

## Phase 7: Assessment Report

See [Scoring Rubric](references/scoring-rubric.md) for full report template.

```markdown
# Assessment Report: $ARGUMENTS

**Overall Score: [N.N]/10** (Grade: [A+/A/B/C/D/F])

**Verdict:** [EXCELLENT | GOOD | ADEQUATE | NEEDS WORK | CRITICAL]

## Answer: Is This Good?
**[YES / MOSTLY / SOMEWHAT / NO]**
[Reasoning]
```

---

## Grade Interpretation

| Score | Grade | Verdict |
|-------|-------|---------|
| 9.0-10.0 | A+ | EXCELLENT |
| 8.0-8.9 | A | GOOD |
| 7.0-7.9 | B | GOOD |
| 6.0-6.9 | C | ADEQUATE |
| 5.0-5.9 | D | NEEDS WORK |
| 0.0-4.9 | F | CRITICAL |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 6 dimensions | Comprehensive coverage | All quality aspects without overwhelming |
| 0-10 scale | Industry standard | Easy to understand and compare |
| Parallel assessment | 6 agents | Fast, thorough evaluation |
| Effort/Impact scoring | 1-5 scale | Simple prioritization math |

---

## Related Skills

- `assess-complexity` - Task complexity assessment
- `verify` - Post-implementation verification
- `code-review-playbook` - Code review patterns
- `quality-gates` - Quality gate patterns

---

**Version:** 1.0.0 (January 2026)
