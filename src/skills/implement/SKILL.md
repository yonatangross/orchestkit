---
name: implement
license: MIT
compatibility: "Claude Code 2.1.34+. Requires memory MCP server, context7 MCP server, network access."
description: "Full-power feature implementation with parallel subagents. Use when implementing, building, or creating features."
argument-hint: "[feature-description]"
context: fork
version: 2.1.0
author: OrchestKit
tags: [implementation, feature, full-stack, parallel-agents, reflection, worktree]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, mcp__context7__query_docs, mcp__memory__search_nodes]
skills: [api-design, react-server-components-framework, type-safety-validation, testing-patterns, explore, verify, memory, worktree-coordination, scope-appropriate-architecture]
complexity: medium
metadata:
  category: workflow-automation
  mcp-server: memory, context7
---

# Implement Feature

Maximum utilization of parallel subagent execution for feature implementation with built-in scope control and reflection.

## Quick Start

```bash
/implement user authentication
/implement real-time notifications
/implement dashboard analytics
```

> **Opus 4.6**: Parallel agents leverage native adaptive thinking and 128K output for comprehensive implementations. Token budgets scale dynamically with context window.

---

## STEP 0: Project Context Discovery

**BEFORE creating tasks or doing ANY work**, detect the project tier. This becomes the **complexity ceiling** for all architecture and pattern choices.

### Auto-Detection (scan codebase)

```python
# PARALLEL — quick signals (launch all in ONE message)
Grep(pattern="take-home|assignment|interview|hackathon", glob="README*", output_mode="content")
Glob(pattern=".github/workflows/*")
Glob(pattern="**/Dockerfile")
Glob(pattern="**/terraform/**")
Glob(pattern="**/k8s/**")
Glob(pattern="CONTRIBUTING.md")
```

### Tier Classification

| Signal | Tier | Architecture Ceiling |
|--------|------|---------------------|
| README says "take-home", time limit | **1. Interview** | Flat files, no layers, 8-15 files |
| < 10 files, no CI | **2. Hackathon** | Single file if possible |
| `.github/workflows/`, managed DB | **3. MVP** | MVC monolith, managed services |
| Module boundaries, Redis, queues | **4. Growth** | Modular monolith, DI, repos |
| K8s/Terraform, monorepo | **5. Enterprise** | Hexagonal/DDD, full observability |
| CONTRIBUTING.md, LICENSE | **6. Open Source** | Minimal API, exhaustive tests |

**If confidence is low**, ask the user:

```python
AskUserQuestion(questions=[{
  "question": "What kind of project is this?",
  "header": "Project tier",
  "options": [
    {"label": "Interview / take-home", "description": "8-15 files, 200-600 LOC, simple architecture"},
    {"label": "Startup / MVP", "description": "MVC monolith, managed services, ship fast"},
    {"label": "Growth / enterprise", "description": "Modular monolith or DDD, full observability"},
    {"label": "Open source library", "description": "Minimal API surface, exhaustive tests"}
  ],
  "multiSelect": false
}])
```

**Pass the detected tier to ALL downstream agents.** Tier constrains patterns — see `scope-appropriate-architecture` for the full matrix.

### Tier-Based Workflow Adjustment

| Tier | Phases to Run | Agents | Tests |
|------|--------------|--------|-------|
| 1. Interview | 1, 5 only | 1-2 max | 8-15 focused |
| 2. Hackathon | 5 only | 1 max | None |
| 3. MVP | 1-6, 9 | 3-4 | Happy path + critical |
| 4-5. Growth/Enterprise | All 10 phases | 5-8 | Full pyramid |
| 6. Open Source | 1-7, 9-10 | 3-4 | Exhaustive public API |

> **Override:** User can always override tier. Warn of trade-offs if they choose higher than detected.

---

## STEP 0a: Verify User Intent with AskUserQuestion

**Clarify implementation scope:**

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

## STEP 0b: Select Orchestration Mode

