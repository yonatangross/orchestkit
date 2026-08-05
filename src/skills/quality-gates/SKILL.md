---
name: quality-gates
license: MIT
compatibility: "Claude Code 2.1.220+."
description: Use when assessing task complexity, before starting complex tasks, when stuck after multiple attempts, or reviewing code against best practices. Provides quality-gates scoring (1-5), escalation workflows, and pattern library management.
context: fork
agent: code-quality-reviewer
version: 1.3.0
author: OrchestKit
tags: [quality, complexity, planning, escalation, blocking, best-practices, patterns, yagni, over-engineering]
skills: [scope-appropriate-architecture]
user-invocable: false
disable-model-invocation: false
complexity: max
persuasion-type: discipline
effort: high
hooks:
  PreToolUse:
    - matcher: "Read"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/quality-baseline-loader"
      once: true
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Quality Gates

This skill teaches agents how to assess task complexity, enforce quality gates, and prevent wasted work on incomplete or poorly-defined tasks.

**Key Principle:** Stop and clarify before proceeding with incomplete information. Better to ask questions than to waste cycles on the wrong solution.

---

## Overview

### Auto-Activate Triggers
- Receiving a new task assignment
- Starting a complex feature implementation
- Before allocating work in Squad mode
- When requirements seem unclear or incomplete
- After 3 failed attempts at the same task
- When blocked by dependencies

### Manual Activation
- User asks for complexity assessment
- Planning a multi-step project
- Before committing to a timeline

---

## Core Concepts

### Complexity Scoring (1-5 Scale)

| Level | Files | Lines | Time | Characteristics |
|-------|-------|-------|------|-----------------|
| 1 - Trivial | 1 | < 50 | < 30 min | No deps, no unknowns |
| 2 - Simple | 1-3 | 50-200 | 30 min - 2 hr | 0-1 deps, minimal unknowns |
| 3 - Moderate | 3-10 | 200-500 | 2-8 hr | 2-3 deps, some unknowns |
| 4 - Complex | 10-25 | 500-1500 | 8-24 hr | 4-6 deps, significant unknowns |
| 5 - Very Complex | 25+ | 1500+ | 24+ hr | 7+ deps, many unknowns |

The table above is the canonical rubric. Score with `max(file_count, LOC, dependency_count, unknowns)`, not an average: one Level 5 axis makes the task Level 5. Run `scripts/assess-complexity.md` or `scripts/analyze-codebase.sh <target>` to measure the inputs.

### Blocking Thresholds

| Condition | Threshold | Action |
|-----------|-----------|--------|
| **YAGNI Gate** | **Justified ratio > 2.0** | **BLOCK with simpler alternatives** |
| YAGNI Warning | Justified ratio 1.5-2.0 | WARN with simpler alternatives |
| Critical Questions | > 3 unanswered | BLOCK |
| Missing Dependencies | Any blocking | BLOCK |
| Failed Attempts | >= 3 | BLOCK & ESCALATE |
| Evidence Failure | 2 fix attempts | BLOCK |
| Complexity Overflow | Level 4-5 no plan | BLOCK |

**WARNING Conditions** (proceed with caution):
- Level 3 complexity
- 1-2 unanswered questions
- 1-2 failed attempts

The escalation protocol and gate decision logic are both in "Quick Reference" below. The YAGNI ratio, tier LOC budgets, and simpler-alternative surfacing live in `rules/yagni-gate.md`.

---

## References

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/quality-gates/references/<file>")`:
| File | Content |
|------|---------|
| `ork-delta.md` | OrchestKit-specific scars and house decisions: line-counting correctness, fail-open policy, gate self-monitoring, non-bypassable categories |
| `unified-scoring-framework.md` | Canonical 0-10 dimensions, weights, grade thresholds, improvement prioritization. Also loaded by `ork:assess` and `ork:verify` |

---

## Upstream coverage (do not restate)

