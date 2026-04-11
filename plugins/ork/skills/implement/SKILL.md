---
name: implement
license: MIT
compatibility: "Claude Code 2.1.98+. Requires memory MCP server, context7 MCP server, network access."
description: "Full-power feature implementation with parallel subagents. Use when implementing, building, or creating features."
argument-hint: "[feature-description]"
context: fork
version: 2.6.0
author: OrchestKit
tags: [implementation, feature, full-stack, parallel-agents, reflection, worktree]
user-invocable: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskOutput, TaskStop, ToolSearch, CronCreate, CronDelete, Monitor, mcp__context7__query_docs, mcp__memory__search_nodes]
skills: [api-design, react-server-components-framework, testing-unit, testing-e2e, testing-integration, explore, verify, memory, scope-appropriate-architecture, chain-patterns]
complexity: medium
persuasion-type: guidance
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
triggers:
  keywords: [implement, implment, build, create, add, make, scaffold, "set up", "file upload", "dark mode", "rate limiting"]
  examples:
    - "build a user authentication system with JWT"
    - "add dark mode support to the dashboard"
    - "implement the payment webhook handler"
  anti-triggers: [fix, debug, review, explore, test, assess, brainstorm]
paths:
  - "src/**/*.{ts,tsx,js,jsx}"
  - "package.json"
  - "tsconfig.json"
  - "CLAUDE.md"
---

# Implement Feature

Parallel subagent execution for feature implementation with scope control and reflection.

## Quick Start

```bash
/ork:implement user authentication
/ork:implement --model=opus real-time notifications
/ork:implement dashboard analytics
```

---

## Argument Resolution

```python
FEATURE_DESC = "$ARGUMENTS"  # Full argument string, e.g., "user authentication"
# $ARGUMENTS[0] is the first token, $ARGUMENTS[1] second, etc. (CC 2.1.59)

# Model override detection (CC 2.1.72)
MODEL_OVERRIDE = None
for token in "$ARGUMENTS".split():
    if token.startswith("--model="):
        MODEL_OVERRIDE = token.split("=", 1)[1]  # "opus", "sonnet", "haiku"
        FEATURE_DESC = FEATURE_DESC.replace(token, "").strip()
```

Pass `MODEL_OVERRIDE` to all Agent() calls via `model=MODEL_OVERRIDE` when set. Accepts symbolic names (`opus`, `sonnet`, `haiku`) or full IDs (`claude-opus-4-6`) per CC 2.1.74.

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

## Step 0: Effort-Aware Phase Scaling (CC 2.1.76)

Read the `/effort` setting to scale implementation depth. The effort-aware context budgeting hook detects effort level automatically — adapt the phase plan accordingly:

| Effort Level | Phases Run | Agents | Token Budget |
|-------------|------------|--------|--------------|
| **low** | 1 (Discovery) → 5 (Implement) → 10 (Reflect) | 2 max | ~50K |
| **medium** | 1 → 2 → 5 → 7 (Scope Creep) → 10 | 3 max | ~150K |
| **high** (default) | All 10 phases | 4-7 | ~400K |

> **Override:** Explicit user selection in Step 0 (e.g., "Plan first" or "Worktree") overrides `/effort` downscaling. If user requests full exploration, respect that regardless of effort level.

## Step 0a: Project Context Discovery

**BEFORE any work**, detect the project tier. This becomes the complexity ceiling for all patterns.

Scan codebase signals and classify into tiers 1-6 (Interview through Open Source). Each tier sets an architecture ceiling and determines which phases/agents to use.

Load tier details, workflow mapping, and orchestration mode: `Read("${CLAUDE_SKILL_DIR}/references/tier-classification.md")`

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

**If 'Plan first' selected:**

