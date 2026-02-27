---
name: assess
license: MIT
compatibility: "Claude Code 2.1.59+. Requires memory MCP server."
description: "Assesses and rates quality 0-10 with pros/cons analysis. Use when evaluating code, designs, or approaches."
context: fork
version: 1.1.0
author: OrchestKit
tags: [assessment, evaluation, quality, comparison, pros-cons, rating]
user-invocable: true
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes, Bash]
skills: [code-review-playbook, quality-gates, architecture-decision-record, memory]
argument-hint: "[code-path-or-topic]"
complexity: high
metadata:
  category: document-asset-creation
  mcp-server: memory
---

# Assess

Comprehensive assessment skill for answering "is this good?" with structured evaluation, scoring, and actionable recommendations.

## Quick Start

```bash
/ork:assess backend/app/services/auth.py
/ork:assess our caching strategy
/ork:assess the current database schema
/ork:assess frontend/src/components/Dashboard
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

See [Orchestration Mode](references/orchestration-mode.md) for env var check logic, Agent Teams vs Task Tool comparison, and mode selection rules.

---

## Task Management (CC 2.1.16)

```python
TaskCreate(
  subject="Assess: {target}",
  description="Comprehensive evaluation with quality scores and recommendations",
  activeForm="Assessing {target}"
)
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
| **1.5. Scope Discovery** | Build bounded file list | Scoped file list |
| **2. Quality Rating** | 7-dimension scoring (0-10) | Scores with reasoning |
| **3. Pros/Cons Analysis** | Strengths and weaknesses | Balanced evaluation |
| **4. Alternative Comparison** | Score alternatives | Comparison matrix |
| **5. Improvement Suggestions** | Actionable recommendations | Prioritized list |
| **6. Effort Estimation** | Time and complexity estimates | Effort breakdown |
| **7. Assessment Report** | Compile findings | Final report |

---

## Phase 1: Target Understanding

Identify what's being assessed and gather context:

```python
# PARALLEL - Gather context
Read(file_path="$ARGUMENTS[0]")  # If file path
Grep(pattern="$ARGUMENTS[0]", output_mode="files_with_matches")
mcp__memory__search_nodes(query="$ARGUMENTS[0]")  # Past decisions
```

---

## Phase 1.5: Scope Discovery

See [Scope Discovery](references/scope-discovery.md) for the full file discovery, limit application (MAX 30 files), and sampling priority logic. **Always include the scoped file list** in every agent prompt.

---

## Phase 2: Quality Rating (7 Dimensions)

Rate each dimension 0-10 with weighted composite score. See [Quality Model](references/quality-model.md) for dimensions, weights, and grade interpretation. See [Scoring Rubric](references/scoring-rubric.md) for per-dimension criteria.

See [Agent Spawn Definitions](references/agent-spawn-definitions.md) for Task Tool mode spawn patterns and Agent Teams alternative.

**Composite Score:** Weighted average of all 7 dimensions (see quality-model.md).

---

## Phases 3-7: Analysis, Comparison & Report

See [Phase Templates](references/phase-templates.md) for output templates for pros/cons, alternatives, improvements, effort, and the final report.

See also: [Alternative Analysis](references/alternative-analysis.md) | [Improvement Prioritization](references/improvement-prioritization.md)

---

## Grade Interpretation

See [Quality Model](references/quality-model.md) for scoring dimensions, weights, and grade interpretation.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 7 dimensions | Comprehensive coverage | All quality aspects without overwhelming |
| 0-10 scale | Industry standard | Easy to understand and compare |
| Parallel assessment | 4 agents (7 dimensions) | Fast, thorough evaluation |
| Effort/Impact scoring | 1-5 scale | Simple prioritization math |

---

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

---

**Version:** 1.1.0 (February 2026)
