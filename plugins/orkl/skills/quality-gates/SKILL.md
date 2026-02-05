---
name: quality-gates
description: Use when assessing task complexity, before starting complex tasks, or when stuck after multiple attempts. Provides quality-gates scoring (1-5) and escalation workflows.
context: fork
agent: code-quality-reviewer
version: 1.1.0
author: OrchestKit AI Agent Hub
tags: [quality, complexity, planning, escalation, blocking]
user-invocable: false
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

**See:** `references/complexity-scoring.md` for detailed examples and assessment formulas.

### Blocking Thresholds

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Critical Questions | > 3 unanswered | BLOCK |
| Missing Dependencies | Any blocking | BLOCK |
| Failed Attempts | >= 3 | BLOCK & ESCALATE |
| Evidence Failure | 2 fix attempts | BLOCK |
| Complexity Overflow | Level 4-5 no plan | BLOCK |

**WARNING Conditions** (proceed with caution):
- Level 3 complexity
- 1-2 unanswered questions
- 1-2 failed attempts

**See:** `references/blocking-thresholds.md` for escalation protocols and decision logic.

---

## References

### Complexity Scoring
**See:** `references/complexity-scoring.md`

Key topics covered:
- Detailed Level 1-5 characteristics and examples
- Quick assessment formula
- Assessment checklist

### Blocking Thresholds & Escalation
**See:** `references/blocking-thresholds.md`

Key topics covered:
- BLOCKING vs WARNING conditions
- Escalation protocol and message templates
- Gate decision logic
- Attempt tracking

### Quality Gate Workflows
**See:** `references/workflows.md`

Key topics covered:
- Pre-task gate validation workflow
- Stuck detection and escalation workflow
- Complexity breakdown workflow (Level 4-5)
- Requirements completeness check

### Gate Patterns
**See:** `references/gate-patterns.md`

Key topics covered:
- Gate validation process templates
- Integration with context system
- Common pitfalls

### LLM Quality Validation
**See:** `references/llm-quality-validation.md`

Key topics covered:
- LLM-as-judge patterns
- Quality aspects (relevance, depth, coherence, accuracy, completeness)
- Fail-open vs fail-closed strategies
- Graceful degradation patterns
- Triple-consumer artifact design

---

## Quick Reference

### Gate Decision Flow

```
1. Assess complexity (1-5)
2. Count critical questions unanswered
3. Check dependencies blocked
4. Check attempt count

if (questions > 3 || deps blocked || attempts >= 3) -> BLOCK
else if (complexity >= 4 && no plan) -> BLOCK
else if (complexity == 3 || questions 1-2) -> WARNING
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

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Skip gates for "simple" tasks | Get stuck later | Always run gate check |
| Ignore WARNING status | Undocumented assumptions cause issues | Document every assumption |
| Not tracking attempts | Waste cycles on same approach | Track every attempt, escalate at 3 |
| Proceed when BLOCKED | Build wrong solution | NEVER bypass BLOCKED gates |

---

## Version History

**v1.1.0** - Added LLM-as-judge quality validation, retry logic, graceful degradation, triple-consumer artifact design

**v1.0.0** - Initial release with complexity scoring, blocking thresholds, stuck detection, requirements checks

---

**Remember:** Quality gates prevent wasted work. Better to ask questions upfront than to build the wrong solution. When in doubt, BLOCK and escalate.

---

## Related Skills

- `test-standards-enforcer` - Enforce testing standards as part of quality gates
- `llm-evaluation` - LLM-as-judge patterns for quality validation
- `golden-dataset-validation` - Validate datasets meet quality thresholds

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
**Solves:** Are requirements complete enough? Check functional/technical requirements

### escalation-protocol
**Keywords:** escalate, ask user, need help, human guidance
**Solves:** When and how to escalate? Escalate after 3 failed attempts

### llm-as-judge
**Keywords:** llm as judge, g-eval, aspect scoring, quality validation
**Solves:** How do I use LLM-as-judge? Evaluate relevance, depth, coherence with thresholds