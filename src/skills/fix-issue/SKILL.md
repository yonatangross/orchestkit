---
name: fix-issue
license: MIT
compatibility: "Claude Code 2.1.72+. Requires memory MCP server, context7 MCP server, gh CLI."
description: "Fixes GitHub issues with parallel analysis. Use when debugging errors, resolving regressions, fixing bugs, or triaging issues."
argument-hint: "[issue-number]"
context: fork
version: 2.2.0
author: OrchestKit
tags: [issue, bug-fix, github, debugging, rca, prevention]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Task, TaskCreate, TaskUpdate, TaskOutput, TaskStop, Grep, Glob, ToolSearch, CronCreate, CronDelete, mcp__memory__search_nodes, mcp__context7__get_library_docs]
skills: [commit, explore, verify, memory, remember, chain-patterns]
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

## STEP -1: MCP Probe + Resume Check

**Run BEFORE any other step.** Detect available MCP servers and check for resumable state.

```python
# Probe MCPs (parallel — all in ONE message):
ToolSearch(query="select:mcp__memory__search_nodes")
ToolSearch(query="select:mcp__context7__resolve-library-id")

# Write capability map:
Write(".claude/chain/capabilities.json", JSON.stringify({
  "memory": <true if found>,
  "context7": <true if found>,
  "timestamp": now()
}))

# Check for resumable state:
Read(".claude/chain/state.json")
# If exists and skill == "fix-issue":
#   Read last handoff, skip to current_phase
#   Tell user: "Resuming from Phase {N}"
# If not exists: write initial state
Write(".claude/chain/state.json", JSON.stringify({
  "skill": "fix-issue",
  "issue": ISSUE_NUMBER,
  "current_phase": 1,
  "completed_phases": [],
  "capabilities": capabilities
}))
```

> Load pattern details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/mcp-detection.md")`

## STEP 0: Verify User Intent

**BEFORE creating tasks**, clarify fix approach using AskUserQuestion. Load `Read("${CLAUDE_SKILL_DIR}/rules/evidence-gathering.md")` for the full prompt template and workflow adjustments per approach (Proper fix, Quick fix, Investigate first, Hotfix).

## STEP 0b: Select Orchestration Mode

Choose **Agent Teams** (mesh) or **Task tool** (star). Load `Read("${CLAUDE_SKILL_DIR}/references/agent-selection.md")` for the selection criteria, cost comparison, and task creation patterns.

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

### Phase Handoffs (CC 2.1.71)

Write handoff JSON after phases 3, 4, 6, 7 to `.claude/chain/`. See `chain-patterns` skill for schema.

| After Phase | Handoff File | Key Outputs |
|-------------|-------------|-------------|
| 3. Hypothesis | `03-hypotheses.json` | Ranked hypotheses with confidence scores |
| 4. RCA | `04-rca.json` | Confirmed root cause, evidence, affected files |
| 6. Implementation | `06-fix.json` | Fix description, files changed, test plan |
| 7. Validation | `07-validation.json` | Test results, coverage delta |

### Worktree-Isolated RCA Agents (CC 2.1.50)

Phase 4 agents SHOULD use `isolation: "worktree"` when they need to edit files:

```python
Agent(subagent_type="debug-investigator",
  prompt="Investigate hypothesis: {desc}...",
  isolation="worktree", run_in_background=true)
```

### Post-Fix Monitoring (CC 2.1.71)

After Phase 11 (commit + PR), schedule CI monitoring:

```python
# Guard: Skip cron in headless/CI (CLAUDE_CODE_DISABLE_CRON)
# if env CLAUDE_CODE_DISABLE_CRON is set, run a single check instead
CronCreate(
  schedule="*/5 * * * *",
  prompt="Check CI for PR #{pr_number}: gh pr checks {pr_number} --repo {repo}.
    All pass → CronDelete this job. Any fail → alert with details."
)
```

### Fix Pattern Memory

If memory MCP is available (from Step -1 probe), save the fix pattern:

```python
if capabilities.memory:
  mcp__memory__create_entities([{
    name: "fix-pattern-{slug}",
    entityType: "fix-pattern",
    observations: [root_cause, fix_description, regression_test, issue_ref]
  }])
```

> **Full phase details**: Load `Read("${CLAUDE_SKILL_DIR}/references/fix-phases.md")` for bash commands, templates, and procedures for each phase.

## Critical Constraints

- **Feature branch MANDATORY** -- NEVER commit directly to main or dev
- **Regression test MANDATORY** -- write failing test BEFORE implementing fix
- **Prevention required** -- at least one of: automated test, validation rule, or process check
- Make minimal, focused changes; DO NOT over-engineer

## CC 2.1.49 Enhancements

> Load `Read("${CLAUDE_SKILL_DIR}/references/cc-enhancements.md")` for session resume, task metrics, tool guidance, worktree isolation, and adaptive thinking.

## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| evidence-gathering (load `${CLAUDE_SKILL_DIR}/rules/evidence-gathering.md`) | HIGH | User intent verification, confidence scale, key decisions |
| rca-five-whys (load `${CLAUDE_SKILL_DIR}/rules/rca-five-whys.md`) | HIGH | 5 Whys iterative causal analysis |
| rca-fishbone (load `${CLAUDE_SKILL_DIR}/rules/rca-fishbone.md`) | MEDIUM | Ishikawa diagram, multi-factor analysis |
| rca-fault-tree (load `${CLAUDE_SKILL_DIR}/rules/rca-fault-tree.md`) | MEDIUM | Fault tree analysis, AND/OR gates, critical systems |

## Related Skills

- `ork:commit` - Commit issue fixes
- `debug-investigator` - Debug complex issues
- `ork:issue-progress-tracking` - Auto-updates from commits
- `ork:remember` - Store lessons learned

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:
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

**Version:** 2.2.0 (March 2026)
