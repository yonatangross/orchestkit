---
name: plan-viz
license: MIT
compatibility: "Claude Code 2.1.34+."
description: "Visualize planned changes before implementation. Use when reviewing plans, comparing before/after architecture, assessing risk, or analyzing execution order and impact."
argument-hint: "[plan-or-issue]"
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
tags: [visualization, planning, before-after, architecture, diff, risk, impact, migration]
user-invocable: true
allowed-tools: [Read, Grep, Glob, Task, AskUserQuestion, Bash, Write]
skills: [ascii-visualizer, explore, architecture-decision-record, assess-complexity]
complexity: medium
metadata:
  category: document-asset-creation
---

# Plan Visualization

Render planned changes as structured ASCII visualizations with risk analysis, execution order, and impact metrics. Every section answers a specific reviewer question.

**Core principle:** Encode judgment into visualization, not decoration.

```bash
/plan-viz                          # Auto-detect from current branch
/plan-viz billing module redesign  # Describe the plan
/plan-viz #234                     # Pull from GitHub issue
```

---

## STEP 0: Detect or Clarify Plan Context

**First**, attempt auto-detection by running `scripts/detect-plan-context.sh`:

```bash
bash "$SKILL_DIR/scripts/detect-plan-context.sh"
```

This outputs branch name, issue number (if any), commit count, and file change summary.

**If auto-detection finds a clear plan** (branch with commits diverging from main, or issue number in args), proceed to Step 1.

**If ambiguous**, clarify with AskUserQuestion:

```python
AskUserQuestion(
  questions=[{
    "question": "What should I visualize?",
    "header": "Source",
    "options": [
      {"label": "Current branch changes (Recommended)", "description": "Auto-detect from git diff against main"},
      {"label": "Describe the plan", "description": "I'll explain what I'm planning to change"},
      {"label": "GitHub issue", "description": "Pull plan from a specific issue number"},
      {"label": "Quick file diff only", "description": "Just show the change manifest, skip analysis"}
    ],
    "multiSelect": false
  }]
)
```

---

## STEP 1: Gather Data

Run `scripts/analyze-impact.sh` for precise counts:

```bash
bash "$SKILL_DIR/scripts/analyze-impact.sh"
```

This produces: files by action (add/modify/delete), line counts, test files affected, and dependency changes.

For architecture-level understanding, spawn an Explore agent on the affected directories:

```python
Task(
  subagent_type="Explore",
  prompt="Explore the architecture of {affected_directories}. Return: component diagram, key data flows, health scores per module. Use the ascii-visualizer skill for diagrams.",
  model="haiku"
)
```

---

## STEP 2: Render Tier 1 Header (Always)

Use `assets/tier1-header.md` template. Fill in from gathered data. This is always shown first.

```
PLAN: {plan_name} ({issue_ref})  |  {phase_count} phases  |  {file_count} files  |  +{added} -{removed} lines
Risk: {risk_level}  |  Confidence: {confidence}  |  Reversible until {last_safe_phase}
Branch: {branch} -> {base_branch}

[1] Changes  [2] Execution  [3] Risks  [4] Decisions  [5] Impact  [all]
```

**Risk level** = highest risk across all phases (LOW/MEDIUM/HIGH/CRITICAL).
**Confidence** = LOW if >50% of changes are in untested code, MEDIUM if mixed, HIGH if well-tested paths.
**Reversible until** = last phase before an irreversible operation (DROP, DELETE data, breaking API change).

---

## STEP 3: Ask Which Sections to Expand

```python
AskUserQuestion(
  questions=[{
    "question": "Which sections to render?",
    "header": "Sections",
    "options": [
      {"label": "All sections", "description": "Full visualization with all 5 core sections"},
      {"label": "Changes + Execution", "description": "File diff tree and execution swimlane"},
      {"label": "Risks + Decisions", "description": "Risk dashboard and decision log"},
      {"label": "Impact only", "description": "Just the numbers: files, lines, tests, API surface"}
    ],
    "multiSelect": false
  }]
)
```

---

## STEP 4: Render Requested Sections

### Section [1]: Change Manifest

