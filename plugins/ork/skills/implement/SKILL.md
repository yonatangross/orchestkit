---
name: implement
description: "Full-power feature implementation with parallel subagents. Use when implementing, building, or creating features."
context: fork
version: 2.1.0
author: OrchestKit
tags: [implementation, feature, full-stack, parallel-agents, reflection, worktree]
user-invocable: true
allowedTools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, mcp__context7__query_docs, mcp__memory__search_nodes]
skills: [api-design-framework, react-server-components-framework, type-safety-validation, unit-testing, integration-testing, explore, verify, memory, worktree-coordination]
---

# Implement Feature

Maximum utilization of parallel subagent execution for feature implementation with built-in scope control and reflection.

## Quick Start

```bash
/implement user authentication
/implement real-time notifications
/implement dashboard analytics
```

---

## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks or doing ANY work**, ask the user to clarify scope:

```python
AskUserQuestion(
  questions=[
    {
      "question": "What scope for this implementation?",
      "header": "Scope",
      "options": [
        {"label": "Full-stack (Recommended)", "description": "Backend + frontend + tests + docs"},
        {"label": "Backend only", "description": "API + database + backend tests"},
        {"label": "Frontend only", "description": "UI components + state + frontend tests"},
        {"label": "Quick prototype", "description": "Minimal working version, skip tests"}
      ],
      "multiSelect": false
    },
    {
      "question": "Any constraints I should know about?",
      "header": "Constraints",
      "options": [
        {"label": "None (Recommended)", "description": "Use best practices and modern patterns"},
        {"label": "Match existing patterns", "description": "Follow existing codebase conventions exactly"},
        {"label": "Minimal dependencies", "description": "Avoid adding new packages"},
        {"label": "Specific tech stack", "description": "I'll specify the technologies to use"}
      ],
      "multiSelect": false
    }
  ]
)
```

**Based on user's answers, adjust the workflow:**
- **Full-stack**: All 10 phases, all parallel agents
- **Backend only**: Skip frontend agents (phases 5b, 6b)
- **Frontend only**: Skip backend agents (phases 5a, 6a)
- **Quick prototype**: Skip phases 7-10 (scope check, verification, docs, reflection)

---

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main implementation task IMMEDIATELY
TaskCreate(
  subject="Implement: {feature}",
  description="Full-stack implementation with parallel agents",
  activeForm="Implementing {feature}"
)

# 2. Create subtasks for each phase (10-phase process)
TaskCreate(subject="Research best practices", activeForm="Researching best practices")
TaskCreate(subject="Design architecture", activeForm="Designing architecture")
TaskCreate(subject="Micro-plan each task", activeForm="Creating micro-plans")
TaskCreate(subject="Setup git worktree (optional)", activeForm="Setting up worktree")
TaskCreate(subject="Implement backend", activeForm="Implementing backend")
TaskCreate(subject="Implement frontend", activeForm="Implementing frontend")
TaskCreate(subject="Write tests", activeForm="Writing tests")
TaskCreate(subject="Integration verification", activeForm="Verifying integration")
TaskCreate(subject="Scope creep check", activeForm="Checking for scope creep")
TaskCreate(subject="Post-implementation reflection", activeForm="Reflecting on implementation")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

---

## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Discovery & Planning** | Research, break into tasks | Task list |
| **2. Micro-Planning** | Detailed plan per task | Micro-plans |
| **3. Worktree Setup** | Isolate in git worktree (optional) | Clean workspace |
| **4. Architecture Design** | 5 parallel agents | Design specs |
| **5. Implementation** | 8 parallel agents | Working code |
| **6. Integration & Validation** | 4 parallel agents | Tested code |
| **7. Scope Creep Check** | Compare vs original scope | Scope report |
| **8. E2E Verification** | Browser testing | Evidence |
| **9. Documentation** | Save decisions to memory | Persisted knowledge |
| **10. Reflection** | What worked, what didn't | Lessons learned |

---

## Phase 1: Discovery & Planning

### 1a. Create Task List

Break into small, deliverable, testable tasks:
- Each task completable in one focused session
- Each task MUST include its tests
- Group by domain (frontend, backend, AI, shared)

### 1b. Research Current Best Practices

```python
# PARALLEL - Web searches (launch all in ONE message)
WebSearch("React 19 best practices 2026")
WebSearch("FastAPI async patterns 2026")
WebSearch("TypeScript 5.x strict mode 2026")
```

### 1c. Context7 Documentation

```python
# PARALLEL - Library docs (launch all in ONE message)
mcp__context7__query_docs(libraryId="/vercel/next.js", query="app router")
mcp__context7__query_docs(libraryId="/tiangolo/fastapi", query="dependencies")
```

---

## Phase 2: Micro-Planning Per Task

**Goal:** Create detailed mini-plans for each task BEFORE implementation.

For each task, create scope boundaries, file list, and acceptance criteria.

See [Micro-Planning Guide](references/micro-planning-guide.md) for template.

---

## Phase 3: Git Worktree Isolation (Optional)

**Goal:** Isolate feature work in a dedicated worktree for large features (5+ files).

See [Worktree Workflow](references/worktree-workflow.md) for setup and cleanup commands.

---

## Phase 4: Parallel Architecture Design (5 Agents)

Launch ALL 5 agents in ONE Task message with `run_in_background: true`:

| Agent | Focus |
|-------|-------|
| workflow-architect | Architecture planning, dependency graph |
| backend-system-architect | API, services, database |
| frontend-ui-developer | Components, state, hooks |
| llm-integrator | LLM integration (if needed) |
| ux-researcher | User experience, accessibility |

Launch all 5 agents with `run_in_background=True`. Each agent returns a SUMMARY line.

## Phase 5: Parallel Implementation (8 Agents)

| Agent | Task |
|-------|------|
| backend-system-architect #1 | API endpoints |
| backend-system-architect #2 | Database layer |
| frontend-ui-developer #1 | UI components |
| frontend-ui-developer #2 | State & API hooks |
| llm-integrator | AI integration |
| rapid-ui-designer | Styling |
| test-generator #1 | Test suite |
| prioritization-analyst | Progress tracking |

## Phase 6: Integration & Validation (4 Agents)

| Agent | Task |
|-------|------|
| backend-system-architect | Backend + database integration |
| frontend-ui-developer | Frontend + API integration |
| code-quality-reviewer #1 | Full test suite |
| security-auditor | Security audit |

---

## Phase 7: Scope Creep Detection

**Goal:** Compare implementation against original scope (0-10 score).

Launch `workflow-architect` to compare planned vs actual files/features.

| Score | Level | Action |
|-------|-------|--------|
| 0-2 | Minimal | Proceed to reflection |
| 3-5 | Moderate | Document and justify unplanned changes |
| 6-8 | Significant | Review with user, potentially split PR |
| 9-10 | Major | Stop and reassess |

See [Scope Creep Detection](references/scope-creep-detection.md) for agent prompt.

---

## Phase 8: E2E Verification

If UI changes, verify with agent-browser:

```bash
agent-browser open http://localhost:5173
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser screenshot /tmp/feature.png
agent-browser close
```

## Phase 9: Documentation

Save implementation decisions to mem0 for future reference:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/src/skills/mem0-memory/scripts/crud/add-memory.py \
  --text "Implementation decisions..." \
  --user-id "project-decisions" \
  --metadata '{"scope":"project-decisions","category":"implementation"}'
```

---

## Phase 10: Post-Implementation Reflection

**Goal:** Capture lessons learned while context is fresh.

Launch `workflow-architect` to evaluate:
- What went well / what to improve
- Estimation accuracy (actual vs planned)
- Reusable patterns to extract
- Technical debt created
- Knowledge gaps discovered

Store lessons in memory for future implementations.

---

## Continuous Feedback Loop (NEW)

Throughout implementation, maintain a feedback loop:

### After Each Task Completion

```python
# Quick checkpoint after each task
print(f"""
TASK CHECKPOINT: {task_name}
- Completed: {what_was_done}
- Tests: {pass/fail}
- Time: {actual} vs {estimated}
- Blockers: {any issues}
- Scope changes: {any deviations}
""")

# Update task status
TaskUpdate(taskId=task_id, status="completed")
```

### Feedback Triggers

| Trigger | Action |
|---------|--------|
| Task takes 2x estimated time | Pause, reassess scope |
| Test keeps failing | Consider design issue, not just implementation |
| Scope creep detected | Stop, discuss with user |
| Blocker found | Create blocking task, switch to parallel work |

---

## CC 2.1.30+ Enhancements

### Task Metrics

Task tool results now include `token_count`, `tool_uses`, and `duration_ms`. Use for scope monitoring:

```markdown
## Phase 5 Metrics (Implementation)
| Agent | Tokens | Tools | Duration |
|-------|--------|-------|----------|
| backend-system-architect #1 | 680 | 15 | 25s |
| backend-system-architect #2 | 540 | 12 | 20s |
| frontend-ui-developer #1 | 720 | 18 | 30s |

**Scope Check:** If token_count > 80% of budget, flag scope creep
```

### Tool Usage Guidance (CC 2.1.31)

Use the right tools for each operation:

| Task | Use | Avoid |
|------|-----|-------|
| Find files by pattern | `Glob("**/*.ts")` | `bash find` |
| Search code | `Grep(pattern="...", glob="*.ts")` | `bash grep` |
| Read specific file | `Read(file_path="/abs/path")` | `bash cat` |
| Edit/modify code | `Edit(file_path=...)` | `bash sed/awk` |
| Parse file contents | `Read` with limit/offset | `bash head/tail` |
| Git operations | `Bash git ...` | (git needs bash) |
| Run tests/build | `Bash npm/poetry ...` | (CLIs need bash) |

### Session Resume Hints (CC 2.1.31)

Before ending implementation sessions, capture context:

```bash
/ork:remember Implementation of {feature}:
  Completed: phases 1-6
  Remaining: verification, docs
  Key decisions: [list]
  Blockers: [if any]
```

Resume later with full context preserved.

---

## Summary

**Total Parallel Agents: 17 across 4 phases**

**Tools Used:**
- context7 MCP (library documentation)
- mem0 MCP (decision persistence)
- agent-browser CLI (E2E verification)

**Key Principles:**
- Tests are NOT optional
- Parallel when independent (use `run_in_background: true`)
- CC 2.1.6 auto-loads skills from agent frontmatter
- Evidence-based completion
- Micro-plan before implementing
- Detect and address scope creep
- Reflect and capture lessons learned

---

## Related Skills
- explore: Explore codebase before implementing
- verify: Verify implementations work correctly
- worktree-coordination: Git worktree management patterns

## References

- [Agent Phases](references/agent-phases.md)