This skill wraps generic quality-gate practice and keeps only the OrchestKit delta. When one of these topics comes up, go to the source instead of re-teaching it here.

| Topic | Source |
|-------|--------|
| Complexity 1-5 rubric, per-level examples, assessment formula | "Complexity Scoring" table above, canonical |
| BLOCKING vs WARNING conditions, escalation protocol, attempt tracking | "Blocking Thresholds" and "Quick Reference" above, canonical |
| YAGNI ratio, project tier LOC budgets, simpler alternatives | `rules/yagni-gate.md` + `ork:scope-appropriate-architecture` |
| Score dimensions, weights, grade thresholds | `references/unified-scoring-framework.md` |
| LLM-as-judge, G-Eval, aspect scoring, metric APIs | `ork:testing-llm` |
| Requirements completeness, acceptance criteria templates | `ork:write-prd` |
| Test standards enforced as part of a gate | `ork:architecture-patterns` |
| Repo metrics for a gate input (files, LOC, tests, churn) | `scripts/analyze-codebase.sh` in this skill |
| LangGraph conditional routing for a gate node | https://langchain-ai.github.io/langgraph/ |
| FastAPI error responses for a failed gate | https://fastapi.tiangolo.com/tutorial/handling-errors/ |
| Pydantic validators for gate output schemas | https://docs.pydantic.dev/latest/concepts/validators/ |
| Retry with exponential backoff, SLO-based alerting on gates | https://sre.google/workbook/alerting-on-slos/ |

---

## Quick Reference

### Gate Decision Flow

```
0. YAGNI check (runs FIRST — before any implementation planning)
   → Read project tier from scope-appropriate-architecture
   → Calculate justified_complexity = planned_LOC / tier_appropriate_LOC
   → If ratio > 2.0: BLOCK (must simplify)
   → If ratio 1.5-2.0: WARN (present simpler alternative)
   → Security patterns exempt from YAGNI gate

1. Assess complexity (1-5)
2. Count critical questions unanswered
3. Check dependencies blocked
4. Check attempt count

if (yagni_ratio > 2.0) -> BLOCK with simpler alternatives
else if (questions > 3 || deps blocked || attempts >= 3) -> BLOCK
else if (complexity >= 4 && no plan) -> BLOCK
else if (yagni_ratio > 1.5 || complexity == 3 || questions 1-2) -> WARNING
else -> PASS
```

### Gate Check Template

```markdown
## Quality Gate: [Task Name]

**Complexity:** Level [1-5]
**Unanswered Critical Questions:** [Count]
**Blocked Dependencies:** [List or None]
**Failed Attempts:** [Count]

**Status:** PASS / WARNING / BLOCKED
**Can Proceed:** Yes / No
```

### Escalation Template

```markdown
## Escalation: Task Blocked

**Task:** [Description]
**Block Type:** [Critical Questions / Dependencies / Stuck / Evidence]
**Attempts:** [Count]

### What Was Tried
1. [Approach 1] - Failed: [Reason]
2. [Approach 2] - Failed: [Reason]

### Need Guidance On
- [Specific question]

**Recommendation:** [Suggested action]
```

---

## Integration with Context System

```javascript
// Add gate check to context
context.quality_gates = context.quality_gates || [];
context.quality_gates.push({
  task_id: taskId,
  timestamp: new Date().toISOString(),
  complexity_score: 3,
  gate_status: 'pass', // pass, warning, blocked
  critical_questions_count: 1,
  unanswered_questions: 1,
  dependencies_blocked: 0,
  attempt_count: 0,
  can_proceed: true
});
```

## Integration with Evidence System

```javascript
// Before marking task complete
const evidence = context.quality_evidence;
const hasPassingEvidence = (
  evidence?.tests?.exit_code === 0 ||
  evidence?.build?.exit_code === 0
);

if (!hasPassingEvidence) {
  return { gate_status: 'blocked', reason: 'no_passing_evidence' };
}
```

---

## Best Practices Pattern Library

