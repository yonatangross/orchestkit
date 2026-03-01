---
name: plan-viz
license: MIT
compatibility: "Claude Code 2.1.59+."
description: "Visualize planned changes before implementation. Use when reviewing plans, comparing before/after architecture, assessing risk, or analyzing execution order and impact."
argument-hint: "[plan-or-issue]"
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
tags: [visualization, planning, before-after, architecture, diff, risk, impact, migration]
user-invocable: true
allowed-tools: [Read, Grep, Glob, Task, AskUserQuestion, Bash, Write]
skills: [ascii-visualizer, explore, architecture-decision-record]
complexity: medium
metadata:
  category: document-asset-creation
---

# Plan Visualization

Render planned changes as structured ASCII visualizations with risk analysis, execution order, and impact metrics. Every section answers a specific reviewer question.

**Core principle:** Encode judgment into visualization, not decoration.

```bash
/ork:plan-viz                          # Auto-detect from current branch
/ork:plan-viz billing module redesign  # Describe the plan
/ork:plan-viz #234                     # Pull from GitHub issue
```

## Argument Resolution

```python
PLAN_INPUT = "$ARGUMENTS"    # Full argument string
PLAN_TOKEN = "$ARGUMENTS[0]" # First token — could be issue "#234" or plan description
# If starts with "#", treat as GitHub issue number. Otherwise, plan description.
# $ARGUMENTS (full string) for multi-word descriptions (CC 2.1.59 indexed access)
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
      {"label": "Current branch changes (Recommended)", "description": "Auto-detect from git diff against main", "markdown": "```\nBranch Diff Analysis\n────────────────────\n$ git diff main...HEAD\n\n→ File change manifest (+A, M, -D)\n→ Execution swimlane by phase\n→ Risk dashboard + pre-mortems\n→ Impact summary (lines, tests, API)\n```"},
      {"label": "Describe the plan", "description": "I'll explain what I'm planning to change", "markdown": "```\nPlan Description\n────────────────\nYou describe → I visualize:\n\n→ Before/after architecture diagrams\n→ Execution order with dependencies\n→ Risk analysis per component\n→ Decision log (ADR-lite format)\n```"},
      {"label": "GitHub issue", "description": "Pull plan from a specific issue number", "markdown": "```\nGitHub Issue Source\n───────────────────\n$ gh issue view #N\n\n→ Extract requirements from body\n→ Map to file-level changes\n→ Generate execution phases\n→ Link back to issue for tracking\n```"},
      {"label": "Quick file diff only", "description": "Just show the change manifest, skip analysis", "markdown": "```\nQuick File Diff\n───────────────\n[A] src/new-file.ts        +120\n[M] src/existing.ts    +15  -8\n[D] src/old-file.ts        -45\n─────────────────────────────\nNET: +82 lines, 3 files\n\nNo risk analysis or swimlanes\n```"}
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

Use `assets/tier1-header.md` template. See [references/visualization-tiers.md](references/visualization-tiers.md) for field computation (risk level, confidence, reversibility).

```
PLAN: {plan_name} ({issue_ref})  |  {phase_count} phases  |  {file_count} files  |  +{added} -{removed} lines
Risk: {risk_level}  |  Confidence: {confidence}  |  Reversible until {last_safe_phase}
Branch: {branch} -> {base_branch}

[1] Changes  [2] Execution  [3] Risks  [4] Decisions  [5] Impact  [all]
```

---

## STEP 3: Ask Which Sections to Expand

