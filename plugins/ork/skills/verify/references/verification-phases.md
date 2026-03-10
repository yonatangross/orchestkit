# Verification Phases — Detailed Workflow

## Phase Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Context Gathering** | Git diff, commit history | Changes summary |
| **2. Parallel Agent Dispatch** | 6 agents evaluate | 0-10 scores |
| **2.5 Visual Capture** | Screenshot routes, AI vision eval | Gallery + visual score |
| **3. Test Execution** | Backend + frontend tests | Coverage data |
| **4. Nuanced Grading** | Composite score calculation | Grade (A-F) |
| **5. Improvement Suggestions** | Effort vs impact analysis | Prioritized list |
| **6. Alternative Comparison** | Compare approaches (optional) | Recommendation |
| **7. Metrics Tracking** | Trend analysis | Historical data |
| **8. Report Compilation** | Evidence artifacts + gallery.html | Final report |
| **8.5 Agentation Loop** | User annotates, ui-feedback fixes | Before/after diffs |

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

Use `python-performance-engineer` for backend-focused verification or `frontend-performance-engineer` for frontend-focused verification. See [Quality Model](quality-model.md) for Performance (0.11) and Scalability (0.09) weights.

See [Grading Rubric](grading-rubric.md) for detailed scoring criteria.

### Task Tool Mode (Default)

```python
# PARALLEL — All 6 in ONE message
Agent(
  subagent_type="code-quality-reviewer",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  Verify code quality. Score 0-10.
  Check: lint errors, type coverage, cyclomatic complexity, DRY, SOLID.
  Budget: 15 tool calls max.
  Return: score (0-10), reasoning, evidence, 2-3 improvement suggestions.
  Feature: {feature}. Scope: ONLY review files in {scope_files}.""",
  run_in_background=True, max_turns=25
)
Agent(
  subagent_type="security-auditor",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  Security verification. Score 0-10.
  Check: OWASP Top 10, secrets in code, dependency CVEs, auth patterns.
  Budget: 15 tool calls max.
  Return: score (0-10), vulnerabilities found, severity ratings.
  Feature: {feature}. Scope: ONLY review files in {scope_files}.""",
  run_in_background=True, max_turns=25
)
Agent(
  subagent_type="test-generator",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  Verify test coverage. Score 0-10.
  Check: test existence, type matching, quality, edge cases, coverage %.
  Run existing tests and report results.
  Budget: 15 tool calls max.
  Return: score (0-10), coverage %, gaps identified.
  Feature: {feature}. Scope: ONLY review files in {scope_files}.""",
  run_in_background=True, max_turns=25
)
Agent(
  subagent_type="backend-system-architect",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  Verify API design and backend patterns. Score 0-10.
  Check: REST conventions, async patterns, transaction boundaries, error handling.
  Budget: 15 tool calls max.
  Return: score (0-10), pattern compliance, issues found.
  Feature: {feature}. Scope: ONLY review files in {scope_files}.""",
  run_in_background=True, max_turns=25
)
Agent(
  subagent_type="frontend-ui-developer",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  Verify frontend implementation. Score 0-10.
  Check: React 19 patterns, Zod schemas, accessibility (WCAG 2.1 AA), loading states.
  Budget: 15 tool calls max.
  Return: score (0-10), pattern compliance, a11y issues.
  Feature: {feature}. Scope: ONLY review files in {scope_files}.""",
  run_in_background=True, max_turns=25
)
Agent(
  subagent_type="python-performance-engineer",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  Verify performance and scalability. Score 0-10.
  Check: latency hotspots, N+1 queries, resource usage, caching, scaling patterns.
  Budget: 15 tool calls max.
  Return: score (0-10), bottlenecks found, optimization suggestions.
  Feature: {feature}. Scope: ONLY review files in {scope_files}.""",
  run_in_background=True, max_turns=25
)
```

### Agent Teams Alternative

In Agent Teams mode, form a verification team where agents share findings and coordinate scoring:

```python
TeamCreate(team_name="verify-{feature}", description="Verify {feature}")

Agent(subagent_type="code-quality-reviewer", name="quality-verifier",
     team_name="verify-{feature}",
     prompt="""# Cache-optimized: stable content first (CC 2.1.72)
     Verify code quality. Score 0-10.
     When you find patterns that affect security, message security-verifier.
     When you find untested code paths, message test-verifier.
     Share your quality score with all teammates for composite calculation.
     Feature: {feature}.""")

Agent(subagent_type="security-auditor", name="security-verifier",
     team_name="verify-{feature}",
     prompt="""# Cache-optimized: stable content first (CC 2.1.72)
     Security verification. Score 0-10.
     When quality-verifier flags security-relevant patterns, investigate deeper.
     When you find vulnerabilities in API endpoints, message api-verifier.
     Share severity findings with test-verifier for test gap analysis.
     Feature: {feature}.""")

Agent(subagent_type="test-generator", name="test-verifier",
     team_name="verify-{feature}",
     prompt="""# Cache-optimized: stable content first (CC 2.1.72)
     Verify test coverage. Score 0-10.
     When quality-verifier or security-verifier flag untested paths, quantify the gap.
     Run existing tests and report coverage metrics.
     Message the lead with coverage data for composite scoring.
     Feature: {feature}.""")

Agent(subagent_type="backend-system-architect", name="api-verifier",
     team_name="verify-{feature}",
     prompt="""# Cache-optimized: stable content first (CC 2.1.72)
     Verify API design and backend patterns. Score 0-10.
     When security-verifier flags endpoint issues, validate and score.
     Share API compliance findings with ui-verifier for consistency check.
     Feature: {feature}.""")

Agent(subagent_type="frontend-ui-developer", name="ui-verifier",
     team_name="verify-{feature}",
     prompt="""# Cache-optimized: stable content first (CC 2.1.72)
     Verify frontend implementation. Score 0-10.
     When api-verifier shares API patterns, verify frontend matches.
     Check React 19 patterns, accessibility, and loading states.
     Share findings with quality-verifier for overall assessment.
     Feature: {feature}.""")

# Conditional 6th agent — use python-performance-engineer for backend,
# frontend-performance-engineer for frontend
Agent(subagent_type="python-performance-engineer", name="perf-verifier",
     team_name="verify-{feature}",
     prompt="""# Cache-optimized: stable content first (CC 2.1.72)
     Verify performance and scalability. Score 0-10.
     Assess latency, resource usage, caching, and scaling patterns.
     When security-verifier flags resource-intensive endpoints, profile them.
     Share performance findings with api-verifier and quality-verifier.
     Feature: {feature}.""")
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

## Phase 2.5: Visual Capture (Parallel with Phase 2)

**Runs as a 7th parallel agent** alongside the 6 verification agents. See [Visual Capture](visual-capture.md) for full details.

```python
# Launch IN THE SAME MESSAGE as Phase 2 agents
Agent(
  subagent_type="general-purpose",
  description="Visual capture and AI evaluation",
  prompt="""Visual verification capture for: {feature}
  1. Detect project type from package.json
  2. Start dev server (auto-detect framework)
  3. Discover routes (framework-aware scan)
  4. Use agent-browser to screenshot each route (max 20)
  5. Read each screenshot PNG for AI vision evaluation
  6. Score layout, accessibility, content completeness (0-10 per route)
  7. Read gallery template from ${CLAUDE_SKILL_DIR}/assets/gallery-template.html
  8. Generate gallery.html with base64-embedded screenshots
  9. Write to verification-output/{timestamp}/gallery.html
  10. Kill dev server

  If no frontend detected, write skip notice and exit.
  If server fails to start, write warning and exit.
  Never block — graceful degradation only.""",
  run_in_background=True, max_turns=30
)
```

**Output**: `verification-output/{timestamp}/` folder with screenshots, AI evaluations (JSON), and `gallery.html`.

---

## Phase 8.5: Agentation Visual Feedback (Opt-In)

**Trigger**: Only when agentation MCP is configured in `.mcp.json`. Runs AFTER Phase 8 report compilation.

```python
# Check agentation availability
ToolSearch(query="select:mcp__agentation__agentation_get_all_pending")

# If available, offer user choice
AskUserQuestion(questions=[{
  "question": "Agentation detected. Annotate the live UI before finalizing?",
  "header": "Visual Feedback Loop",
  "options": [
    {"label": "Yes", "description": "I'll mark issues, ui-feedback agent fixes them, gallery updates with before/after"},
    {"label": "Skip", "description": "Finalize with current screenshots"}
  ]
}])

# If yes: watch → acknowledge → dispatch ui-feedback → re-screenshot → update gallery
# Max 3 rounds (configurable in verification-config.yaml)
```

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