Track success/failure patterns across projects to prevent repeating mistakes and proactively warn during code reviews.

| Rule | File | Key Pattern |
|------|------|-------------|
| YAGNI Gate | `rules/yagni-gate.md` | Pre-implementation scope check, justified complexity ratio, simpler alternatives |
| Pattern Library | `rules/practices-code-standards.md` | Success/failure tracking, confidence scoring, memory integration |
| Review Checklist | `rules/practices-review-checklist.md` | Category-based review, proactive anti-pattern detection |

### Pattern Confidence Levels

| Level | Meaning | Action |
|-------|---------|--------|
| Strong success | 3+ projects, 100% success | Always recommend |
| Mixed results | Both successes and failures | Context-dependent |
| Strong anti-pattern | 3+ projects, all failed | Block with explanation |

---

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Skip gates for "simple" tasks | Get stuck later | Always run gate check |
| Ignore WARNING status | Undocumented assumptions cause issues | Document every assumption |
| Not tracking attempts | Waste cycles on same approach | Track every attempt, escalate at 3 |
| Proceed when BLOCKED | Build wrong solution | NEVER bypass BLOCKED gates |

---

---

## Related Skills

- `ork:scope-appropriate-architecture` - Project tier detection that feeds YAGNI gate
- `ork:architecture-patterns` - Enforce testing standards as part of quality gates
- `ork:testing-llm` - LLM-as-judge patterns for quality validation (DeepEval, RAGAS)
- `ork:golden-dataset` - Validate datasets meet quality thresholds

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Complexity Scale | 1-5 levels | Granular enough for estimation, simple enough for quick assessment |
| Block Threshold | 3 critical questions | Prevents proceeding with too many unknowns |
| Escalation Trigger | 3 failed attempts | Balances persistence with avoiding wasted cycles |
| Level 4-5 Requirement | Plan required | Complex tasks need upfront decomposition |

## Capability Details

### complexity-scoring
**Keywords:** complexity, score, difficulty, estimate, sizing, 1-5 scale
**Solves:** How complex is this task? Score task complexity on 1-5 scale, assess implementation difficulty

### blocking-thresholds
**Keywords:** blocking, threshold, gate, stop, escalate, cannot proceed
**Solves:** When should I block progress? >3 critical questions = BLOCK, Missing dependencies = BLOCK

### critical-questions
**Keywords:** critical questions, unanswered, unknowns, clarify
**Solves:** What are critical questions? Count unanswered, block if >3

### stuck-detection
**Keywords:** stuck, failed attempts, retry, 3 attempts, escalate
**Solves:** How do I detect when stuck? After 3 failed attempts, escalate

### gate-validation
**Keywords:** validate, gate check, pass, fail, gate status
**Solves:** How do I validate quality gates? Run pre-task gate validation

### pre-task-gate-check
**Keywords:** pre-task, before starting, can proceed
**Solves:** How do I check gates before starting? Assess complexity, identify blockers

### complexity-breakdown
**Keywords:** breakdown, decompose, subtasks, split task
**Solves:** How do I break down complex tasks? Split Level 4-5 into Level 1-3 subtasks

### requirements-completeness
**Keywords:** requirements, incomplete, acceptance criteria
**Solves:** Gate check only: is the requirement set complete enough to start? Authoring the requirements themselves belongs to `ork:write-prd` (see Upstream coverage)

### escalation-protocol
**Keywords:** escalate, ask user, need help, human guidance
**Solves:** When and how to escalate? Escalate after 3 failed attempts

### llm-as-judge
**Keywords:** llm as judge, g-eval, aspect scoring, quality validation
**Solves:** Gate thresholds only: what score must a judge return to pass? Building and running the judge belongs to `ork:testing-llm` (see Upstream coverage)

### yagni-gate
**Keywords:** yagni, over-engineering, justified complexity, scope check, too complex, simplify
**Solves:** Is this complexity justified? Calculate justified_complexity ratio against project tier, BLOCK if > 2.0, surface simpler alternatives