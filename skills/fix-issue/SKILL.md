---
name: fix-issue
description: Fix GitHub issue with parallel analysis and implementation. Use when fixing issues, resolving bugs, closing GitHub issues.
context: fork
version: 1.2.0
author: OrchestKit
tags: [issue, bug-fix, github, debugging]
user-invocable: true
allowedTools: [Bash, Read, Write, Edit, Task, TaskCreate, TaskUpdate, Grep, Glob, mcp__memory__search_nodes, mcp__context7__get-library-docs]
skills: [commit, explore, verify, debug-investigator, recall]
---

# Fix Issue

Systematic issue resolution with 5-7 parallel agents.

## Quick Start

```bash
/fix-issue 123
/fix-issue 456
```

---

## ⚠️ CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main fix task IMMEDIATELY
TaskCreate(
  subject="Fix issue #{number}",
  description="Systematic issue resolution with parallel analysis",
  activeForm="Fixing issue #{number}"
)

# 2. Create subtasks for each phase
TaskCreate(subject="Understand the issue", activeForm="Understanding issue")
TaskCreate(subject="Analyze root cause", activeForm="Analyzing root cause")
TaskCreate(subject="Design fix approach", activeForm="Designing fix")
TaskCreate(subject="Implement fix", activeForm="Implementing fix")
TaskCreate(subject="Validate fix", activeForm="Validating fix")
TaskCreate(subject="Create PR", activeForm="Creating PR")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

---

## Phase 1: Understand the Issue

```bash
# Get full issue details
gh issue view $ARGUMENTS --json title,body,labels,assignees,comments

# Check related PRs
gh pr list --search "issue:$ARGUMENTS"
```

## Phase 2: Create Feature Branch

```bash
git checkout dev
git pull origin dev
git checkout -b issue/$ARGUMENTS-fix
```

## Phase 3: Memory Check

```python
mcp__memory__search_nodes(query="issue $ARGUMENTS")
```

## Phase 4: Parallel Analysis (5 Agents)

Launch ALL 5 agents in ONE message with `run_in_background: true`:

```python
# PARALLEL - All 5 agents in ONE message
Task(
  subagent_type="debug-investigator",
  prompt="""ROOT CAUSE ANALYSIS for issue #$ARGUMENTS

  Investigate the root cause:
  1. Trace the error from symptoms to source
  2. Identify the exact code location
  3. Determine why this code is failing

  SUMMARY: End with: "RESULT: Root cause in [file:line] - [brief explanation]"
  """,
  run_in_background=True
)
Task(
  subagent_type="debug-investigator",
  prompt="""IMPACT ANALYSIS for issue #$ARGUMENTS

  Analyze the impact:
  1. What functionality is affected?
  2. What other code depends on this?
  3. What tests need updating?

  SUMMARY: End with: "RESULT: Impacts [N] files, [M] tests - [scope]"
  """,
  run_in_background=True
)
Task(
  subagent_type="backend-system-architect",
  prompt="""BACKEND FIX DESIGN for issue #$ARGUMENTS

  Design the backend fix:
  1. What code changes are needed?
  2. API or database changes?
  3. Error handling improvements?

  SUMMARY: End with: "RESULT: Fix in [N] files - [key change]"
  """,
  run_in_background=True
)
Task(
  subagent_type="frontend-ui-developer",
  prompt="""FRONTEND FIX DESIGN for issue #$ARGUMENTS

  Design the frontend fix:
  1. Component changes needed?
  2. State management updates?
  3. Error handling improvements?

  SUMMARY: End with: "RESULT: Fix in [N] components - [key change]"
  """,
  run_in_background=True
)
Task(
  subagent_type="test-generator",
  prompt="""TEST REQUIREMENTS for issue #$ARGUMENTS

  Identify test requirements:
  1. Tests to prevent regression?
  2. Existing tests to update?
  3. Edge cases to cover?

  SUMMARY: End with: "RESULT: Add [N] tests, update [M] - [key test]"
  """,
  run_in_background=True
)
```

Wait for all agents, then synthesize into fix plan.

## Phase 5: Context7 for Patterns

```python
mcp__context7__get-library-docs(libraryId="/tiangolo/fastapi", topic="relevant")
mcp__context7__get-library-docs(libraryId="/facebook/react", topic="relevant")
```

## Phase 6: Implement the Fix (2 Agents)

| Agent | Task |
|-------|------|
| backend/frontend | Implement fix |
| code-quality-reviewer | Write tests |

Requirements:
- Make minimal, focused changes
- Add proper error handling
- Include type hints
- DO NOT over-engineer

## Phase 7: Validation

```bash
# Backend
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run ty check app/
poetry run pytest tests/unit/ -v --tb=short

# Frontend
cd frontend
npm run format:check
npm run lint
npm run typecheck
npm run test
```

## Phase 8: Commit and PR

```bash
git add .
git commit -m "fix(#$ARGUMENTS): [Brief description]"
git push -u origin issue/$ARGUMENTS-fix
gh pr create --base dev --title "fix(#$ARGUMENTS): [Brief description]"
```

## Summary

**Total Parallel Agents: 7**
- Phase 4 (Analysis): 5 agents
- Phase 6 (Implementation): 2 agents

**Agents Used:**
- 2 debug-investigator (root cause, impact)
- 1 backend-system-architect
- 1 frontend-ui-developer
- 2 code-quality-reviewer

**Workflow:**
1. Understand issue
2. Create branch
3. Parallel analysis
4. Design fix
5. Implement + test
6. Validate
7. PR with issue reference

## Related Skills
- commit: Commit issue fixes
- debug-investigator: Debug complex issues
- errors: Handle error patterns
- issue-progress-tracking: Auto-updates issue checkboxes from commits
## References

- [Commit Template](assets/commit-template.md)