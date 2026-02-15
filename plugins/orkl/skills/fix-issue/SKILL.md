---
name: fix-issue
license: MIT
compatibility: "Claude Code 2.1.34+. Requires memory MCP server, context7 MCP server, gh CLI."
description: "Fixes GitHub issues with parallel analysis. Use to debug errors, resolve regressions, fix bugs, or triage issues."
argument-hint: "[issue-number]"
context: fork
version: 2.1.0
author: OrchestKit
tags: [issue, bug-fix, github, debugging, rca, prevention]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Task, TaskCreate, TaskUpdate, Grep, Glob, mcp__memory__search_nodes, mcp__context7__get_library_docs]
skills: [commit, explore, verify, debug-investigator, memory, remember]
complexity: medium
metadata:
  category: workflow-automation
  mcp-server: memory, context7
---

# Fix Issue

Systematic issue resolution with hypothesis-based root cause analysis, similar issue detection, and prevention recommendations.

## Quick Start

```bash
/fix-issue 123
/fix-issue 456
```

> **Opus 4.6**: Root cause analysis uses native adaptive thinking. Dynamic token budgets scale with context window for thorough investigation.

---

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify fix approach:

```python
AskUserQuestion(
  questions=[{
    "question": "What approach for this fix?",
    "header": "Approach",
    "options": [
      {"label": "Proper fix (Recommended)", "description": "Full RCA, tests, prevention recommendations"},
      {"label": "Quick fix", "description": "Minimal fix to resolve the immediate issue"},
      {"label": "Investigate first", "description": "Understand the issue before deciding on approach"},
      {"label": "Hotfix", "description": "Emergency patch, minimal testing"}
    ],
    "multiSelect": false
  }]
)
```

**Based on answer, adjust workflow:**
- **Proper fix**: All 11 phases, parallel agents for RCA
- **Quick fix**: Skip phases 8-10 (prevention, runbook, lessons)
- **Investigate first**: Only phases 1-4 (understand, search, hypotheses, analyze)
- **Hotfix**: Minimal phases, skip similar issue search

---

## STEP 0b: Select Orchestration Mode

Choose **Agent Teams** (mesh — RCA agents share hypotheses) or **Task tool** (star — all report to lead):

1. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` → **Agent Teams mode**
2. Agent Teams unavailable → **Task tool mode** (default)
3. Otherwise: Complex cross-cutting bugs (backend + frontend + tests involved) → recommend **Agent Teams**; Focused bugs (single domain) → **Task tool**

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Hypothesis sharing | Lead relays between agents | Investigators share hypotheses in real-time |
| Conflicting evidence | Lead resolves | Investigators debate directly |
| Cost | ~250K tokens | ~600K tokens |
| Best for | Single-domain bugs | Cross-cutting bugs with multiple hypotheses |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining investigation.

---

## Task Management (CC 2.1.16)

```python
# Create main fix task
TaskCreate(
  subject="Fix issue #{number}",
  description="Systematic issue resolution with hypothesis-based RCA",
  activeForm="Fixing issue #{number}"
)

# Create subtasks for 11-phase process
phases = ["Understand issue", "Search similar issues", "Form hypotheses",
          "Analyze root cause", "Design fix", "Implement fix", "Validate fix",
          "Generate prevention", "Create runbook", "Capture lessons", "Commit and PR"]
for phase in phases:
    TaskCreate(subject=phase, activeForm=f"{phase}ing")
```

---

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

---

## Phase 1: Understand the Issue

```bash
gh issue view $ARGUMENTS --json title,body,labels,assignees,comments
gh pr list --search "issue:$ARGUMENTS"
gh issue view $ARGUMENTS --comments
```

**Start Work ceremony** (from `issue-progress-tracking`): move issue to in-progress, comment on issue, ensure branch is named `issue/N-description`.

---

## Phase 2: Similar Issue Detection

See [Similar Issue Search](references/similar-issue-search.md) for patterns.

```bash
gh issue list --search "[key error message]" --state all
mcp__memory__search_nodes(query="issue [error type] fix")
```

| Similar Issue | Similarity | Status | Relevant? |
|---------------|------------|--------|-----------|
| #101 | 85% | Closed | Yes |

**Determine:** Regression? Variant? New issue?

---

## Phase 3: Hypothesis Formation

See [Hypothesis-Based RCA](references/hypothesis-rca.md) for confidence scoring.

```markdown
## Hypothesis 1: [Brief name]
**Confidence:** [0-100]%
**Description:** [What might cause the issue]
**Test:** [How to verify]
```

| Confidence | Meaning |
|------------|---------|
| 90-100% | Near certain |
| 70-89% | Highly likely |
| 50-69% | Probable |
| 30-49% | Possible |
| 0-29% | Unlikely |

---

## Phase 4: Root Cause Analysis (5 Agents)

Launch ALL 5 agents in parallel with `run_in_background=True` and `max_turns=25`:

1. **debug-investigator**: Root cause tracing
2. **debug-investigator**: Impact analysis
3. **backend-system-architect**: Backend fix design
4. **frontend-ui-developer**: Frontend fix design
5. **test-generator**: Test requirements

Each agent outputs structured JSON with findings and SUMMARY line.

### Phase 4 — Agent Teams Alternative

In Agent Teams mode, form an investigation team where RCA agents share hypotheses and evidence in real-time:

```python
TeamCreate(team_name="fix-issue-{number}", description="RCA for issue #{number}")

