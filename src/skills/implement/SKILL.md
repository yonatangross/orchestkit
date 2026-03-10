---
name: implement
license: MIT
compatibility: "Claude Code 2.1.72+. Requires memory MCP server, context7 MCP server, network access."
description: "Full-power feature implementation with parallel subagents. Use when implementing, building, or creating features."
argument-hint: "[feature-description]"
context: fork
version: 2.4.0
author: OrchestKit
tags: [implementation, feature, full-stack, parallel-agents, reflection, worktree]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskOutput, TaskStop, ToolSearch, CronCreate, CronDelete, mcp__context7__query_docs, mcp__memory__search_nodes]
skills: [api-design, react-server-components-framework, testing-unit, testing-e2e, testing-integration, explore, verify, memory, scope-appropriate-architecture, chain-patterns]
complexity: medium
model: sonnet
hooks:
  PreToolUse:
    - matcher: "Write"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/project-convention-loader"
      once: true
    - matcher: "Agent"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/implement-standards-loader"
      once: true
  PostToolUse:
    - matcher: "Write|Edit"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/pattern-consistency-enforcer"
metadata:
  category: workflow-automation
  mcp-server: memory, context7
---

# Implement Feature

Parallel subagent execution for feature implementation with scope control and reflection.

## Quick Start

```bash
/ork:implement user authentication
/ork:implement real-time notifications
/ork:implement dashboard analytics
```

---

## Argument Resolution

```python
FEATURE_DESC = "$ARGUMENTS"  # Full argument string, e.g., "user authentication"
# $ARGUMENTS[0] is the first token, $ARGUMENTS[1] second, etc. (CC 2.1.59)
```

---

## Step -1: MCP Probe + Resume Check

**Run BEFORE any other step.** Detect available MCP servers and check for resumable state.

```python
# Probe MCPs (parallel — all in ONE message):
ToolSearch(query="select:mcp__memory__search_nodes")
ToolSearch(query="select:mcp__context7__resolve-library-id")

Write(".claude/chain/capabilities.json", JSON.stringify({
  "memory": <true if found>,
  "context7": <true if found>,
  "timestamp": now()
}))

# Resume check:
Read(".claude/chain/state.json")
# If exists and skill == "implement":
#   Read last handoff (e.g., 04-architecture.json)
#   Skip to current_phase
#   "Resuming from Phase {N} — architecture decided in previous session"
# If not: write initial state
Write(".claude/chain/state.json", JSON.stringify({
  "skill": "implement", "feature": FEATURE_DESC,
  "current_phase": 1, "completed_phases": [],
  "capabilities": capabilities
}))
```

> Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/checkpoint-resume.md")`

---

## Step 0: Project Context Discovery

**BEFORE any work**, detect the project tier. This becomes the complexity ceiling for all patterns.

### Auto-Detection

Scan codebase for signals: README keywords (take-home, interview), `.github/workflows/`, Dockerfile, terraform/, k8s/, CONTRIBUTING.md.

### Tier Classification

| Signal | Tier | Architecture Ceiling |
|--------|------|---------------------|
| README says "take-home", time limit | **1. Interview** (load `${CLAUDE_SKILL_DIR}/references/interview-mode.md`) | Flat files, 8-15 files |
| < 10 files, no CI | **2. Hackathon** | Single file if possible |
| `.github/workflows/`, managed DB | **3. MVP** | MVC monolith |
| Module boundaries, Redis, queues | **4. Growth** | Modular monolith, DI |
| K8s/Terraform, monorepo | **5. Enterprise** | Hexagonal/DDD |
| CONTRIBUTING.md, LICENSE | **6. Open Source** | Minimal API, exhaustive tests |

If confidence is low, use `AskUserQuestion` to ask the user. Pass detected tier to ALL downstream agents — see `scope-appropriate-architecture`.

### Tier → Workflow Mapping

| Tier | Phases | Max Agents |
|------|--------|-----------|
| 1. Interview | 1, 5 only | 2 |
| 2. Hackathon | 5 only | 1 |
| 3. MVP | 1-6, 9 | 3-4 |
| 4-5. Growth/Enterprise | All 10 | 5-8 |
| 6. Open Source | 1-7, 9-10 | 3-4 |

Use `AskUserQuestion` to verify scope (full-stack / backend-only / frontend-only / prototype) and constraints.

### Orchestration Mode

- Agent Teams (mesh) when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and complexity >= 2.5
- Task tool (star) otherwise; `ORCHESTKIT_FORCE_TASK_TOOL=1` to override
- Load orchestration modes: `Read("${CLAUDE_SKILL_DIR}/references/orchestration-modes.md")`

### Worktree Isolation (CC 2.1.49)

For features touching 5+ files, offer worktree isolation to prevent conflicts with the main working tree:

