---
description: "Comprehensive verification with parallel test agents. Use when verifying implementations or validating changes."
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes]
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

Choose **Agent Teams** (mesh — verifiers share findings) or **Task tool** (star — all report to lead) based on the orchestration mode reference.


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


## Workflow Overview

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


## Phase 1: Context Gathering

```bash
# PARALLEL - Run in ONE message
git diff main --stat
git log main..HEAD --oneline
git diff main --name-only | sort -u
```


## Phase 2: Parallel Agent Dispatch (6 Agents)

Launch ALL agents in ONE message with `run_in_background=True` and `max_turns=25`.

| Agent | Focus | Output |
|-------|-------|--------|
| code-quality-reviewer | Lint, types, patterns | Quality 0-10 |
| security-auditor | OWASP, secrets, CVEs | Security 0-10 |
| test-generator | Coverage, test quality | Coverage 0-10 |
| backend-system-architect | API design, async | API 0-10 |
| frontend-ui-developer | React 19, Zod, a11y | UI 0-10 |
| python-performance-engineer | Latency, resources, scaling | Performance 0-10 |

Use `python-performance-engineer` for backend-focused verification or `frontend-performance-engineer` for frontend-focused verification. See [Quality Model](references/quality-model.md) for Performance (0.12) and Scalability (0.10) weights.

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

# Conditional 6th agent — use python-performance-engineer for backend,
# frontend-performance-engineer for frontend
Task(subagent_type="python-performance-engineer", name="perf-verifier",
     team_name="verify-{feature}",
     prompt="""Verify performance and scalability for {feature}. Score 0-10.
     Assess latency, resource usage, caching, and scaling patterns.
     When security-verifier flags resource-intensive endpoints, profile them.
     Share performance findings with api-verifier and quality-verifier.""")
```

**Team teardown** after report compilation:
```python
# After composite grading and report generation
SendMessage(type="shutdown_request", recipient="quality-verifier", content="Verification complete")
SendMessage(type="shutdown_request", recipient="security-verifier", content="Verification complete")
SendMessage(type="shutdown_request", recipient="test-verifier", content="Verification complete")
SendMessage(type="shutdown_request", recipient="api-verifier", content="Verification complete")
SendMessage(type="shutdown_request", recipient="ui-verifier", content="Verification complete")
SendMessage(type="shutdown_request", recipient="perf-verifier", content="Verification complete")
TeamDelete()
```

> **Fallback:** If team formation fails, use standard Phase 2 Task spawns above.

> **Manual cleanup:** If `TeamDelete()` doesn't terminate all agents, press `Ctrl+F` twice to force-kill remaining background agents.


## Phase 3: Parallel Test Execution

```bash
# PARALLEL - Backend and frontend
cd backend && poetry run pytest tests/ -v --cov=app --cov-report=json
cd frontend && npm run test -- --coverage
```


## Phase 4: Nuanced Grading

See [Quality Model](references/quality-model.md) for scoring dimensions, weights, and grade interpretation. See [Grading Rubric](references/grading-rubric.md) for detailed per-agent scoring criteria.


## Phase 5: Improvement Suggestions

Each suggestion includes effort (1-5) and impact (1-5) with priority = impact/effort. See [Quality Model](references/quality-model.md) for scale definitions and quick wins formula.


## Phase 6: Alternative Comparison (Optional)

See [Alternative Comparison](references/alternative-comparison.md) for template.

Use when:
- Multiple valid approaches exist
- User asked "is this the best way?"
- Major architectural decisions made


## Phase 7: Metrics Tracking

```python
mcp__memory__create_entities(entities=[{
  "name": "verification-{date}-{feature}",
  "entityType": "VerificationMetrics",
  "observations": [f"composite_score: {score}", ...]
}])
```

Query trends: `mcp__memory__search_nodes(query="VerificationMetrics")`


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


## Phase 8.5: Post-Verification Feedback (metrics-architect)

After report compilation, send scores to `metrics-architect` for KPI baseline tracking and trend analysis:

```python
Task(subagent_type="metrics-architect", run_in_background=True, max_turns=15,
     prompt=f"""Receive verification scores for {feature}:

Composite: {composite_score}/10 (Grade: {grade})
Dimensional breakdown:
- Correctness: {scores['correctness']}/10
- Maintainability: {scores['maintainability']}/10
- Performance: {scores['performance']}/10
- Security: {scores['security']}/10
- Scalability: {scores['scalability']}/10
- Testability: {scores['testability']}/10
- Compliance: {scores['compliance']}/10

Update KPI baselines with these scores. Store trend data in memory
for historical comparison. Flag any dimensions that dropped below
their historical average.""")
```


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


## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scoring scale | 0-10 with decimals | Nuanced, not binary |
| Improvement priority | Impact / Effort ratio | Do high-value first |
| Alternative comparison | Optional phase | Only when multiple valid approaches |
| Metrics persistence | Memory MCP | Track trends over time |


## Related Skills

- `ork:implement` - Full implementation with verification
- `ork:review-pr` - PR-specific verification
- `run-tests` - Detailed test execution
- `ork:quality-gates` - Quality gate patterns


**Version:** 3.1.0 (February 2026)
