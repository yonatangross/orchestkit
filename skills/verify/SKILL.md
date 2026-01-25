---
name: verify
description: Comprehensive feature verification with parallel analysis agents. Use when verifying implementations, testing changes, validating features, or checking correctness.
context: fork
version: 3.0.0
author: OrchestKit
tags: [verification, testing, quality, validation, parallel-agents, grading]
user-invocable: true
allowedTools: [Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes]
skills: [code-review-playbook, security-scanning, evidence-verification, run-tests, unit-testing, integration-testing, recall, quality-gates]
---

# Verify Feature

Comprehensive verification using parallel specialized agents with nuanced grading (0-10 scale) and improvement suggestions.

## Quick Start

```bash
/verify authentication flow
/verify user profile feature
/verify --scope=backend database migrations
```

---

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

---

## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Context Gathering** | Git diff, commit history | Changes summary |
| **2. Parallel Agent Dispatch** | 5 agents evaluate | 0-10 scores |
| **3. Test Execution** | Backend + frontend tests | Coverage data |
| **4. Nuanced Grading** | Composite score calculation | Grade (A-F) |
| **5. Improvement Suggestions** | Effort vs impact analysis | Prioritized list |
| **6. Alternative Comparison** | Compare approaches (optional) | Recommendation |
| **7. Metrics Tracking** | Trend analysis | Historical data |
| **8. Report Compilation** | Evidence artifacts | Final report |

---

## Phase 1: Context Gathering

```bash
# PARALLEL - Run in ONE message
git diff main --stat
git log main..HEAD --oneline
git diff main --name-only | sort -u
```

---

## Phase 2: Parallel Agent Dispatch (5 Agents)

Launch ALL agents in ONE message with `run_in_background=True`.

| Agent | Focus | Output |
|-------|-------|--------|
| code-quality-reviewer | Lint, types, patterns | Quality 0-10 |
| security-auditor | OWASP, secrets, CVEs | Security 0-10 |
| test-generator | Coverage, test quality | Coverage 0-10 |
| backend-system-architect | API design, async | API 0-10 |
| frontend-ui-developer | React 19, Zod, a11y | UI 0-10 |

See [Grading Rubric](references/grading-rubric.md) for detailed scoring criteria.

---

## Phase 3: Parallel Test Execution

```bash
# PARALLEL - Backend and frontend
cd backend && poetry run pytest tests/ -v --cov=app --cov-report=json
cd frontend && npm run test -- --coverage
```

---

## Phase 4: Nuanced Grading

See [Grading Rubric](references/grading-rubric.md) for full scoring details.

**Weights:**
| Dimension | Weight |
|-----------|--------|
| Code Quality | 20% |
| Security | 25% |
| Test Coverage | 20% |
| API Compliance | 20% |
| UI Compliance | 15% |

**Grade Interpretation:**

| Score | Grade | Action |
|-------|-------|--------|
| 9.0-10.0 | A+ | Ship it! |
| 8.0-8.9 | A | Ready for merge |
| 7.0-7.9 | B | Minor improvements optional |
| 6.0-6.9 | C | Consider improvements |
| 5.0-5.9 | D | Improvements recommended |
| 0.0-4.9 | F | Do not merge |

---

## Phase 5: Improvement Suggestions

Each suggestion includes effort (1-5) and impact (1-5) with priority = impact/effort.

| Points | Effort | Impact |
|--------|--------|--------|
| 1 | < 15 min | Minimal |
| 2 | 15-60 min | Low |
| 3 | 1-4 hrs | Medium |
| 4 | 4-8 hrs | High |
| 5 | 1+ days | Critical |

**Quick Wins:** Effort <= 2 AND Impact >= 4

---

## Phase 6: Alternative Comparison (Optional)

See [Alternative Comparison](references/alternative-comparison.md) for template.

Use when:
- Multiple valid approaches exist
- User asked "is this the best way?"
- Major architectural decisions made

---

## Phase 7: Metrics Tracking

```python
mcp__memory__create_entities(entities=[{
  "name": "verification-{date}-{feature}",
  "entityType": "VerificationMetrics",
  "observations": [f"composite_score: {score}", ...]
}])
```

Query trends: `mcp__memory__search_nodes(query="VerificationMetrics")`

---

## Phase 8: Report Compilation

See [Report Template](references/report-template.md) for full format.

```markdown
# Feature Verification Report

**Composite Score: [N.N]/10** (Grade: [LETTER])

## Top Improvement Suggestions
| # | Suggestion | Effort | Impact | Priority |
|---|------------|--------|--------|----------|
| 1 | [highest] | [N] | [N] | [N.N] |

## Verdict
**[READY FOR MERGE | IMPROVEMENTS RECOMMENDED | BLOCKED]**
```

---

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

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scoring scale | 0-10 with decimals | Nuanced, not binary |
| Improvement priority | Impact / Effort ratio | Do high-value first |
| Alternative comparison | Optional phase | Only when multiple valid approaches |
| Metrics persistence | Memory MCP | Track trends over time |

---

## Related Skills

- `implement` - Full implementation with verification
- `review-pr` - PR-specific verification
- `run-tests` - Detailed test execution
- `quality-gates` - Quality gate patterns

---

**Version:** 3.0.0 (January 2026)