Use `references/change-manifest-patterns.md`. Render a Terraform-style annotated file tree:

```
src/
├── api/
│   ├── routes.py          [M] +45 -12    !! high-traffic path
│   └── schemas.py         [M] +20 -5
├── services/
│   └── billing.py         [A] +180       ** new file
├── models/
│   └── invoice.py         [A] +95        ** new file
└── tests/
    └── test_billing.py    [A] +120       ** new file

Legend: [A]dd [M]odify [D]elete  !! Risk  ** New
Summary: +460 -17  |  3 new  |  2 modified  |  0 deleted
```

**Rules:**
- Use `[A]`/`[M]`/`[D]` prefix symbols (Terraform convention)
- Show `+N -N` line counts per file
- Flag high-risk files with `!!` and annotation
- Mark new files with `**`
- Always end with a summary line

### Section [2]: Execution Swimlane

Use `references/execution-swimlane-patterns.md`. Show phases as horizontal lanes with dependency lines:

```
Backend  ===[Schema]======[API]===========================[Deploy]====>
                |            |                                ^
                |            +------blocks------+             |
                |                               |             |
Frontend ------[Wait]--------[Components]=======[Integration]=+
                                                      |
Tests    ------[Wait]--------[Wait]-----------[E2E Tests]========>

=== Active work   --- Blocked/waiting   | Dependency
Critical path: Schema -> API -> Deploy (estimated: 4-6 hours)
```

**Rules:**
- `===` for active work, `---` for blocked/waiting
- Vertical `|` for dependencies with `blocks` annotations
- Identify and label the critical path
- Show parallel opportunities explicitly

### Section [3]: Risk Dashboard

Use `references/risk-dashboard-patterns.md`. Two parts: reversibility timeline + pre-mortem.

**Part A: Reversibility Timeline**
```
REVERSIBILITY TIMELINE
Phase 1  [================]  FULLY REVERSIBLE    (add column, nullable)
Phase 2  [================]  FULLY REVERSIBLE    (new endpoint, additive)
Phase 3  [============....] PARTIALLY           (backfill data)
              --- POINT OF NO RETURN ---
Phase 4  [........????????]  IRREVERSIBLE        (drop old column)
Phase 5  [================]  FULLY REVERSIBLE    (frontend toggle)
```

**Part B: Pre-Mortem (3 scenarios)**
```
PRE-MORTEM: This plan failed because...

1. {scenario_description}
   Probability: {level} | Impact: {level}
   Mitigation: {action}
   Rollback: {steps} ({time_estimate})

2. ...
3. ...
```

**Rules:**
- Always identify the point of no return
- Generate exactly 3 pre-mortem scenarios (most likely, most severe, most subtle)
- Each scenario needs a concrete mitigation, not generic advice

### Section [4]: Decision Log

Use `references/decision-log-patterns.md`. ADR-lite format for each non-obvious choice:

```
DECISION LOG

#1: {decision_title}
    Context:      {why this decision exists}
    Decision:     {what was chosen}
    Alternatives: {what was rejected and why}
    Tradeoff:     + {gain}  - {cost}

#2: ...
```

**Rules:**
- Only document non-obvious decisions (skip "we need a database table for invoices")
- Always show at least one rejected alternative
- Tradeoffs must be honest — show the cost, not just the benefit

### Section [5]: Impact Summary

Use `assets/impact-dashboard.md` template:

```
IMPACT SUMMARY
+=========+==========+===========+
| Category | Files   | Lines     |
+=========+==========+===========+
| Added    |    3    |    +395   |
| Modified |    2    |  +65 -17  |
| Deleted  |    0    |      0    |
+---------+----------+-----------+
| NET      |    5    |    +443   |
+---------+----------+-----------+

Tests:    2 new  |  1 modified  |  Coverage: 73% -> 68% (needs +4 tests)
API:      2 new endpoints  |  0 breaking changes
Deps:     +1 (stripe-python)  |  0 removed
```

---

## STEP 5: Offer Actions

After rendering, offer next steps:

```python
AskUserQuestion(
  questions=[{
    "question": "What next?",
    "header": "Actions",
    "options": [
      {"label": "Write to designs/", "description": "Save as designs/{branch}.md for PR review"},
      {"label": "Generate GitHub issues", "description": "Create issues from execution phases with labels and milestones"},
      {"label": "Drill deeper", "description": "Expand blast radius, cross-layer check, or migration checklist"},
      {"label": "Done", "description": "Plan visualization complete"}
    ],
    "multiSelect": false
  }]
)
```

**Write to file:** Save full report to `designs/{branch-name}.md` using the `assets/plan-report.md` template.

**Generate issues:** For each execution phase, create a GitHub issue with:
- Title: `[{component}] {phase_description}`
- Labels: component label + `risk:{level}`
- Milestone: current milestone if set
- Body: relevant plan sections
- Blocked-by references to dependency issues

---

## DEEP DIVES (Tier 3, on request)

### [6] Blast Radius

Use `references/blast-radius-patterns.md`. Show concentric rings of impact:

```
                    Ring 3: Tests (8 files)
               +-------------------------------+
               |    Ring 2: Transitive (5)      |
               |   +------------------------+   |
               |   |  Ring 1: Direct (3)     |   |
               |   |   +--------------+      |   |
               |   |   | CHANGED FILE |      |   |
               |   |   +--------------+      |   |
               |   +------------------------+   |
               +-------------------------------+

Direct dependents:   auth.py, routes.py, middleware.py
Transitive:          app.py, config.py, utils.py, cli.py, server.py
Test files:          test_auth.py, test_routes.py, ... (+6 more)
```

### [7] Cross-Layer Consistency

Verify frontend/backend alignment:

```
CROSS-LAYER CONSISTENCY
Backend Endpoint          Frontend Consumer     Status
POST /invoices            createInvoice()       PLANNED
GET  /invoices/:id        useInvoice(id)        PLANNED
GET  /invoices            InvoiceList.tsx        MISSING  !!
```

### [8] Migration Checklist

Generate ordered runbook with constraints:

```
MIGRATION CHECKLIST

Sequential Block A (database):
  1. [ ] Backup production database                    [~5 min]
  2. [ ] Run migration: 001_add_invoices.sql           [~30s]   <- blocks #4

Parallel Block B (after #2):
  3. [ ] Deploy API v2.1.0                             [~3 min]
  4. [ ] Update frontend bundle                        [~2 min]

Sequential Block C (verification):
  5. [ ] Smoke test                                    [~2 min]
  6. [ ] Monitor error rate 15 min                     [~15 min]
```

---

## Key Principles

| Principle | Application |
|-----------|-------------|
| **Progressive disclosure** | Tier 1 header always, sections on request |
| **Judgment over decoration** | Every section answers a reviewer question |
| **Precise over estimated** | Use scripts for file/line counts |
| **Honest uncertainty** | Confidence levels, pre-mortems, tradeoff costs |
| **Actionable output** | Write to file, generate issues, drill deeper |
| **Anti-slop** | No generic transitions, no fake precision, no unused sections |

## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| [ascii-diagrams](rules/ascii-diagrams.md) | MEDIUM | Box-drawing characters, file trees, progress bars, workflow diagrams |
| [ascii-architecture](rules/ascii-architecture.md) | MEDIUM | Layered architecture, blast radius, reversibility timelines, comparisons |

## References

- [Change Manifest Patterns](references/change-manifest-patterns.md)
- [Execution Swimlane Patterns](references/execution-swimlane-patterns.md)
- [Risk Dashboard Patterns](references/risk-dashboard-patterns.md)
- [Decision Log Patterns](references/decision-log-patterns.md)
- [Blast Radius Patterns](references/blast-radius-patterns.md)

## Assets

- [Plan Report Template](assets/plan-report.md) — Full mustache-style report
- [Impact Dashboard Template](assets/impact-dashboard.md) — Impact table
- [Tier 1 Header Template](assets/tier1-header.md) — 5-line summary

## Related Skills

- `implement` - Execute planned changes
- `explore` - Understand current architecture
- `assess` - Evaluate complexity and risks
