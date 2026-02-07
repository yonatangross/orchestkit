---
description: "Full-power feature implementation with parallel subagents. Use when implementing, building, or creating features."
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, mcp__context7__query_docs, mcp__memory__search_nodes]
---

# Auto-generated from skills/implement/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Implement Feature

Maximum utilization of parallel subagent execution for feature implementation with built-in scope control and reflection.

## Quick Start

```bash
/implement user authentication
/implement real-time notifications
/implement dashboard analytics
```

> **Opus 4.6**: Parallel agents leverage native adaptive thinking and 128K output for comprehensive implementations. Token budgets scale dynamically with context window.


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


## STEP 0b: Select Orchestration Mode

Determine whether to use **Agent Teams** (mesh topology — teammates message each other) or **Task tool** (star topology — all agents report to lead):

1. If `ORCHESTKIT_PREFER_TEAMS=1` env var is set → **Agent Teams mode**
2. If Agent Teams is unavailable (no `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) → **Task tool mode** (current default)
3. Otherwise, assess complexity (use `/ork:assess-complexity` or estimate):
   - Average < 3.0 → **Task tool** (cheaper, simpler)
   - Average 3.0–3.5 → **Ask user** (recommend Teams for cross-cutting work)
   - Average > 3.5 → **Agent Teams** (if enabled)

```python
# Check mode
import os
prefer_teams = os.environ.get("ORCHESTKIT_PREFER_TEAMS") == "1"
teams_available = os.environ.get("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS") is not None

if prefer_teams and teams_available:
    mode = "agent_teams"
elif not teams_available:
    mode = "task_tool"
else:
    # Assess complexity, then decide
    mode = "agent_teams" if avg_complexity > 3.5 else "task_tool"
```

**Key differences:**

| Aspect | Task Tool (star) | Agent Teams (mesh) |
|--------|------------------|--------------------|
| Communication | All agents report to lead only | Teammates message each other |
| API contract | Lead relays between agents | Backend messages frontend directly |
| Cost | ~500K tokens (full-stack) | ~1.2M tokens (full-stack) |
| Wall-clock | Sequential phases | Overlapping (30-40% faster) |
| Quality review | After all agents complete | Continuous (reviewer on team) |
| Best for | Independent tasks, low complexity | Cross-cutting features, high complexity |

> **Fallback:** If Agent Teams mode encounters issues (teammate failures, messaging problems), fall back to Task tool mode for remaining phases. The approaches are compatible — work done in Teams mode transfers to Task tool continuation.


## Opus 4.6: 128K Output Token Advantage

With 128K output tokens (2x previous 64K), agents can generate **complete artifacts in fewer passes**:

| Artifact | Before (64K) | After (128K) |
|----------|-------------|--------------|
| Full API + models | 2 passes | 1 pass |
| Component + tests | 2 passes | 1 pass |
| Complete feature (API + UI + tests) | 4-6 passes | 2-3 passes |

**Guidance for agents:** Generate complete, working code in a single pass whenever possible. Don't split implementations across multiple responses unless the scope genuinely exceeds 128K tokens. Prefer one comprehensive response over multiple incremental ones.


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


## Phase 2: Micro-Planning Per Task

**Goal:** Create detailed mini-plans for each task BEFORE implementation.

For each task, create scope boundaries, file list, and acceptance criteria.

See [Micro-Planning Guide](references/micro-planning-guide.md) for template.


## Phase 3: Git Worktree Isolation (Optional)

**Goal:** Isolate feature work in a dedicated worktree for large features (5+ files).

See [Worktree Workflow](references/worktree-workflow.md) for setup and cleanup commands.


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

### Phase 4 — Agent Teams Alternative

In Agent Teams mode, form a team instead of spawning 5 independent Tasks. Teammates message architecture decisions to each other in real-time:

```python
TeamCreate(team_name="implement-{feature-slug}", description="Architecture for {feature}")

# Spawn 4 teammates (5th role — UX — is lead-managed or optional)
Task(subagent_type="backend-system-architect", name="backend-architect",
     team_name="implement-{feature-slug}",
     prompt="Design backend architecture. Message frontend-dev when API contract ready.")

Task(subagent_type="frontend-ui-developer", name="frontend-dev",
     team_name="implement-{feature-slug}",
     prompt="Design frontend architecture. Wait for API contract from backend-architect.")

Task(subagent_type="test-generator", name="test-engineer",
     team_name="implement-{feature-slug}",
     prompt="Plan test strategy. Start fixtures immediately, tests as contracts stabilize.")

Task(subagent_type="code-quality-reviewer", name="code-reviewer",
     team_name="implement-{feature-slug}",
     prompt="Review architecture decisions as they're shared. Flag issues to author directly.")
```

See [Agent Teams Full-Stack Pipeline](references/agent-teams-full-stack.md) for complete spawn prompts and messaging templates.

> **Fallback:** If team formation fails, fall back to 5 independent Task spawns (standard Phase 4 above).


## Phase 5: Parallel Implementation (5 Agents)

With 128K output tokens, each agent produces **complete artifacts in a single pass** — no need to split backend into API + DB or frontend into components + state.

| Agent | Task | 128K Advantage |
|-------|------|----------------|
| backend-system-architect | Complete backend: API + service layer + DB models | Was 2 agents, now 1 |
| frontend-ui-developer | Complete frontend: components + state + API hooks + styling | Was 3 agents (incl. rapid-ui-designer), now 1 |
| llm-integrator | AI integration (if needed) | Unchanged |
| test-generator | Complete test suite: unit + integration + fixtures | Was split, now single pass |
| rapid-ui-designer | Design system specs + tokens (if new design) | Optional, skip if existing design |

### Phase 5 — Agent Teams Alternative

In Agent Teams mode, teammates are already formed from Phase 4. They transition from architecture to implementation and message contracts to each other:

- **backend-architect** implements the API and messages `frontend-dev` with the contract (types + routes) as soon as endpoints are defined — not after full implementation.
- **frontend-dev** starts building UI layout immediately, then integrates API hooks once the contract arrives.
- **test-engineer** writes tests incrementally as contracts stabilize. Reports failing tests directly to the responsible teammate.
- **code-reviewer** reviews code as it lands. Flags issues to the author directly.

Optionally set up per-teammate worktrees to prevent file conflicts:

```python
# Lead sets up worktrees (for features with > 5 files)
Bash("git worktree add ../{project}-backend feat/{feature}/backend")
Bash("git worktree add ../{project}-frontend feat/{feature}/frontend")
Bash("git worktree add ../{project}-tests feat/{feature}/tests")

# Include worktree path in teammate messages
SendMessage(type="message", recipient="backend-architect",
    content="Work in ../{project}-backend/. Commit to feat/{feature}/backend.")
```

See [Team Worktree Setup](references/team-worktree-setup.md) for complete worktree guide.

> **Fallback:** If teammate coordination breaks down, shut down the team and fall back to 5 independent Task spawns (standard Phase 5 above).


## Phase 6: Integration & Validation (4 Agents)

| Agent | Task |
|-------|------|
| backend-system-architect | Backend + database integration |
| frontend-ui-developer | Frontend + API integration |
| code-quality-reviewer #1 | Full test suite |
| security-auditor | Security audit |

### Phase 6 — Agent Teams Alternative

In Agent Teams mode, the code-reviewer teammate has already been reviewing code during implementation (Phase 5). Integration verification is lighter:

- **code-reviewer** produces final APPROVE/REJECT verdict based on cumulative review.
- **Lead** runs integration tests across the merged codebase (or merged worktrees).
- No need for separate security-auditor spawn — code-reviewer covers security checks. For high-risk features, spawn a `security-auditor` teammate in Phase 4.

```python
# Lead runs integration after merging worktrees
Bash("npm test && npm run typecheck && npm run lint")

# Collect code-reviewer verdict
SendMessage(type="message", recipient="code-reviewer",
    content="All code merged. Please provide final APPROVE/REJECT verdict.")
```

> **Fallback:** If code-reviewer verdict is unclear, fall back to 4 independent Task spawns (standard Phase 6 above).


## Phase 6b: Team Teardown (Agent Teams Only)

After Phase 6 completes in Agent Teams mode, tear down the team:

### 1. Merge Worktrees (if used)

```bash
git checkout feat/{feature}
git merge --squash feat/{feature}/backend && git commit -m "feat({feature}): backend"
git merge --squash feat/{feature}/frontend && git commit -m "feat({feature}): frontend"
git merge --squash feat/{feature}/tests && git commit -m "test({feature}): test suite"
```

### 2. Shut Down Teammates

```python
SendMessage(type="shutdown_request", recipient="backend-architect",
    content="Implementation complete, shutting down team.")
SendMessage(type="shutdown_request", recipient="frontend-dev",
    content="Implementation complete, shutting down team.")
SendMessage(type="shutdown_request", recipient="test-engineer",
    content="Implementation complete, shutting down team.")
SendMessage(type="shutdown_request", recipient="code-reviewer",
    content="Implementation complete, shutting down team.")
```

### 3. Clean Up

```python
TeamDelete()  # Remove team and shared task list

# Clean up worktrees (if used)
Bash("git worktree remove ../{project}-backend")
Bash("git worktree remove ../{project}-frontend")
Bash("git worktree remove ../{project}-tests")
Bash("git branch -d feat/{feature}/backend feat/{feature}/frontend feat/{feature}/tests")
```

> Phases 7-10 (Scope Creep, E2E Verification, Documentation, Reflection) are the same in both modes — the team is already disbanded.


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


## Phase 10: Post-Implementation Reflection

**Goal:** Capture lessons learned while context is fresh.

Launch `workflow-architect` to evaluate:
- What went well / what to improve
- Estimation accuracy (actual vs planned)
- Reusable patterns to extract
- Technical debt created
- Knowledge gaps discovered

Store lessons in memory for future implementations.


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


## Summary

**Total Parallel Agents: 14 across 3 phases (was 17 with 64K output)**

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


## Related Skills
- explore: Explore codebase before implementing
- verify: Verify implementations work correctly
- worktree-coordination: Git worktree management patterns

## References

- [Agent Phases](references/agent-phases.md)