Choose **Agent Teams** (mesh, default when available) or **Task tool** (star, fallback):
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` → Agent Teams (default); not set → Task tool
- When Teams available: complexity < 2.5 → Task tool; >= 2.5 → Agent Teams
- Override: `ORCHESTKIT_FORCE_TASK_TOOL=1` → always Task tool

> See [Orchestration Modes](references/orchestration-modes.md) for decision logic, comparison table, and fallback strategy.

---

## Opus 4.6: 128K Output Token Advantage

With 128K output tokens (2x previous 64K), agents can generate **complete artifacts in fewer passes**:

| Artifact | Before (64K) | After (128K) |
|----------|-------------|--------------|
| Full API + models | 2 passes | 1 pass |
| Component + tests | 2 passes | 1 pass |
| Complete feature (API + UI + tests) | 4-6 passes | 2-3 passes |

**Guidance for agents:** Generate complete, working code in a single pass whenever possible. Don't split implementations across multiple responses unless the scope genuinely exceeds 128K tokens. Prefer one comprehensive response over multiple incremental ones.

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

Launch all 5 agents with `run_in_background=True` and `max_turns=25`. Each agent returns a SUMMARY line.

> In Agent Teams mode, form a persistent team with teammates messaging each other. See [Agent Teams Phases](references/agent-teams-phases.md#phase-4--agent-teams-architecture-design) for spawn templates.

---

## Phase 5: Parallel Implementation (5 Agents)

With 128K output tokens, each agent produces **complete artifacts in a single pass** — no need to split backend into API + DB or frontend into components + state.

| Agent | Task | 128K Advantage |
|-------|------|----------------|
| backend-system-architect | Complete backend: API + service layer + DB models | Was 2 agents, now 1 |
| frontend-ui-developer | Complete frontend: components + state + API hooks + styling | Was 3 agents (incl. rapid-ui-designer), now 1 |
| llm-integrator | AI integration (if needed) | Unchanged |
| test-generator | Complete test suite: unit + integration + fixtures | Was split, now single pass |
| rapid-ui-designer | Design system specs + tokens (if new design) | Optional, skip if existing design |

> In Agent Teams mode, teammates transition from architecture to implementation with real-time contract messaging. See [Agent Teams Phases](references/agent-teams-phases.md#phase-5--agent-teams-implementation) for messaging patterns and worktree setup.

---

## Phase 6: Integration & Validation (4 Agents)

| Agent | Task |
|-------|------|
| backend-system-architect | Backend + database integration |
| frontend-ui-developer | Frontend + API integration |
| code-quality-reviewer #1 | Full test suite |
| security-auditor | Security audit |

> In Agent Teams mode, code-reviewer already has cumulative context. See [Agent Teams Phases](references/agent-teams-phases.md#phase-6--agent-teams-integration) for integration and [Team Teardown](references/agent-teams-phases.md#phase-6b--team-teardown-agent-teams-only) for shutdown + worktree merge.

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

Save implementation decisions to memory for future reference. Use the knowledge graph (`mcp__memory__*`) to persist decisions, patterns, and architectural choices.

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

> Task metrics, tool usage guidance, and session resume hints. See [CC Enhancements](references/cc-enhancements.md) for details.

---

## Summary

**Total Parallel Agents: 14 across 3 phases (was 17 with 64K output)**

**Tools Used:**
- context7 MCP (library documentation)
- mcp__memory__* (decision persistence)
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
- [Agent Teams Phases](references/agent-teams-phases.md)
- [Orchestration Modes](references/orchestration-modes.md)
- [CC Enhancements](references/cc-enhancements.md)
- [Agent Teams Full-Stack Pipeline](references/agent-teams-full-stack.md)
- [Team Worktree Setup](references/team-worktree-setup.md)
- [Micro-Planning Guide](references/micro-planning-guide.md)
- [Scope Creep Detection](references/scope-creep-detection.md)
- [Worktree Workflow](references/worktree-workflow.md)
