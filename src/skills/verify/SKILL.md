---
name: verify
license: MIT
compatibility: "Claude Code 2.1.59+. Requires memory MCP server."
description: "Comprehensive verification with parallel test agents. Use when verifying implementations or validating changes."
argument-hint: "[feature-or-scope]"
context: fork
version: 3.1.0
author: OrchestKit
tags: [verification, testing, quality, validation, parallel-agents, grading]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, TaskOutput, TaskStop, mcp__memory__search_nodes]
skills: [code-review-playbook, testing-patterns, memory, quality-gates]
complexity: high
hooks:
  PreToolUse:
    - matcher: "Bash"
      command: "${CLAUDE_PLUGIN_ROOT}/src/hooks/bin/run-hook.mjs skill/test-framework-detector"
      once: true
  PostToolUse:
    - matcher: "Bash"
      command: "${CLAUDE_PLUGIN_ROOT}/src/hooks/bin/run-hook.mjs skill/test-result-validator"
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
      {"label": "Full verification (Recommended)", "description": "All tests + security + code quality + grades", "markdown": "```\nFull Verification (8 phases)\n────────────────────────────\n  6 parallel agents:\n  ┌────────────┐ ┌────────────┐\n  │ Code       │ │ Security   │\n  │ Quality    │ │ Auditor    │\n  ├────────────┤ ├────────────┤\n  │ Test       │ │ Backend    │\n  │ Generator  │ │ Architect  │\n  ├────────────┤ ├────────────┤\n  │ Frontend   │ │ Performance│\n  │ Developer  │ │ Engineer   │\n  └────────────┘ └────────────┘\n         ▼              ▼\n    Composite Score (0-10)\n    Grade (A-F) + Verdict\n```"},
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
- **Full verification**: All 8 phases, all 6 parallel agents
- **Tests only**: Skip phases 2 (security), 5 (UI/UX analysis)
- **Security audit**: Focus on security-auditor agent
- **Code quality**: Focus on code-quality-reviewer agent
- **Quick check**: Run tests only, skip grading and suggestions

---

## STEP 0b: Select Orchestration Mode

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/orchestration-mode.md")` for env var check logic, Agent Teams vs Task Tool comparison, and mode selection rules.

Choose **Agent Teams** (mesh -- verifiers share findings) or **Task tool** (star -- all report to lead) based on the orchestration mode reference.

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

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/verification-phases.md")` for complete phase details, agent spawn definitions, Agent Teams alternative, and team teardown.

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

---

## Grading & Scoring

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/rules/scoring-rubric.md")` for composite formula, grade thresholds, verdict criteria, and blocking rules. Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/quality-model.md")` for dimension weights. Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/grading-rubric.md")` for per-agent scoring criteria.

---

## Evidence & Test Execution

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/rules/evidence-collection.md")` for git commands, test execution patterns, metrics tracking, and post-verification feedback.

---

## Policy-as-Code

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/policy-as-code.md")` for configuration.

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

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/report-template.md")` for full format. Summary:

```markdown
# Feature Verification Report

**Composite Score: [N.N]/10** (Grade: [LETTER])

## Verdict
**[READY FOR MERGE | IMPROVEMENTS RECOMMENDED | BLOCKED]**
```

---

## References

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/<file>")`:

| File | Content |
|------|---------|
| `verification-phases.md` | 8-phase workflow, agent spawn definitions, Agent Teams mode |
| `quality-model.md` | Scoring dimensions and weights |
| `grading-rubric.md` | Per-agent scoring criteria |
| `report-template.md` | Full report format |
| `alternative-comparison.md` | Approach comparison template |
| `orchestration-mode.md` | Agent Teams vs Task Tool |
| `policy-as-code.md` | Verification policy configuration |
| `verification-checklist.md` | Pre-flight checklist |

## Rules

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/rules/<file>")`:

| File | Content |
|------|---------|
| `scoring-rubric.md` | Composite scoring, grades, verdicts |
| `evidence-collection.md` | Evidence gathering and test patterns |

---

## Related Skills

- `ork:implement` - Full implementation with verification
- `ork:review-pr` - PR-specific verification
- `run-tests` - Detailed test execution
- `ork:quality-gates` - Quality gate patterns

---

**Version:** 3.1.0 (February 2026)
