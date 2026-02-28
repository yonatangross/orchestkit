---
description: "Comprehensive verification with parallel test agents. Use when verifying implementations or validating changes."
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, TaskOutput, TaskStop, mcp__memory__search_nodes]
---

# Auto-generated from skills/verify/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Verify Feature

Comprehensive verification using parallel specialized agents with nuanced grading (0-10 scale) and improvement suggestions.

## Quick Start

```bash
/ork:verify authentication flow
/ork:verify user profile feature
/ork:verify --scope=backend database migrations
```

## Argument Resolution

```python
SCOPE = "$ARGUMENTS"       # Full argument string, e.g., "authentication flow"
SCOPE_TOKEN = "$ARGUMENTS[0]"  # First token for flag detection (e.g., "--scope=backend")
# $ARGUMENTS[0], $ARGUMENTS[1] etc. for indexed access (CC 2.1.59)
```

> **Opus 4.6**: Agents use native adaptive thinking (no MCP sequential-thinking needed). Extended 128K output supports comprehensive verification reports.


## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify verification scope:

```python
AskUserQuestion(
  questions=[{
    "question": "What scope for this verification?",
    "header": "Scope",
    "options": [
      {"label": "Full verification (Recommended)", "description": "All tests + security + code quality + grades"},
      {"label": "Tests only", "description": "Run unit + integration + e2e tests"},
      {"label": "Security audit", "description": "Focus on security vulnerabilities"},
      {"label": "Code quality", "description": "Lint, types, complexity analysis"},
      {"label": "Quick check", "description": "Just run tests, skip detailed analysis"}
    ],
    "multiSelect": false
  }]
)
```

**Based on answer, adjust workflow:**
- **Full verification**: All 8 phases, all 6 parallel agents
- **Tests only**: Skip phases 2 (security), 5 (UI/UX analysis)
- **Security audit**: Focus on security-auditor agent
- **Code quality**: Focus on code-quality-reviewer agent
- **Quick check**: Run tests only, skip grading and suggestions


## STEP 0b: Select Orchestration Mode

See [Orchestration Mode](references/orchestration-mode.md) for env var check logic, Agent Teams vs Task Tool comparison, and mode selection rules.

Choose **Agent Teams** (mesh -- verifiers share findings) or **Task tool** (star -- all report to lead) based on the orchestration mode reference.


## Task Management (CC 2.1.16)

```python
# Create main verification task
TaskCreate(
  subject="Verify [feature-name] implementation",
  description="Comprehensive verification with nuanced grading",
  activeForm="Verifying [feature-name] implementation"
)

# Create subtasks for 8-phase process
phases = ["Run code quality checks", "Execute security audit",
          "Verify test coverage", "Validate API", "Check UI/UX",
          "Calculate grades", "Generate suggestions", "Compile report"]
for phase in phases:
    TaskCreate(subject=phase, activeForm=f"{phase}ing")
```


## 8-Phase Workflow

See [Verification Phases](references/verification-phases.md) for complete phase details, agent spawn definitions, Agent Teams alternative, and team teardown.

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Context Gathering** | Git diff, commit history | Changes summary |
| **2. Parallel Agent Dispatch** | 6 agents evaluate | 0-10 scores |
| **3. Test Execution** | Backend + frontend tests | Coverage data |
| **4. Nuanced Grading** | Composite score calculation | Grade (A-F) |
| **5. Improvement Suggestions** | Effort vs impact analysis | Prioritized list |
| **6. Alternative Comparison** | Compare approaches (optional) | Recommendation |
| **7. Metrics Tracking** | Trend analysis | Historical data |
| **8. Report Compilation** | Evidence artifacts | Final report |

### Phase 2 Agents (Quick Reference)

| Agent | Focus | Output |
|-------|-------|--------|
| code-quality-reviewer | Lint, types, patterns | Quality 0-10 |
| security-auditor | OWASP, secrets, CVEs | Security 0-10 |
| test-generator | Coverage, test quality | Coverage 0-10 |
| backend-system-architect | API design, async | API 0-10 |
| frontend-ui-developer | React 19, Zod, a11y | UI 0-10 |
| python-performance-engineer | Latency, resources, scaling | Performance 0-10 |

Launch ALL agents in ONE message with `run_in_background=True` and `max_turns=25`.


## Grading & Scoring

See [Scoring Rubric](rules/scoring-rubric.md) for composite formula, grade thresholds, verdict criteria, and blocking rules. See [Quality Model](references/quality-model.md) for dimension weights. See [Grading Rubric](references/grading-rubric.md) for per-agent scoring criteria.


## Evidence & Test Execution

See [Evidence Collection](rules/evidence-collection.md) for git commands, test execution patterns, metrics tracking, and post-verification feedback.


## Policy-as-Code

See [Policy-as-Code](references/policy-as-code.md) for configuration.

Define verification rules in `.claude/policies/verification-policy.json`:

```json
{
  "thresholds": {
    "composite_minimum": 6.0,
    "security_minimum": 7.0,
    "coverage_minimum": 70
  },
  "blocking_rules": [
    {"dimension": "security", "below": 5.0, "action": "block"}
  ]
}
```


## Report Format

See [Report Template](references/report-template.md) for full format. Summary:

```markdown
# Feature Verification Report

**Composite Score: [N.N]/10** (Grade: [LETTER])

## Verdict
**[READY FOR MERGE | IMPROVEMENTS RECOMMENDED | BLOCKED]**
```


## References

- [Verification Phases](references/verification-phases.md) -- 8-phase workflow, agent spawn definitions, Agent Teams mode
- [Quality Model](references/quality-model.md) -- Scoring dimensions and weights
- [Grading Rubric](references/grading-rubric.md) -- Per-agent scoring criteria
- [Report Template](references/report-template.md) -- Full report format
- [Alternative Comparison](references/alternative-comparison.md) -- Approach comparison template
- [Orchestration Mode](references/orchestration-mode.md) -- Agent Teams vs Task Tool
- [Policy-as-Code](references/policy-as-code.md) -- Verification policy configuration
- [Verification Checklist](references/verification-checklist.md) -- Pre-flight checklist

## Rules

- [Scoring Rubric](rules/scoring-rubric.md) -- Composite scoring, grades, verdicts
- [Evidence Collection](rules/evidence-collection.md) -- Evidence gathering and test patterns


## Related Skills

- `ork:implement` - Full implementation with verification
- `ork:review-pr` - PR-specific verification
- `run-tests` - Detailed test execution
- `ork:quality-gates` - Quality gate patterns


**Version:** 3.1.0 (February 2026)
