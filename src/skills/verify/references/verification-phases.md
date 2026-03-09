# Verification Phases — Detailed Workflow

## Phase Overview

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

---

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

Use `python-performance-engineer` for backend-focused verification or `frontend-performance-engineer` for frontend-focused verification. See [Quality Model](quality-model.md) for Performance (0.12) and Scalability (0.10) weights.

See [Grading Rubric](grading-rubric.md) for detailed scoring criteria.

### Task Tool Mode (Default)

```python
# PARALLEL — All 6 in ONE message
Agent(
  subagent_type="code-quality-reviewer",
  prompt="""Verify code quality for: {feature}. Score 0-10.
  Check: lint errors, type coverage, cyclomatic complexity, DRY, SOLID.
  Scope: ONLY review files in {scope_files}. Budget: 15 tool calls max.
  Return: score (0-10), reasoning, evidence, 2-3 improvement suggestions.""",
  run_in_background=True, max_turns=25
)
Agent(
  subagent_type="security-auditor",
  prompt="""Security verification for: {feature}. Score 0-10.
  Check: OWASP Top 10, secrets in code, dependency CVEs, auth patterns.
  Scope: ONLY review files in {scope_files}. Budget: 15 tool calls max.
  Return: score (0-10), vulnerabilities found, severity ratings.""",
  run_in_background=True, max_turns=25
)
Agent(
  subagent_type="test-generator",
  prompt="""Verify test coverage for: {feature}. Score 0-10.
  Check: test existence, type matching, quality, edge cases, coverage %.
  Run existing tests and report results.
  Scope: ONLY review files in {scope_files}. Budget: 15 tool calls max.
  Return: score (0-10), coverage %, gaps identified.""",
  run_in_background=True, max_turns=25
)
Agent(
  subagent_type="backend-system-architect",
  prompt="""Verify API design and backend patterns for: {feature}. Score 0-10.
  Check: REST conventions, async patterns, transaction boundaries, error handling.
  Scope: ONLY review files in {scope_files}. Budget: 15 tool calls max.
  Return: score (0-10), pattern compliance, issues found.""",
  run_in_background=True, max_turns=25
)
Agent(
  subagent_type="frontend-ui-developer",
  prompt="""Verify frontend implementation for: {feature}. Score 0-10.
  Check: React 19 patterns, Zod schemas, accessibility (WCAG 2.1 AA), loading states.
  Scope: ONLY review files in {scope_files}. Budget: 15 tool calls max.
  Return: score (0-10), pattern compliance, a11y issues.""",
  run_in_background=True, max_turns=25
)
Agent(
  subagent_type="python-performance-engineer",
  prompt="""Verify performance and scalability for: {feature}. Score 0-10.
  Check: latency hotspots, N+1 queries, resource usage, caching, scaling patterns.
  Scope: ONLY review files in {scope_files}. Budget: 15 tool calls max.
  Return: score (0-10), bottlenecks found, optimization suggestions.""",
  run_in_background=True, max_turns=25
)
```

### Agent Teams Alternative

In Agent Teams mode, form a verification team where agents share findings and coordinate scoring:

```python
TeamCreate(team_name="verify-{feature}", description="Verify {feature}")

Agent(subagent_type="code-quality-reviewer", name="quality-verifier",
     team_name="verify-{feature}",
     prompt="""Verify code quality for {feature}. Score 0-10.
     When you find patterns that affect security, message security-verifier.
     When you find untested code paths, message test-verifier.
     Share your quality score with all teammates for composite calculation.""")

Agent(subagent_type="security-auditor", name="security-verifier",
     team_name="verify-{feature}",
     prompt="""Security verification for {feature}. Score 0-10.
     When quality-verifier flags security-relevant patterns, investigate deeper.
     When you find vulnerabilities in API endpoints, message api-verifier.
     Share severity findings with test-verifier for test gap analysis.""")

Agent(subagent_type="test-generator", name="test-verifier",
     team_name="verify-{feature}",
     prompt="""Verify test coverage for {feature}. Score 0-10.
     When quality-verifier or security-verifier flag untested paths, quantify the gap.
     Run existing tests and report coverage metrics.
     Message the lead with coverage data for composite scoring.""")

Agent(subagent_type="backend-system-architect", name="api-verifier",
     team_name="verify-{feature}",
     prompt="""Verify API design and backend patterns for {feature}. Score 0-10.
     When security-verifier flags endpoint issues, validate and score.
     Share API compliance findings with ui-verifier for consistency check.""")

Agent(subagent_type="frontend-ui-developer", name="ui-verifier",
     team_name="verify-{feature}",
     prompt="""Verify frontend implementation for {feature}. Score 0-10.
     When api-verifier shares API patterns, verify frontend matches.
     Check React 19 patterns, accessibility, and loading states.
     Share findings with quality-verifier for overall assessment.""")

# Conditional 6th agent — use python-performance-engineer for backend,
# frontend-performance-engineer for frontend
Agent(subagent_type="python-performance-engineer", name="perf-verifier",
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

---

## Phase 4: Nuanced Grading

See [Quality Model](quality-model.md) for scoring dimensions, weights, and grade interpretation. See [Grading Rubric](grading-rubric.md) for detailed per-agent scoring criteria.

---

## Phase 5: Improvement Suggestions

Each suggestion includes effort (1-5) and impact (1-5) with priority = impact/effort. See [Quality Model](quality-model.md) for scale definitions and quick wins formula.

---

## Phase 6: Alternative Comparison (Optional)

See [Alternative Comparison](alternative-comparison.md) for template.

Use when:
- Multiple valid approaches exist
- User asked "is this the best way?"
- Major architectural decisions made

---

## Phase 8: Report Compilation

See [Report Template](report-template.md) for full format.

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