```python
# 1. Enter read-only plan mode
EnterPlanMode("Research and design: $ARGUMENTS")

# 2. Research phase — Read/Grep/Glob ONLY, no Write/Edit
#    - Read existing code in the target area
#    - Grep for related patterns, imports, dependencies
#    - Check tests, configs, and integration points
#    - If context7 available: query library docs

# 3. Design the plan — produce:
#    - File map: which files to create/modify
#    - Architecture decisions with rationale
#    - Task breakdown with acceptance criteria
#    - Risk assessment and edge cases

# 4. Exit plan mode — returns plan to user for approval
ExitPlanMode()

# 5. User reviews plan. If approved → continue to Phase 1 (Discovery)
#    with the plan as input. If rejected → revise or stop.
```

If worktree selected:
1. Call `EnterWorktree(name: "feat-{slug}")` to create isolated branch
2. All agents work in the worktree directory
3. On completion, merge back: `git checkout {original-branch} && git merge feat-{slug}`
4. If merge conflicts arise, present diff to user via `AskUserQuestion`

Load worktree details: `Read("${CLAUDE_SKILL_DIR}/references/worktree-isolation-mode.md")`

---

## Task Management (MANDATORY)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main task IMMEDIATELY
TaskCreate(
  subject="Implement: {feature}",
  description="Feature implementation with parallel subagents",
  activeForm="Implementing {feature}"
)

# 2. Create subtasks for each phase
TaskCreate(subject="Research best practices and docs", activeForm="Researching best practices")  # id=2
TaskCreate(subject="Micro-plan: scope, files, criteria", activeForm="Micro-planning")            # id=3
TaskCreate(subject="Architecture design (parallel agents)", activeForm="Designing architecture") # id=4
TaskCreate(subject="Implement and write tests", activeForm="Implementing code")                  # id=5
TaskCreate(subject="Integration verification", activeForm="Verifying integration")               # id=6
TaskCreate(subject="Scope creep check", activeForm="Checking scope creep")                       # id=7
TaskCreate(subject="E2E verification", activeForm="Running E2E verification")                    # id=8
TaskCreate(subject="Document and reflect", activeForm="Documenting decisions")                   # id=9

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Plan needs research
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Architecture needs plan
TaskUpdate(taskId="5", addBlockedBy=["4"])  # Implementation needs architecture
TaskUpdate(taskId="6", addBlockedBy=["5"])  # Integration needs implementation
TaskUpdate(taskId="7", addBlockedBy=["6"])  # Scope creep needs integration
TaskUpdate(taskId="8", addBlockedBy=["7"])  # E2E needs scope check
TaskUpdate(taskId="9", addBlockedBy=["8"])  # Docs need E2E

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```

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

### Progressive Output (CC 2.1.76+)

Output results **incrementally** after each phase — don't batch everything until the end.

> **Focus mode (CC 2.1.101):** In focus mode (Ctrl+O), the user only sees your final message. Include a self-contained summary with all key results — don't assume they saw incremental outputs.

| After Phase | Show User |
|-------------|-----------|
| 1. Discovery | Key findings, library recommendations, task breakdown |
| 4. Architecture | Each agent's design decisions as they return |
| 5. Implementation | Files created/modified per agent, test results |
| 7. Scope Creep | Planned vs actual delta, PR split recommendation |

When agents run with `run_in_background=true`, output each agent's findings **as soon as it returns** — don't wait for all agents to finish. This gives users ~60% faster perceived feedback and enables early intervention if an agent's approach diverges from the plan.

### Monitor Tool for Background Streaming (CC 2.1.98)

Use `Monitor` to stream real-time events from background build/test scripts instead of polling output files:

```python
# Start a long-running build in background
Bash(command="npm run build 2>&1", run_in_background=true)

# Stream its output line-by-line as notifications
Monitor(pid=build_task_id)
# Each stdout line arrives as a notification — no polling needed

