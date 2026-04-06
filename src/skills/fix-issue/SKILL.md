---
name: fix-issue
license: MIT
compatibility: "Claude Code 2.1.76+. Requires memory MCP server, context7 MCP server, gh CLI."
description: "Fixes GitHub issues with parallel analysis. Use when debugging errors, resolving regressions, fixing bugs, or triaging issues."
argument-hint: "[issue-number]"
context: fork
version: 2.4.0
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
triggers:
  keywords: [fix, debug, "bug report", broken, "500 errors", investigate, resolve, regression, "track down", "figure out why", "issue #"]
  examples:
    - "fix issue #234"
    - "there's a bug where users can't reset their passwords"
    - "something's causing 500 errors on the /api/users endpoint"
  anti-triggers: [implement, build, create, explore, review, brainstorm]
paths: ["src/**/*.{ts,tsx,js,jsx}", "package.json", "CLAUDE.md"]
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

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else (after MCP probe), create tasks to track progress:**

```python
# 1. Create main task IMMEDIATELY
TaskCreate(
  subject="Fix Issue: #{ISSUE_NUMBER}",
  description="Systematic issue resolution with RCA and prevention",
  activeForm="Fixing issue #{ISSUE_NUMBER}"
)

# 2. Create subtasks for each key phase
TaskCreate(subject="Understand issue", activeForm="Reading issue details")
TaskCreate(subject="Hypothesis & RCA", activeForm="Analyzing root cause")
TaskCreate(subject="Implement fix", activeForm="Applying fix with tests")
TaskCreate(subject="Validate & prevent", activeForm="Validating fix and prevention")
TaskCreate(subject="Commit and PR", activeForm="Creating PR for fix")

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])
TaskUpdate(taskId="4", addBlockedBy=["3"])
TaskUpdate(taskId="5", addBlockedBy=["4"])
TaskUpdate(taskId="6", addBlockedBy=["5"])

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

## STEP 0: Effort-Aware Fix Scaling (CC 2.1.76)

Scale investigation depth based on `/effort` level:

| Effort Level | Approach | Agents | Phases |
|-------------|----------|--------|--------|
| **low** | Quick fix: read → fix → test → done | 0 agents | 1, 6, 7, 11 |
| **medium** | Standard: investigate → fix → test → prevent | 2-3 agents | 1-4, 6-8, 11 |
| **high** (default) | Full RCA: 5 parallel agents → fix → prevent → lessons | 5 agents | All 11 phases |

> **Override:** Explicit user selection (e.g., "Proper fix") overrides `/effort` downscaling. Hotfix always uses minimal phases regardless of effort.

## STEP 0a: Verify User Intent

**BEFORE creating tasks**, clarify fix approach:

```python
AskUserQuestion(
  questions=[{
    "question": "How do you want to approach this fix?",
    "header": "Fix Approach",
    "options": [
      {"label": "Proper fix (Recommended)", "description": "Full RCA, regression test, prevention plan", "markdown": "```\nProper Fix (11 phases)\n──────────────────────\n  Understand ──▶ Hypothesize ──▶ RCA\n       │              │           │\n       ▼              ▼           ▼\n  5 parallel     Ranked       Confirmed\n  agents         hypotheses   root cause\n       │\n       ▼\n  Fix ──▶ Validate ──▶ Prevent ──▶ PR\n  + regression test   + runbook\n```"},
      {"label": "Quick fix", "description": "Minimal investigation, fix and test", "markdown": "```\nQuick Fix (~10 min)\n───────────────────\n  Read issue ──▶ Fix ──▶ Test ──▶ PR\n\n  Skip: full RCA, prevention plan,\n  runbook, lessons learned\n  Keep: regression test (mandatory)\n```"},
      {"label": "Investigate first", "description": "Deep analysis before deciding on approach", "markdown": "```\nInvestigate First\n─────────────────\n  Read issue ──▶ 5 parallel agents ──▶ Report\n\n  Output: Root cause analysis\n  + hypothesis ranking\n  + recommended approach\n  No code changes yet\n```"},
      {"label": "Hotfix", "description": "Emergency fix, minimal process", "markdown": "```\nHotfix (emergency)\n──────────────────\n  Read issue ──▶ Fix ──▶ Push\n\n  Skip: agents, RCA, prevention\n  Keep: basic test verification\n  Post-fix: schedule proper RCA\n```"}
    ],
    "multiSelect": false
  }]
)
```

**Based on answer, adjust workflow:**
- **Proper fix**: All 11 phases, 5 parallel RCA agents
- **Quick fix**: Phases 1, 6, 7, 11 only — skip RCA agents and prevention
- **Investigate first**: Enter plan mode for read-only analysis, then decide
- **Hotfix**: Phases 1, 6, 11 only — emergency path

**If 'Investigate first' selected:**

```python
# 1. Enter read-only plan mode
EnterPlanMode("Investigate issue: $ISSUE_REF")

