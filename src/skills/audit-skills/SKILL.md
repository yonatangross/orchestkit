---
name: audit-skills
description: Audits all OrchestKit skills for quality, completeness, and compliance with authoring standards. Use when checking skill health, before releases, or after bulk skill edits to surface SKILL.md files that are too long, have missing frontmatter, lack rules/references, or are unregistered in manifests.
tags: [audit, quality, skills, orchestkit]
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
context: fork
complexity: medium
persuasion-type: discipline
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - TaskCreate
  - TaskUpdate
  - TaskList
---

# audit-skills

Scans all `src/skills/*/SKILL.md` files and reports compliance with OrchestKit authoring standards. Each category has individual files in `rules/` and `references/` loaded on-demand.

## Quick Reference

| Category | File | Impact | When to Use |
|----------|------|--------|-------------|
| Audit Checks | `${CLAUDE_SKILL_DIR}/rules/audit-checks.md` | HIGH | What to validate per skill |
| Status Rules | `${CLAUDE_SKILL_DIR}/rules/audit-status.md` | MEDIUM | PASS/WARN/FAIL classification |
| Output Format | `${CLAUDE_SKILL_DIR}/references/output-format.md` | MEDIUM | Table layout and column definitions |
| Edge Cases | `${CLAUDE_SKILL_DIR}/references/edge-cases.md` | LOW | Manifest "all", orchestration skills |

**Total: 2 rules across 2 categories**

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main task IMMEDIATELY
TaskCreate(
  subject="Audit Skills: full scan",
  description="Auditing all OrchestKit skills for quality and compliance",
  activeForm="Auditing skill quality"
)

# 2. Create subtasks for each audit phase
TaskCreate(subject="Discover skills", activeForm="Globbing SKILL.md files")
TaskCreate(subject="Run audit checks", activeForm="Checking each skill")
TaskCreate(subject="Classify & render", activeForm="Classifying results and rendering report")

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])
TaskUpdate(taskId="4", addBlockedBy=["3"])

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

## Workflow

1. **Discover** — Glob `src/skills/*/SKILL.md` to get full skill list
2. **Check each skill** — Run all checks from `Read("${CLAUDE_SKILL_DIR}/rules/audit-checks.md")` in parallel
3. **Classify** — Apply status rules from `Read("${CLAUDE_SKILL_DIR}/rules/audit-status.md")`
4. **Render** — Output table using format from `Read("${CLAUDE_SKILL_DIR}/references/output-format.md")`
5. **Totals** — Show `X pass, Y warn, Z fail` at bottom

## Quick Start

```bash
bash src/skills/audit-skills/scripts/run-audit.sh
```

Or invoke manually — Claude scans `src/skills/`, applies checks, and renders the summary table.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Manifest check | `"skills": "all"` in ork.json means ALL skills qualify — mark YES |
| 0 rules + refs | WARN only — some orchestration skills are legitimately rules-free |
| Broken refs | WARN (not FAIL) — file may exist under a different path |

## Related Skills

- `ork:skill-evolution` — Guidance on iterating and improving skills
- `ork:quality-gates` — Broader codebase quality checks