# For background agents with test suites:
Agent(subagent_type="test-generator", run_in_background=true, ...)
# Monitor agent progress via task notifications (CC 2.1.98 partial progress)
```

**Partial results (CC 2.1.98):** Background agents that fail now report partial progress to the parent. If a worktree-isolated agent crashes mid-implementation, synthesize its partial output instead of re-spawning:

```python
# After collecting agent results:
for agent_result in agent_results:
    if "[PARTIAL RESULT]" in agent_result.output:
        # Agent crashed mid-work — salvage what it produced
        partial_files = Bash(command="git diff --name-only", cwd=agent_result.worktree)
        if partial_files:
            # Merge partial work — commit what's usable, flag incomplete items
            TaskUpdate(taskId=agent_task_id, status="completed",
                       description=f"Partial: {len(partial_files)} files from crashed agent")
        # Do NOT re-spawn — partial progress > wasted tokens re-doing work
    elif agent_result.status == "BLOCKED":
        # Agent hit a genuine blocker — escalate to user
        TaskUpdate(taskId=agent_task_id, status="in_progress",
                   description=f"BLOCKED: {agent_result.concerns[0]}")
```

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

Phase 5 test-generator MUST produce tests matching the change type. Each change type maps to specific required tests and testing rules.

Load test matrix, real-service detection, and phase 9 gate: `Read("${CLAUDE_SKILL_DIR}/references/test-requirements-matrix.md")`

---

## Key Principles

- **Verification gate** — before claiming ANY task done, apply the 5-step gate: `Read("${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/verification-gate.md")`. "Should work now" is not evidence.
- **Agent status protocol** — all subagents report DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT per `Read("${CLAUDE_PLUGIN_ROOT}/agents/shared/status-protocol.md")`
- **Tests are NOT optional** — each task includes its tests, matched to change type (see matrix above)
- **Parallel when independent** — use `run_in_background: true`, launch all agents in ONE message
- **Output limits (CC 2.1.77+):** Opus 4.6 defaults to 64k output tokens (128k upper bound). Generate complete artifacts in a single pass when possible; chunk across turns if output exceeds the limit
- **Micro-plan before implementing** — scope boundaries, file list, acceptance criteria
- **Detect scope creep** (phase 7) — score 0-10, split PR if significant
- **Real services when available** — if docker-compose/testcontainers exist, use them in Phase 6
- **Reflect and capture lessons** (phase 10) — persist to memory graph
- **Clean up agents** — use `TeamDelete()` after completion; press `Ctrl+F` twice as manual fallback. Note: `/clear` (CC 2.1.72+) preserves background agents
- **Exit worktrees** — call `ExitWorktree(action: "keep")` in Phase 10 if worktree was entered in Step 0; never leave orphaned worktrees

---

## Next Steps (suggest to user after implementation)

```
/ork:verify {FEATURE}              # Grade the implementation
/ork:cover {FEATURE}               # Generate test suite
/ork:commit                        # Commit changes
/loop 10m npm test                 # Watch tests while iterating
/loop 30m /ork:verify {FEATURE}    # Periodic quality gate
```

## Agent Coordination

### Context Passing

All spawned agents receive: changed files list, project tier, architectural constraints, and decisions from prior phases (discovery, plan). Pass via the agent prompt, not just "implement X".

### SendMessage (Active Coordination)

When backend and frontend agents need to align on API contracts:

```python
SendMessage(to="frontend-ui-developer", message="API endpoint is POST /api/auth with {token, refreshToken} response shape")
SendMessage(to="test-generator", message="Backend uses JWT — mock auth middleware in test fixtures")
```

### Skill Chain

After implementation completes, chain to verification:

```python
TaskCreate(subject="Verify implementation", activeForm="Verifying changes", addBlockedBy=[impl_task_id])
# Then: /ork:verify {feature}
```

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
| `tier-classification.md` | Tier classification, workflow mapping, orchestration mode |
| `test-requirements-matrix.md` | Test matrix by change type, real-service detection, phase 9 gate |