```python
AskUserQuestion(
  questions=[{
    "question": "Which sections to render?",
    "header": "Sections",
    "options": [
      {"label": "All sections", "description": "Full visualization with all 5 core sections", "markdown": "```\n[1] Change Manifest   [A]/[M]/[D] file tree\n[2] Execution         Swimlane with phases\n[3] Risks             Dashboard + pre-mortems\n[4] Decisions         ADR-lite decision log\n[5] Impact            Lines, tests, API, deps\n```"},
      {"label": "Changes + Execution", "description": "File diff tree and execution swimlane", "markdown": "```\n[1] Change Manifest\n    [M] src/auth.ts         +45 -12\n    [A] src/oauth.ts        +89\n\n[2] Execution Swimlane\n    Phase 1 ====[auth]========▶\n    Phase 2 ----[blocked]--===▶\n```"},
      {"label": "Risks + Decisions", "description": "Risk dashboard and decision log", "markdown": "```\n[3] Risk Dashboard\n    MEDIUM ██░░ migration reversible\n    HIGH   ███░ API breaking change\n    Pre-mortem: \"What if auth fails?\"\n\n[4] Decision Log\n    D1: OAuth2 over JWT (security)\n    D2: Postgres over Redis (durability)\n```"},
      {"label": "Impact only", "description": "Just the numbers: files, lines, tests, API surface", "markdown": "```\n[5] Impact Summary\n    ┌──────────┬─────┬───────┐\n    │ Metric   │Count│ Delta │\n    ├──────────┼─────┼───────┤\n    │ Files    │  12 │  +3   │\n    │ Lines    │ 450 │ +127  │\n    │ Tests    │   8 │  +4   │\n    │ API sfc  │   3 │  +1   │\n    └──────────┴─────┴───────┘\n```"}
    ],
    "multiSelect": false
  }]
)
```

---

## STEP 4: Render Requested Sections

Render each requested section following [rules/section-rendering.md](rules/section-rendering.md) conventions. Use the corresponding reference for ASCII patterns:

| Section | Reference | Key Convention |
|---------|-----------|----------------|
| [1] Change Manifest | [change-manifest-patterns.md](references/change-manifest-patterns.md) | `[A]`/`[M]`/`[D]` + `+N -N` per file |
| [2] Execution Swimlane | [execution-swimlane-patterns.md](references/execution-swimlane-patterns.md) | `===` active, `---` blocked, `\|` deps |
| [3] Risk Dashboard | [risk-dashboard-patterns.md](references/risk-dashboard-patterns.md) | Reversibility timeline + 3 pre-mortems |
| [4] Decision Log | [decision-log-patterns.md](references/decision-log-patterns.md) | ADR-lite: Context/Decision/Alternatives/Tradeoff |
| [5] Impact Summary | [assets/impact-dashboard.md](assets/impact-dashboard.md) | Table: Added/Modified/Deleted/NET + tests/API/deps |

---

## STEP 5: Offer Actions

After rendering, offer next steps:

```python
AskUserQuestion(
  questions=[{
    "question": "What next?",
    "header": "Actions",
    "options": [
      {"label": "Write to designs/", "description": "Save as designs/{branch}.md for PR review", "markdown": "```\nSave to File\n────────────\ndesigns/\n  └── feat-billing-redesign.md\n      ├── Header + metadata\n      ├── All rendered sections\n      └── Ready for PR description\n```"},
      {"label": "Generate GitHub issues", "description": "Create issues from execution phases with labels and milestones", "markdown": "```\nGitHub Issues\n─────────────\n#101 [billing] Phase 1: Schema migration\n     labels: component:billing, risk:medium\n#102 [billing] Phase 2: API endpoints\n     labels: component:billing, risk:low\n     blocked-by: #101\n```"},
      {"label": "Drill deeper", "description": "Expand blast radius, cross-layer check, or migration checklist", "markdown": "```\nDeep Dive Options\n─────────────────\n[6] Blast Radius\n    direct → transitive → test impact\n[7] Cross-Layer Consistency\n    Frontend ↔ Backend endpoint gaps\n[8] Migration Checklist\n    Ordered runbook with time estimates\n```"},
      {"label": "Done", "description": "Plan visualization complete"}
    ],
    "multiSelect": false
  }]
)
```

**Write to file:** Save full report to `designs/{branch-name}.md` using `assets/plan-report.md` template.

**Generate issues:** For each execution phase, create a GitHub issue with title `[{component}] {phase_description}`, labels (component + `risk:{level}`), milestone, body from plan sections, and blocked-by references.

---

## Deep Dives (Tier 3, on request)

Available when user selects "Drill deeper". See [references/deep-dives.md](references/deep-dives.md) for cross-layer and migration patterns.

| Section | What It Shows | Reference |
|---------|--------------|-----------|
| [6] Blast Radius | Concentric rings of impact (direct -> transitive -> tests) | [blast-radius-patterns.md](references/blast-radius-patterns.md) |
| [7] Cross-Layer Consistency | Frontend/backend endpoint alignment with gap detection | [deep-dives.md](references/deep-dives.md) |
| [8] Migration Checklist | Ordered runbook with sequential/parallel blocks and time estimates | [deep-dives.md](references/deep-dives.md) |

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
| [section-rendering](rules/section-rendering.md) | HIGH | Rendering conventions for all 5 core sections |
| ASCII diagrams | MEDIUM | Via `ascii-visualizer` skill (box-drawing, file trees, workflows) |

## References

- [Visualization Tiers](references/visualization-tiers.md) — Progressive disclosure tiers and header field computation
- [Change Manifest Patterns](references/change-manifest-patterns.md)
- [Execution Swimlane Patterns](references/execution-swimlane-patterns.md)
- [Risk Dashboard Patterns](references/risk-dashboard-patterns.md)
- [Decision Log Patterns](references/decision-log-patterns.md)
- [Blast Radius Patterns](references/blast-radius-patterns.md)
- [Deep Dives](references/deep-dives.md) — Cross-layer consistency and migration checklist

## Assets

- [Plan Report Template](assets/plan-report.md) — Full mustache-style report
- [Impact Dashboard Template](assets/impact-dashboard.md) — Impact table
- [Tier 1 Header Template](assets/tier1-header.md) — 5-line summary

## Related Skills

- `ork:implement` - Execute planned changes
- `ork:explore` - Understand current architecture
- `ork:assess` - Evaluate complexity and risks
