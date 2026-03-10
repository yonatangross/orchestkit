---
name: verify
license: MIT
compatibility: "Claude Code 2.1.72+. Requires memory MCP server."
description: "Comprehensive verification with parallel test agents. Use when verifying implementations or validating changes."
argument-hint: "[feature-or-scope]"
context: fork
version: 4.0.0
author: OrchestKit
tags: [verification, testing, quality, validation, parallel-agents, grading]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, TaskOutput, TaskStop, mcp__memory__search_nodes, mcp__agentation__agentation_get_all_pending, mcp__agentation__agentation_acknowledge, mcp__agentation__agentation_resolve, mcp__agentation__agentation_watch_annotations, ToolSearch, CronCreate, CronDelete]
skills: [code-review-playbook, testing-unit, testing-e2e, testing-llm, testing-integration, testing-perf, memory, quality-gates, chain-patterns, browser-tools]
complexity: high
hooks:
  PreToolUse:
    - matcher: "Bash"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/test-framework-detector"
      once: true
    - matcher: "Agent"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/verify-scoring-rubric-loader"
      once: true
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

## Argument Resolution

```python
SCOPE = "$ARGUMENTS"       # Full argument string, e.g., "authentication flow"
SCOPE_TOKEN = "$ARGUMENTS[0]"  # First token for flag detection (e.g., "--scope=backend")
# $ARGUMENTS[0], $ARGUMENTS[1] etc. for indexed access (CC 2.1.59)
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
      {"label": "Full verification (Recommended)", "description": "All tests + security + code quality + visual + grades", "markdown": "```\nFull Verification (10 phases)\n─────────────────────────────\n  7 parallel agents:\n  ┌────────────┐ ┌────────────┐\n  │ Code       │ │ Security   │\n  │ Quality    │ │ Auditor    │\n  ├────────────┤ ├────────────┤\n  │ Test       │ │ Backend    │\n  │ Generator  │ │ Architect  │\n  ├────────────┤ ├────────────┤\n  │ Frontend   │ │ Performance│\n  │ Developer  │ │ Engineer   │\n  ├────────────┤ └────────────┘\n  │ Visual     │\n  │ Capture    │ → gallery.html\n  └────────────┘\n         ▼\n    Composite Score (0-10)\n    8 dimensions + Grade\n    + Visual Gallery\n```"},
      {"label": "Tests only", "description": "Run unit + integration + e2e tests", "markdown": "```\nTests Only\n──────────\n  npm test ──▶ Results\n  ┌─────────────────────┐\n  │ Unit tests     ✓/✗  │\n  │ Integration    ✓/✗  │\n  │ E2E            ✓/✗  │\n  │ Coverage       NN%  │\n  └─────────────────────┘\n  Skip: security, quality, UI\n  Output: Pass/fail + coverage\n```"},
      {"label": "Security audit", "description": "Focus on security vulnerabilities", "markdown": "```\nSecurity Audit\n──────────────\n  security-auditor agent:\n  ┌─────────────────────────┐\n  │ OWASP Top 10       ✓/✗ │\n  │ Dependency CVEs    ✓/✗ │\n  │ Secrets scan       ✓/✗ │\n  │ Auth flow review   ✓/✗ │\n  │ Input validation   ✓/✗ │\n  └─────────────────────────┘\n  Output: Security score 0-10\n          + vulnerability list\n```"},
      {"label": "Code quality", "description": "Lint, types, complexity analysis", "markdown": "```\nCode Quality\n────────────\n  code-quality-reviewer agent:\n  ┌─────────────────────────┐\n  │ Lint errors         N   │\n  │ Type coverage       NN% │\n  │ Cyclomatic complex  N.N │\n  │ Dead code           N   │\n  │ Pattern violations  N   │\n  └─────────────────────────┘\n  Output: Quality score 0-10\n          + refactor suggestions\n```"},
      {"label": "Quick check", "description": "Just run tests, skip detailed analysis", "markdown": "```\nQuick Check (~1 min)\n────────────────────\n  Run tests ──▶ Pass/Fail\n\n  Output:\n  ├── Test results\n  ├── Build status\n  └── Lint status\n  No agents, no grading,\n  no report generation\n```"}
    ],
    "multiSelect": true
  }]
)
```

**Based on answer, adjust workflow:**
- **Full verification**: All 10 phases (8 + 2.5 + 8.5), 7 parallel agents including visual capture
- **Tests only**: Skip phases 2 (security), 5 (UI/UX analysis)
- **Security audit**: Focus on security-auditor agent
- **Code quality**: Focus on code-quality-reviewer agent
- **Quick check**: Run tests only, skip grading and suggestions

---

## STEP 0b: Select Orchestration Mode

Load details: `Read("${CLAUDE_SKILL_DIR}/references/orchestration-mode.md")` for env var check logic, Agent Teams vs Task Tool comparison, and mode selection rules.

Choose **Agent Teams** (mesh -- verifiers share findings) or **Task tool** (star -- all report to lead) based on the orchestration mode reference.