Task(subagent_type="debug-investigator", name="root-cause-tracer",
     team_name="fix-issue-{number}",
     prompt="""Trace the root cause for issue #{number}: {issue description}
     Hypotheses: {hypothesis list from Phase 3}
     Test each hypothesis. When you find evidence supporting or refuting a hypothesis,
     message impact-analyst and the relevant domain expert (backend-expert or frontend-expert).
     If you find conflicting evidence, share it with ALL teammates for debate.""")

Task(subagent_type="debug-investigator", name="impact-analyst",
     team_name="fix-issue-{number}",
     prompt="""Analyze the impact and blast radius for issue #{number}.
     When root-cause-tracer shares evidence, assess how many code paths are affected.
     Message test-planner with affected paths so they can plan regression tests.
     If the impact is larger than expected, message the lead immediately.""")

Task(subagent_type="backend-system-architect", name="backend-expert",
     team_name="fix-issue-{number}",
     prompt="""Investigate backend aspects of issue #{number}.
     When root-cause-tracer shares backend-related hypotheses, design the fix approach.
     Message frontend-expert if the fix affects API contracts.
     Share fix design with test-planner for test requirements.""")

Task(subagent_type="frontend-ui-developer", name="frontend-expert",
     team_name="fix-issue-{number}",
     prompt="""Investigate frontend aspects of issue #{number}.
     When root-cause-tracer shares frontend-related hypotheses, design the fix approach.
     If backend-expert changes API contracts, adapt the frontend fix accordingly.
     Share component changes with test-planner.""")

Task(subagent_type="test-generator", name="test-planner",
     team_name="fix-issue-{number}",
     prompt="""Plan regression tests for issue #{number}.
     When root-cause-tracer confirms the root cause, write a failing test that reproduces it.
     When backend-expert or frontend-expert share fix designs, plan verification tests.
     Start with the regression test BEFORE the fix is applied (TDD approach).""")
```

**Team teardown** after fix is implemented and validated:
```python
SendMessage(type="shutdown_request", recipient="root-cause-tracer", content="Fix validated")
SendMessage(type="shutdown_request", recipient="impact-analyst", content="Fix validated")
SendMessage(type="shutdown_request", recipient="backend-expert", content="Fix validated")
SendMessage(type="shutdown_request", recipient="frontend-expert", content="Fix validated")
SendMessage(type="shutdown_request", recipient="test-planner", content="Fix validated")
TeamDelete()
```

> **Fallback:** If team formation fails, use standard Phase 4 Task spawns above.

---

## Phase 5: Fix Design

```markdown
## Fix Design for Issue #$ARGUMENTS

### Root Cause (Confirmed)
[Description]

### Proposed Fix
[Approach]

### Files to Modify
| File | Change | Reason |
|------|--------|--------|
| [file] | MODIFY | [why] |

### Risks
- [Risk 1]

### Rollback Plan
[How to revert]
```

---

## Phase 6: Implementation

### CRITICAL: Feature Branch Required

**NEVER commit directly to main or dev.** Always create a feature branch:

```bash
# Determine base branch
BASE_BRANCH=$(git remote show origin | grep 'HEAD branch' | cut -d: -f2 | tr -d ' ')

# Create feature branch (MANDATORY)
git checkout $BASE_BRANCH && git pull origin $BASE_BRANCH
git checkout -b issue/$ARGUMENTS-fix
```

### CRITICAL: Regression Test Required

**A fix without a test is incomplete.** Add test BEFORE implementing fix:

```bash
# 1. Write test that reproduces the bug (should FAIL)
# 2. Implement the fix
# 3. Verify test now PASSES
```

**Guidelines:**
- Make minimal, focused changes
- Add proper error handling
- Add regression test FIRST (MANDATORY)
- DO NOT over-engineer
- DO NOT commit directly to protected branches

---

## Phase 7: Validation

```bash
# Backend
poetry run ruff format --check app/
poetry run pytest tests/unit/ -v --tb=short

