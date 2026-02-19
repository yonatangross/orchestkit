---
name: verify
license: MIT
compatibility: "Claude Code 2.1.47+. Requires memory MCP server."
description: "Comprehensive verification with parallel test agents. Use when verifying implementations or validating changes."
argument-hint: "[feature-or-scope]"
context: fork
version: 3.1.0
author: OrchestKit
tags: [verification, testing, quality, validation, parallel-agents, grading]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes]
skills: [code-review-playbook, security-scanning, evidence-verification, run-tests, testing-patterns, memory, quality-gates]
complexity: medium
metadata:
  category: workflow-automation
  mcp-server: memory
---

# Verify Feature

Comprehensive verification using parallel specialized agents with nuanced grading (0-10 scale) and improvement suggestions.

## Quick Start

```bash
/ork:verify authentication flow
/ork:verify user profile feature
/ork:verify --scope=backend database migrations
```

> **Opus 4.6**: Agents use native adaptive thinking (no MCP sequential-thinking needed). Extended 128K output supports comprehensive verification reports.

---

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
- **Full verification**: All 8 phases, all 5 parallel agents
- **Tests only**: Skip phases 2 (security), 5 (UI/UX analysis)
- **Security audit**: Focus on security-auditor agent
- **Code quality**: Focus on code-quality-reviewer agent
- **Quick check**: Run tests only, skip grading and suggestions

---

## STEP 0b: Select Orchestration Mode

Choose **Agent Teams** (mesh — verifiers share findings) or **Task tool** (star — all report to lead):

1. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` → **Agent Teams mode**
2. Agent Teams unavailable → **Task tool mode** (default)
3. Otherwise: Full verification with cross-domain concerns → recommend **Agent Teams**; Single-scope verification → **Task tool**

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Finding correlation | Lead cross-references scores | Agents discuss overlapping concerns |
| Security + test overlap | Independent scoring | security-auditor alerts test-generator about gaps |
| Cost | ~200K tokens | ~500K tokens |
| Best for | Focused verification | Full-stack verification with 5 agents |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining verification.

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

Launch ALL agents in ONE message with `run_in_background=True` and `max_turns=25`.

| Agent | Focus | Output |
|-------|-------|--------|
| code-quality-reviewer | Lint, types, patterns | Quality 0-10 |
| security-auditor | OWASP, secrets, CVEs | Security 0-10 |
| test-generator | Coverage, test quality | Coverage 0-10 |
| backend-system-architect | API design, async | API 0-10 |
| frontend-ui-developer | React 19, Zod, a11y | UI 0-10 |

See [Grading Rubric](references/grading-rubric.md) for detailed scoring criteria.

### Phase 2 — Agent Teams Alternative

In Agent Teams mode, form a verification team where agents share findings and coordinate scoring:

```python
TeamCreate(team_name="verify-{feature}", description="Verify {feature}")

Task(subagent_type="code-quality-reviewer", name="quality-verifier",
     team_name="verify-{feature}",
     prompt="""Verify code quality for {feature}. Score 0-10.
     When you find patterns that affect security, message security-verifier.
     When you find untested code paths, message test-verifier.
     Share your quality score with all teammates for composite calculation.""")

Task(subagent_type="security-auditor", name="security-verifier",
     team_name="verify-{feature}",
     prompt="""Security verification for {feature}. Score 0-10.
     When quality-verifier flags security-relevant patterns, investigate deeper.
     When you find vulnerabilities in API endpoints, message api-verifier.
     Share severity findings with test-verifier for test gap analysis.""")

Task(subagent_type="test-generator", name="test-verifier",
     team_name="verify-{feature}",
     prompt="""Verify test coverage for {feature}. Score 0-10.
     When quality-verifier or security-verifier flag untested paths, quantify the gap.
     Run existing tests and report coverage metrics.
     Message the lead with coverage data for composite scoring.""")

Task(subagent_type="backend-system-architect", name="api-verifier",
     team_name="verify-{feature}",
     prompt="""Verify API design and backend patterns for {feature}. Score 0-10.
     When security-verifier flags endpoint issues, validate and score.
     Share API compliance findings with ui-verifier for consistency check.""")

Task(subagent_type="frontend-ui-developer", name="ui-verifier",
     team_name="verify-{feature}",
     prompt="""Verify frontend implementation for {feature}. Score 0-10.
     When api-verifier shares API patterns, verify frontend matches.
     Check React 19 patterns, accessibility, and loading states.
     Share findings with quality-verifier for overall assessment.""")
```

**Team teardown** after report compilation:
```python
# After composite grading and report generation
SendMessage(type="shutdown_request", recipient="quality-verifier", content="Verification complete")
SendMessage(type="shutdown_request", recipient="security-verifier", content="Verification complete")
SendMessage(type="shutdown_request", recipient="test-verifier", content="Verification complete")
SendMessage(type="shutdown_request", recipient="api-verifier", content="Verification complete")
SendMessage(type="shutdown_request", recipient="ui-verifier", content="Verification complete")
TeamDelete()
```

> **Fallback:** If team formation fails, use standard Phase 2 Task spawns above.

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

- `ork:implement` - Full implementation with verification
- `ork:review-pr` - PR-specific verification
- `run-tests` - Detailed test execution
- `ork:quality-gates` - Quality gate patterns

---

**Version:** 3.0.0 (January 2026)