---

### MCP Probe + Resume

```python
ToolSearch(query="select:mcp__memory__search_nodes")
Write(".claude/chain/capabilities.json", { memory, timestamp })

Read(".claude/chain/state.json")  # resume if exists
```

### Handoff File

After verification completes, write results:

```python
Write(".claude/chain/verify-results.json", JSON.stringify({
  "phase": "verify", "skill": "verify",
  "timestamp": now(), "status": "completed",
  "outputs": {
    "tests_passed": N, "tests_failed": N,
    "coverage": "87%", "security_scan": "clean"
  }
}))
```

### Regression Monitor (CC 2.1.71)

Optionally schedule post-verification monitoring:

```python
# Guard: Skip cron in headless/CI (CLAUDE_CODE_DISABLE_CRON)
# if env CLAUDE_CODE_DISABLE_CRON is set, run a single check instead
CronCreate(
  schedule="0 8 * * *",
  prompt="Daily regression check: npm test.
    If 7 consecutive passes → CronDelete.
    If failures → alert with details."
)
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

## 8-Phase Workflow

Load details: `Read("${CLAUDE_SKILL_DIR}/references/verification-phases.md")` for complete phase details, agent spawn definitions, Agent Teams alternative, and team teardown.

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

### Phase 2.5: Visual Capture (NEW — runs in parallel with Phase 2)

Load details: `Read("${CLAUDE_SKILL_DIR}/references/visual-capture.md")` for auto-detection, route discovery, screenshot capture, and AI vision evaluation.

**Summary**: Auto-detects project framework, starts dev server, discovers routes, uses agent-browser to screenshot each route, evaluates with Claude vision, generates self-contained `gallery.html` with base64-embedded images.

**Output**: `verification-output/{timestamp}/gallery.html` — open in browser to see all screenshots with AI evaluations, scores, and annotation diffs.

**Graceful degradation**: If no frontend detected or server won't start, skips visual capture with a warning — never blocks verification.

### Phase 8.5: Agentation Visual Feedback (opt-in)

Load details: `Read("${CLAUDE_SKILL_DIR}/references/visual-capture.md")` (Phase 8.5 section) for agentation loop workflow.

**Trigger**: Only when agentation MCP is configured. Offers user the choice to annotate the live UI. `ui-feedback` agent processes annotations, re-screenshots show before/after.

---

## Grading & Scoring

Load details: `Read("${CLAUDE_SKILL_DIR}/rules/scoring-rubric.md")` for composite formula, grade thresholds, verdict criteria, and blocking rules. Load details: `Read("${CLAUDE_SKILL_DIR}/references/quality-model.md")` for dimension weights. Load details: `Read("${CLAUDE_SKILL_DIR}/references/grading-rubric.md")` for per-agent scoring criteria.

---

## Evidence & Test Execution

Load details: `Read("${CLAUDE_SKILL_DIR}/rules/evidence-collection.md")` for git commands, test execution patterns, metrics tracking, and post-verification feedback.

---

## Policy-as-Code

Load details: `Read("${CLAUDE_SKILL_DIR}/references/policy-as-code.md")` for configuration.

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

## Report Format

Load details: `Read("${CLAUDE_SKILL_DIR}/references/report-template.md")` for full format. Summary:

```markdown
# Feature Verification Report

**Composite Score: [N.N]/10** (Grade: [LETTER])

## Verdict
**[READY FOR MERGE | IMPROVEMENTS RECOMMENDED | BLOCKED]**
```

---

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `verification-phases.md` | 8-phase workflow, agent spawn definitions, Agent Teams mode |
| `visual-capture.md` | Phase 2.5 + 8.5: screenshot capture, AI vision, gallery generation, agentation loop |
| `quality-model.md` | Scoring dimensions and weights (8 unified) |
| `grading-rubric.md` | Per-agent scoring criteria |
| `report-template.md` | Full report format with visual evidence section |
| `alternative-comparison.md` | Approach comparison template |
| `orchestration-mode.md` | Agent Teams vs Task Tool |
| `policy-as-code.md` | Verification policy configuration |
| `verification-checklist.md` | Pre-flight checklist |

## Rules

Load on demand with `Read("${CLAUDE_SKILL_DIR}/rules/<file>")`:

| File | Content |
|------|---------|
| `scoring-rubric.md` | Composite scoring, grades, verdicts |
| `evidence-collection.md` | Evidence gathering and test patterns |

---

## Related Skills

- `ork:implement` - Full implementation with verification
- `ork:review-pr` - PR-specific verification
- `testing-unit` / `testing-integration` / `testing-e2e` - Test execution patterns
- `ork:quality-gates` - Quality gate patterns
- `browser-tools` - Browser automation for visual capture

---

**Version:** 4.0.0 (March 2026) — Added visual verification portfolio (Phase 2.5 + 8.5), gallery.html output, AI vision evaluation, agentation feedback loop