# 2. Investigation phase — Read/Grep/Glob ONLY, no Write/Edit
#    - Read the issue description and linked context
#    - Trace the error path through relevant code
#    - Search for related issues, past fixes, test failures
#    - Build hypothesis list with evidence

# 3. Produce RCA report:
#    - Root cause hypothesis (ranked by confidence)
#    - Affected files and blast radius
#    - Recommended approach (proper fix vs quick fix)
#    - Risk assessment

# 4. Exit plan mode — returns analysis for user decision
ExitPlanMode()

# 5. User reviews RCA. If "proceed with fix" → continue to Phase 5 (Fix).
#    If "need more info" → re-enter investigation.
```

Load `Read("${CLAUDE_SKILL_DIR}/rules/evidence-gathering.md")` for detailed workflow adjustments per approach.

## STEP 0b: Select Orchestration Mode

Choose **Agent Teams** (mesh) or **Task tool** (star). Load `Read("${CLAUDE_SKILL_DIR}/references/agent-selection.md")` for the selection criteria, cost comparison, and task creation patterns.

## Service Discovery & Visual Inspection

When the issue involves a running web app, API, or UI bug, discover services and inspect visually **before** forming hypotheses:

```bash
# 1. Discover services via Portless (preferred)
portless list 2>/dev/null
# api → api.localhost:1355   (port 8080)
# app → app.localhost:1355   (port 3000)

# 2. Fallback: discover ports manually
lsof -iTCP -sTCP:LISTEN -nP | grep -E 'node|python|java'

# 3. Visual inspection with agent-browser
agent-browser open "http://app.localhost:1355"
agent-browser screenshot /tmp/issue-before.png     # capture broken state
agent-browser console                              # check for JS errors
agent-browser network log                          # inspect failed API calls
agent-browser get text @error-banner               # extract error messages
```

Use Portless named URLs (`*.localhost:1355`) in all investigation steps — they're stable, self-documenting, and eliminate port-guessing failures. Install with `npm i -g portless`.

## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Understand Issue** | Read GitHub issue details | Problem statement |
| **1b. Service Discovery** | Portless list, agent-browser visual inspection | Service URLs, screenshots |
| **2. Similar Issue Detection** | Search for related past issues | Related issues list |
| **3. Hypothesis Formation** | Form hypotheses with confidence scores | Ranked hypotheses |
| **4. Root Cause Analysis** | 5 parallel agents investigate | Confirmed root cause |
| **5. Fix Design** | Design approach based on RCA | Fix specification |
| **6. Implementation** | Apply fix with tests | Working code |
| **7. Validation** | Verify fix resolves issue, screenshot after state | Evidence |
| **8. Prevention** | How to prevent recurrence | Prevention plan |
| **9. Runbook** | Create/update runbook entry | Runbook |
| **10. Lessons Learned** | Capture knowledge | Persisted learnings |
| **11. Commit and PR** | Create PR with fix | Merged PR |

### Progressive Output (CC 2.1.76)

Output results **incrementally** as each phase completes — don't batch until the PR:

| After Phase | Show User |
|-------------|-----------|
| 1. Understand Issue | Problem statement, affected files |
| 3. Hypothesis Formation | Ranked hypotheses with confidence scores |
| 4. RCA | Confirmed root cause, evidence chain |
| 6. Implementation | Fix description, files changed |
| 7. Validation | Test results, before/after behavior |

For the proper fix path with 5 parallel RCA agents, output each agent's findings **as they return** — don't wait for all 5. If one agent identifies the root cause with high confidence early, flag it immediately so the user can confirm and skip remaining agents.

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

### Worktree Cleanup (CC 2.1.72)

If worktree isolation was used in Phase 4, clean up after validation:

```python
# After Phase 7 validation passes — exit worktree, keep branch for PR
ExitWorktree(action="keep")
```

Every `EnterWorktree` or `isolation: "worktree"` agent must have a matching cleanup. If agents used `isolation: "worktree"`, they handle their own exit — but if the lead entered a worktree in Step 0, it must call `ExitWorktree` before Phase 11 commit.

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
- `browser-tools` - Visual inspection with agent-browser + Portless
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

**Version:** 2.4.0 (March 2026) — Rich elicitation with options for fix approach, progressive output for incremental phase results