```python
AskUserQuestion(questions=[{
  "question": "Isolate this feature in a git worktree?",
  "header": "Isolation",
  "options": [
    {"label": "Yes — worktree (Recommended)", "description": "Creates isolated branch via EnterWorktree, merges back on completion", "markdown": "```\nWorktree Isolation\n──────────────────\nmain ─────────────────────────────▶\n  \\                              /\n   └─ feat-{slug} (worktree) ───┘\n      ├── Isolated directory\n      ├── Own branch + index\n      └── Auto-merge on completion\n\nSafe: main stays untouched until done\n```"},
    {"label": "No — work in-place", "description": "Edit files directly in current branch", "markdown": "```\nIn-Place Editing\n────────────────\nmain ──[edit]──[edit]──[edit]───▶\n       ▲       ▲       ▲\n       │       │       │\n     direct modifications\n\nFast: no branch overhead\nRisk: changes visible immediately\n```"},
    {"label": "Plan first", "description": "Research and design in plan mode before writing code", "markdown": "```\nPlan Mode Flow\n──────────────\n  1. EnterPlanMode($ARGUMENTS)\n  2. Read existing code\n  3. Research patterns\n  4. Design approach\n  5. ExitPlanMode → plan\n  6. User approves plan\n  7. Execute implementation\n\n  Best for: Large features,\n  unfamiliar codebases,\n  architectural decisions\n```"}
  ],
  "multiSelect": false
}])
```

**If 'Plan first' selected:** Call `EnterPlanMode("Research and design: $ARGUMENTS")`, perform research using Read/Grep/Glob only, then `ExitPlanMode` with the plan for user approval before proceeding.

If worktree selected:
1. Call `EnterWorktree(name: "feat-{slug}")` to create isolated branch
2. All agents work in the worktree directory
3. On completion, merge back: `git checkout {original-branch} && git merge feat-{slug}`
4. If merge conflicts arise, present diff to user via `AskUserQuestion`

Load worktree details: `Read("${CLAUDE_SKILL_DIR}/references/worktree-isolation-mode.md")`

---

## Task Management (MANDATORY)

Create tasks with `TaskCreate` BEFORE doing any work. Each phase gets a subtask. Update status with `TaskUpdate` as you progress.

---

## Workflow (10 Phases)

| Phase | Activities | Agents |
|-------|------------|--------|
| **1. Discovery** | Research best practices, Context7 docs, break into tasks | — |
| **2. Micro-Planning** | Detailed plan per task (load `${CLAUDE_SKILL_DIR}/references/micro-planning-guide.md`) | — |
| **3. Worktree** | Isolate in git worktree for 5+ file features (load `${CLAUDE_SKILL_DIR}/references/worktree-workflow.md`) | — |
| **4. Architecture** | 4 parallel background agents | workflow-architect, backend-system-architect, frontend-ui-developer, llm-integrator |
| **5. Implementation + Tests** | Parallel agents, single-pass artifacts with mandatory tests | backend-system-architect, frontend-ui-developer, llm-integrator, test-generator |
| **6. Integration Verification** | Code review + real-service integration tests | backend, frontend, code-quality-reviewer, security-auditor |
| **7. Scope Creep** | Compare planned vs actual (load `${CLAUDE_SKILL_DIR}/references/scope-creep-detection.md`) | workflow-architect |
| **8. E2E Verification** | Browser + API E2E testing (load `${CLAUDE_SKILL_DIR}/references/e2e-verification.md`) | — |
| **9. Documentation** | Save decisions to memory graph | — |
| **10. Reflection** | Lessons learned, estimation accuracy | workflow-architect |

Load agent prompts: `Read("${CLAUDE_SKILL_DIR}/references/agent-phases.md")`

For Agent Teams mode: `Read("${CLAUDE_SKILL_DIR}/references/agent-teams-phases.md")`

### Phase Handoffs (CC 2.1.71)

Write handoff JSON after major phases. See `chain-patterns` skill for schema.

| After Phase | Handoff File | Key Outputs |
|-------------|-------------|-------------|
| 1. Discovery | `01-discovery.json` | Best practices, library docs, task breakdown |
| 2. Micro-Plan | `02-plan.json` | File map, acceptance criteria per task |
| 4. Architecture | `04-architecture.json` | Decisions, patterns chosen, agent results |
| 5. Implementation | `05-implementation.json` | Files created/modified, test results |
| 7. Scope Creep | `07-scope.json` | Planned vs actual, PR split recommendation |

### Worktree-Isolated Implementation (CC 2.1.50)

Phase 5 agents SHOULD use `isolation: "worktree"` to prevent file conflicts:

```python
Agent(subagent_type="backend-system-architect",
  prompt="Implement backend: {feature}. Architecture: {from 04-architecture.json}",
  isolation="worktree", run_in_background=true)
Agent(subagent_type="frontend-ui-developer",
  prompt="Implement frontend: {feature}...",
  isolation="worktree", run_in_background=true)
Agent(subagent_type="test-generator",
  prompt="Generate tests: {feature}...",
  isolation="worktree", run_in_background=true)
```

### Post-Deploy Monitoring (CC 2.1.71)

After final PR, schedule health monitoring:

```python
# Guard: Skip cron in headless/CI (CLAUDE_CODE_DISABLE_CRON)
# if env CLAUDE_CODE_DISABLE_CRON is set, run a single check instead
CronCreate(
  schedule="0 */6 * * *",
  prompt="Health check for {feature} in PR #{pr}:
    gh pr checks {pr} --repo {repo}.
    If healthy 24h → CronDelete. If errors → alert."
)
```

### context7 with Detection

```python
if capabilities.context7:
  mcp__context7__resolve-library-id({ libraryName: "next-auth" })
  mcp__context7__query-docs({ libraryId: "...", query: "..." })
else:
  WebFetch("https://docs.example.com/api")  # T1 fallback
```

### Issue Tracking

If working on a GitHub issue, run the Start Work ceremony from `issue-progress-tracking` and post progress comments after major phases.

### Feedback Loop

Maintain checkpoints after each task. Load triggers: `Read("${CLAUDE_SKILL_DIR}/references/feedback-loop.md")`

---

## Test Requirements Matrix

Phase 5 test-generator MUST produce tests matching the change type:

| Change Type | Required Tests | Testing Rules |
|-------------|---------------|--------------------------|
| API endpoint | Unit + Integration + Contract | `integration-api`, `verification-contract`, `mocking-msw` |
| DB schema/migration | Migration + Integration | `integration-database`, `data-seeding-cleanup` |
| UI component | Unit + Snapshot + A11y | `unit-aaa-pattern`, `integration-component`, `a11y-testing`, `e2e-playwright` |
| Business logic | Unit + Property-based | `unit-aaa-pattern`, `pytest-execution`, `verification-techniques` |
| LLM/AI feature | Unit + Eval | `llm-evaluation`, `llm-mocking` |
| Full-stack feature | All of the above | All matching rules |

### Real-Service Detection (Phase 6)

Before running integration tests, detect infrastructure:

```python
# Auto-detect real service testing capability (PARALLEL)
Glob(pattern="**/docker-compose*.yml")
Glob(pattern="**/testcontainers*")
Grep(pattern="testcontainers|docker-compose", glob="requirements*.txt")
Grep(pattern="testcontainers|docker-compose", glob="package.json")
```

If detected: run integration tests against real services, not just mocks. Reference `testing-integration` rules: `integration-database`, `integration-api`, `data-seeding-cleanup`.

### Phase 9 Gate

**Do NOT proceed to Phase 9 (Documentation) if test-generator produced 0 tests.** Return to Phase 5 and generate tests for the implemented code.

---

## Key Principles

- **Tests are NOT optional** — each task includes its tests, matched to change type (see matrix above)
- **Parallel when independent** — use `run_in_background: true`, launch all agents in ONE message
- **128K output** — generate complete artifacts in a single pass, don't split unnecessarily
- **Micro-plan before implementing** — scope boundaries, file list, acceptance criteria
- **Detect scope creep** (phase 7) — score 0-10, split PR if significant
- **Real services when available** — if docker-compose/testcontainers exist, use them in Phase 6
- **Reflect and capture lessons** (phase 10) — persist to memory graph
- **Clean up agents** — use `TeamDelete()` after completion; press `Ctrl+F` twice as manual fallback. Note: `/clear` (CC 2.1.72+) preserves background agents

---

## Related Skills

- `ork:explore`: Explore codebase before implementing
- `ork:verify`: Verify implementations work correctly
- `ork:issue-progress-tracking`: Auto-updates GitHub issues with commit progress

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `agent-phases.md` | Agent prompts and spawn templates |
| `agent-teams-phases.md` | Agent Teams mode phases |
| `interview-mode.md` | Interview/take-home constraints |
| `orchestration-modes.md` | Task tool vs Agent Teams selection |
| `feedback-loop.md` | Checkpoint triggers and actions |
| `cc-enhancements.md` | CC version-specific features |
| `agent-teams-full-stack.md` | Full-stack pipeline for teams |
| `team-worktree-setup.md` | Team worktree configuration |
| `micro-planning-guide.md` | Detailed micro-planning guide |
| `scope-creep-detection.md` | Planned vs actual comparison |
| `worktree-workflow.md` | Git worktree workflow |
| `e2e-verification.md` | Browser + API E2E testing guide |
| `worktree-isolation-mode.md` | Worktree isolation details |
