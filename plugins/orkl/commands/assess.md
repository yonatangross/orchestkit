---
description: "Assesses and rates quality 0-10 with pros/cons analysis. Use when evaluating code, designs, or approaches."
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes, Bash]
---

# Auto-generated from skills/assess/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Assess

Comprehensive assessment skill for answering "is this good?" with structured evaluation, scoring, and actionable recommendations.

## Quick Start

```bash
/ork:assess backend/app/services/auth.py
/ork:assess our caching strategy
/ork:assess the current database schema
/ork:assess frontend/src/components/Dashboard
```


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


## STEP 0b: Select Orchestration Mode

See [Orchestration Mode](references/orchestration-mode.md) for env var check logic, Agent Teams vs Task Tool comparison, and mode selection rules.

Choose **Agent Teams** (mesh — assessors cross-validate scores) or **Task tool** (star — all report to lead) based on the orchestration mode reference.

> **Context window:** For full codebase assessments (>20 files), use the 1M context window to avoid agent context exhaustion. On 200K context, the scope discovery in Phase 1.5 limits files to prevent overflow.


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


## What This Skill Answers

| Question | How It's Answered |
|----------|-------------------|
| "Is this good?" | Quality score 0-10 with reasoning |
| "What are the trade-offs?" | Structured pros/cons list |
| "Should we change this?" | Improvement suggestions with effort |
| "What are the alternatives?" | Comparison with scores |
| "Where should we focus?" | Prioritized recommendations |


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


## Phase 1: Target Understanding

Identify what's being assessed (code, design, approach, decision, pattern) and gather context:

```python
# PARALLEL - Gather context
Read(file_path="$ARGUMENTS")  # If file path
Grep(pattern="$ARGUMENTS", output_mode="files_with_matches")
mcp__memory__search_nodes(query="$ARGUMENTS")  # Past decisions
```


## Phase 1.5: Scope Discovery (CRITICAL — prevents context exhaustion)

**Before spawning any agents**, build a bounded file list. Agents that receive unbounded targets will exhaust their context windows reading the entire codebase.

```python
# 1. Discover target files
if is_file(target):
    scope_files = [target]
elif is_directory(target):
    scope_files = Glob(f"{target}/**/*.{{py,ts,tsx,js,jsx,go,rs,java}}")
else:
    # Concept/topic — search for relevant files
    scope_files = Grep(pattern=target, output_mode="files_with_matches", head_limit=50)

# 2. Apply limits — MAX 30 files for agent assessment
MAX_FILES = 30
if len(scope_files) > MAX_FILES:
    # Prioritize: entry points, configs, security-critical, then sample rest
    # Skip: test files (except for testability agent), generated files, vendor/
    prioritized = prioritize_files(scope_files)  # entry points first
    scope_files = prioritized[:MAX_FILES]
    # Tell user about sampling
    print(f"Target has {len(scope_files)} files. Sampling {MAX_FILES} representative files.")

# 3. Format as file list string for agent prompts
file_list = "\n".join(f"- {f}" for f in scope_files)
```

**Sampling priorities** (when >30 files):
1. Entry points (main, index, app, server)
2. Config files (settings, env, config)
3. Security-sensitive (auth, middleware, api routes)
4. Core business logic (services, models, domain)
5. Representative samples from remaining directories


## Phase 2: Quality Rating (7 Dimensions)

Rate each dimension 0-10 with weighted composite score. See [Quality Model](references/quality-model.md) for scoring dimensions, weights, and grade interpretation. See [Scoring Rubric](references/scoring-rubric.md) for detailed per-dimension criteria.

**Composite Score:** Weighted average of all 7 dimensions (see quality-model.md).

Launch parallel agents with `run_in_background=True`. **Always include the scoped file list from Phase 1.5** in every agent prompt — agents without scope constraints will exhaust their context windows.

### Phase 2 — Task Tool Mode (Default)

For each dimension, spawn a background agent with **scope constraints**:

```python
for dimension, agent_type in [
    ("CORRECTNESS + MAINTAINABILITY", "code-quality-reviewer"),
    ("SECURITY", "security-auditor"),
    ("PERFORMANCE + SCALABILITY", "python-performance-engineer"),  # Use python-performance-engineer for backend; frontend-performance-engineer for frontend
    ("TESTABILITY", "test-generator"),
]:
    Task(subagent_type=agent_type, run_in_background=True, max_turns=25,
         prompt=f"""Assess {dimension} (0-10) for: {target}

## Scope Constraint
ONLY read and analyze the following {len(scope_files)} files — do NOT explore beyond this list:
{file_list}

Budget: Use at most 15 tool calls. Read files from the list above, then produce your score
with reasoning, evidence, and 2-3 specific improvement suggestions.
Do NOT use Glob or Grep to discover additional files.""")
```

Then collect results from all agents and proceed to Phase 3.

### Phase 2 — Agent Teams Alternative

> See [references/agent-teams-mode.md](references/agent-teams-mode.md) for Agent Teams assessment workflow with cross-validation and team teardown.


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


## Phase 4: Alternative Comparison

See [Alternative Analysis](references/alternative-analysis.md) for full comparison template.

| Criteria | Current | Alternative A | Alternative B |
|----------|---------|---------------|---------------|
| Composite | [N.N] | [N.N] | [N.N] |
| Migration Effort | N/A | [1-5] | [1-5] |


## Phase 5: Improvement Suggestions

See [Improvement Prioritization](references/improvement-prioritization.md) for effort/impact guidelines.

| Suggestion | Effort (1-5) | Impact (1-5) | Priority (I/E) |
|------------|--------------|--------------|----------------|
| [action] | [N] | [N] | [ratio] |

**Quick Wins** = Effort <= 2 AND Impact >= 4. Always highlight these first.


## Phase 6: Effort Estimation

| Timeframe | Tasks | Total |
|-----------|-------|-------|
| Quick wins (< 1hr) | [list] | X min |
| Short-term (< 1 day) | [list] | X hrs |
| Medium-term (1-3 days) | [list] | X days |


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


## Grade Interpretation

See [Quality Model](references/quality-model.md) for scoring dimensions, weights, and grade interpretation.


## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 7 dimensions | Comprehensive coverage | All quality aspects without overwhelming |
| 0-10 scale | Industry standard | Easy to understand and compare |
| Parallel assessment | 4 agents (7 dimensions) | Fast, thorough evaluation |
| Effort/Impact scoring | 1-5 scale | Simple prioritization math |


## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| [complexity-metrics](rules/complexity-metrics.md) | HIGH | 7-criterion scoring (1-5), complexity levels, thresholds |
| [complexity-breakdown](rules/complexity-breakdown.md) | HIGH | Task decomposition strategies, risk assessment |

## Related Skills

- `assess-complexity` - Task complexity assessment
- `ork:verify` - Post-implementation verification
- `ork:code-review-playbook` - Code review patterns
- `ork:quality-gates` - Quality gate patterns


**Version:** 1.1.0 (February 2026)
