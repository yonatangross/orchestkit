---
name: fix-issue
license: MIT
compatibility: "Claude Code 2.1.59+. Requires memory MCP server, context7 MCP server, gh CLI."
description: "Fixes GitHub issues with parallel analysis. Use when debugging errors, resolving regressions, fixing bugs, or triaging issues."
argument-hint: "[issue-number]"
context: fork
version: 2.1.0
author: OrchestKit
tags: [issue, bug-fix, github, debugging, rca, prevention]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Task, TaskCreate, TaskUpdate, TaskOutput, TaskStop, Grep, Glob, mcp__memory__search_nodes, mcp__context7__get_library_docs]
skills: [commit, explore, verify, memory, remember]
complexity: medium
model: sonnet
hooks:
  PreToolUse:
    - matcher: "Read"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/issue-context-loader"
      once: true
metadata:
  category: workflow-automation
  mcp-server: memory, context7
---

# Fix Issue

Systematic issue resolution with hypothesis-based root cause analysis, similar issue detection, and prevention recommendations.

## Quick Start

```bash
/ork:fix-issue 123
/ork:fix-issue 456
```

> **Opus 4.6**: Root cause analysis uses native adaptive thinking. Dynamic token budgets scale with context window for thorough investigation.

## Argument Resolution

```python
ISSUE_NUMBER = "$ARGUMENTS[0]"  # e.g., "123" (CC 2.1.59 indexed access)
# $ARGUMENTS contains the full argument string
# $ARGUMENTS[0] is the first space-separated token
```

## STEP 0: Verify User Intent

**BEFORE creating tasks**, clarify fix approach using AskUserQuestion. Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/fix-issue/rules/evidence-gathering.md")` for the full prompt template and workflow adjustments per approach (Proper fix, Quick fix, Investigate first, Hotfix).

## STEP 0b: Select Orchestration Mode

Choose **Agent Teams** (mesh) or **Task tool** (star). Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/fix-issue/references/agent-selection.md")` for the selection criteria, cost comparison, and task creation patterns.

## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Understand Issue** | Read GitHub issue details | Problem statement |
| **2. Similar Issue Detection** | Search for related past issues | Related issues list |
| **3. Hypothesis Formation** | Form hypotheses with confidence scores | Ranked hypotheses |
| **4. Root Cause Analysis** | 5 parallel agents investigate | Confirmed root cause |
| **5. Fix Design** | Design approach based on RCA | Fix specification |
| **6. Implementation** | Apply fix with tests | Working code |
| **7. Validation** | Verify fix resolves issue | Evidence |
| **8. Prevention** | How to prevent recurrence | Prevention plan |
| **9. Runbook** | Create/update runbook entry | Runbook |
| **10. Lessons Learned** | Capture knowledge | Persisted learnings |
| **11. Commit and PR** | Create PR with fix | Merged PR |

> **Full phase details**: Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/fix-issue/references/fix-phases.md")` for bash commands, templates, and procedures for each phase.

## Critical Constraints

- **Feature branch MANDATORY** -- NEVER commit directly to main or dev
- **Regression test MANDATORY** -- write failing test BEFORE implementing fix
- **Prevention required** -- at least one of: automated test, validation rule, or process check
- Make minimal, focused changes; DO NOT over-engineer

## CC 2.1.49 Enhancements

> Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/fix-issue/references/cc-enhancements.md")` for session resume, task metrics, tool guidance, worktree isolation, and adaptive thinking.

## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| evidence-gathering (load `${CLAUDE_PLUGIN_ROOT}/skills/fix-issue/rules/evidence-gathering.md`) | HIGH | User intent verification, confidence scale, key decisions |
| rca-five-whys (load `${CLAUDE_PLUGIN_ROOT}/skills/fix-issue/rules/rca-five-whys.md`) | HIGH | 5 Whys iterative causal analysis |
| rca-fishbone (load `${CLAUDE_PLUGIN_ROOT}/skills/fix-issue/rules/rca-fishbone.md`) | MEDIUM | Ishikawa diagram, multi-factor analysis |
| rca-fault-tree (load `${CLAUDE_PLUGIN_ROOT}/skills/fix-issue/rules/rca-fault-tree.md`) | MEDIUM | Fault tree analysis, AND/OR gates, critical systems |

## Related Skills

- `ork:commit` - Commit issue fixes
- `debug-investigator` - Debug complex issues
- `ork:issue-progress-tracking` - Auto-updates from commits
- `ork:remember` - Store lessons learned

## References

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/fix-issue/references/<file>")`:
| File | Content |
|------|---------|
| `fix-phases.md` | Bash commands, templates, procedures per phase |
| `agent-selection.md` | Orchestration mode selection criteria and cost comparison |
| `similar-issue-search.md` | Similar issue detection patterns |
| `hypothesis-rca.md` | Hypothesis-based root cause analysis |
| `agent-teams-rca.md` | Agent Teams RCA workflow |
| `prevention-patterns.md` | Recurrence prevention patterns |
| `cc-enhancements.md` | CC 2.1.49 session resume, task metrics, adaptive thinking |

---

**Version:** 2.1.0 (February 2026)