# Frontend
npm run lint && npm run typecheck && npm run test
```

---

## Phase 8: Prevention Recommendations

**CRITICAL: Prevention must include at least one of:**
1. **Automated test** - CI catches similar issues (PREFERRED)
2. **Validation rule** - Schema/lint rule prevents bad state
3. **Process check** - Review checklist item

See [Prevention Patterns](references/prevention-patterns.md) for full template.

| Category | Examples | Effectiveness |
|----------|----------|---------------|
| **Automated test** | Unit/integration test in CI | HIGH - catches before merge |
| **Validation rule** | Schema check, lint rule | HIGH - catches on save/commit |
| Architecture | Better error boundaries | MEDIUM |
| Process | Review checklist item | LOW - human-dependent |

---

## Phase 9: Runbook Generation

```markdown
# Runbook: [Issue Type]

## Symptoms
- [Observable symptom]

## Diagnosis Steps
1. Check [X] by running: `[command]`

## Resolution Steps
1. [Step 1]

## Prevention
- [How to prevent]
```

Store in memory for future reference.

---

## Phase 10: Lessons Learned

```python
mcp__memory__create_entities(entities=[{
  "name": "lessons-issue-$ARGUMENTS",
  "entityType": "LessonsLearned",
  "observations": [
    "root_cause: [brief]",
    "key_learning: [most important]",
    "prevention: [recommendation]"
  ]
}])
```

---

## Phase 11: Commit and PR

```bash
git add .
git commit -m "fix(#$ARGUMENTS): [Brief description]

Root cause: [one line]
Prevention: [recommendation]"

git push -u origin issue/$ARGUMENTS-fix
gh pr create --base dev --title "fix(#$ARGUMENTS): [description]"
```

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Feature branch | MANDATORY | Never commit to main/dev directly |
| Regression test | MANDATORY | Fix without test is incomplete |
| Hypothesis confidence | 0-100% scale | Quantifies certainty |
| Similar issue search | Before hypothesis | Leverage past solutions |
| Prevention analysis | Mandatory phase | Break recurring issue cycle |
| Runbook generation | Template-based | Consistent documentation |

---

## CC 2.1.27+ Enhancements

### Session Resume with PR Context

When you create a PR for the fix, the session is automatically linked:

```bash
# Later: Resume with full PR context
claude --from-pr 789
```

### Task Metrics (CC 2.1.30)

Track RCA efficiency across the 5 parallel agents:

```markdown
## Phase 4 Metrics (Root Cause Analysis)
| Agent | Tokens | Tools | Duration |
|-------|--------|-------|----------|
| debug-investigator #1 | 520 | 12 | 18s |
| debug-investigator #2 | 480 | 10 | 15s |
| backend-system-architect | 390 | 8 | 12s |

**Root cause found in:** 45s total
```

### Tool Guidance (CC 2.1.31)

When investigating root cause:

| Task | Use | Avoid |
|------|-----|-------|
| Read logs/files | `Read(file_path=...)` | `bash cat` |
| Search for errors | `Grep(pattern="ERROR")` | `bash grep` |
| Find affected files | `Glob(pattern="**/*.py")` | `bash find` |
| Check git history | `Bash git log/diff` | (git needs bash) |

### Session Resume Hints (CC 2.1.31)

Before ending fix sessions, capture investigation context:

```bash
/ork:remember Issue #$ARGUMENTS RCA findings:
  Root cause: [one line]
  Confirmed by: [key evidence]
  Fix status: [implemented/pending]
  Prevention: [recommendation]
```

Resume later:
```bash
claude                              # Shows resume hint
/ork:memory search "issue $ARGUMENTS"  # Loads your findings
```

---

## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| [rca-five-whys](rules/rca-five-whys.md) | HIGH | 5 Whys iterative causal analysis |
| [rca-fishbone](rules/rca-fishbone.md) | MEDIUM | Ishikawa diagram, multi-factor analysis |
| [rca-fault-tree](rules/rca-fault-tree.md) | MEDIUM | Fault tree analysis, AND/OR gates, critical systems |

## Related Skills

- `commit` - Commit issue fixes
- `debug-investigator` - Debug complex issues
- `issue-progress-tracking` - Auto-updates from commits
- `remember` - Store lessons learned

---

**Version:** 2.1.0 (February 2026)
