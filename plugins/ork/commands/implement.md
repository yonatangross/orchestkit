---
description: "Full-power feature implementation with parallel subagents. Use when implementing, building, or creating features."
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, mcp__context7__query_docs, mcp__memory__search_nodes]
---

# Auto-generated from skills/implement/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Implement Feature

Parallel subagent execution for feature implementation with scope control and reflection.

## Quick Start

```bash
/implement user authentication
/implement real-time notifications
/implement dashboard analytics
```


## Step 0: Project Context Discovery

**BEFORE any work**, detect the project tier. This becomes the complexity ceiling for all patterns.

### Auto-Detection

Scan codebase for signals: README keywords (take-home, interview), `.github/workflows/`, Dockerfile, terraform/, k8s/, CONTRIBUTING.md.

### Tier Classification

| Signal | Tier | Architecture Ceiling |
|--------|------|---------------------|
| README says "take-home", time limit | **1. Interview** ([details](references/interview-mode.md)) | Flat files, 8-15 files |
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
- See [Orchestration Modes](references/orchestration-modes.md)


## Task Management (MANDATORY)

Create tasks with `TaskCreate` BEFORE doing any work. Each phase gets a subtask. Update status with `TaskUpdate` as you progress.


## Workflow (10 Phases)

| Phase | Activities | Agents |
|-------|------------|--------|
| **1. Discovery** | Research best practices, Context7 docs, break into tasks | — |
| **2. Micro-Planning** | Detailed plan per task ([guide](references/micro-planning-guide.md)) | — |
| **3. Worktree** | Isolate in git worktree for 5+ file features ([workflow](references/worktree-workflow.md)) | — |
| **4. Architecture** | 5 parallel background agents | workflow-architect, backend-system-architect, frontend-ui-developer, llm-integrator, ux-researcher |
| **5. Implementation** | Parallel agents, single-pass artifacts | backend-system-architect, frontend-ui-developer, llm-integrator, test-generator, rapid-ui-designer |
| **6. Integration** | 4 parallel agents | backend, frontend, code-quality-reviewer, security-auditor |
| **7. Scope Creep** | Compare planned vs actual ([detection](references/scope-creep-detection.md)) | workflow-architect |
| **8. E2E Verification** | Browser testing with agent-browser | — |
| **9. Documentation** | Save decisions to memory graph | — |
| **10. Reflection** | Lessons learned, estimation accuracy | workflow-architect |

See [Agent Phases](references/agent-phases.md) for detailed agent prompts and spawn templates.

For Agent Teams mode, see [Agent Teams Phases](references/agent-teams-phases.md).

### Issue Tracking

If working on a GitHub issue, run the Start Work ceremony from `issue-progress-tracking` and post progress comments after major phases.

### Feedback Loop

Maintain checkpoints after each task. See [Feedback Loop](references/feedback-loop.md) for triggers and actions.


## Key Principles

- **Tests are NOT optional** — each task includes its tests
- **Parallel when independent** — use `run_in_background: true`, launch all agents in ONE message
- **128K output** — generate complete artifacts in a single pass, don't split unnecessarily
- **Micro-plan before implementing** — scope boundaries, file list, acceptance criteria
- **Detect scope creep** (phase 7) — score 0-10, split PR if significant
- **Reflect and capture lessons** (phase 10) — persist to memory graph


## Related Skills

- explore: Explore codebase before implementing
- verify: Verify implementations work correctly
- worktree-coordination: Git worktree management patterns
- issue-progress-tracking: Auto-updates GitHub issues with commit progress

## References

- [Agent Phases](references/agent-phases.md)
- [Agent Teams Phases](references/agent-teams-phases.md)
- [Interview Mode](references/interview-mode.md)
- [Orchestration Modes](references/orchestration-modes.md)
- [Feedback Loop](references/feedback-loop.md)
- [CC Enhancements](references/cc-enhancements.md)
- [Agent Teams Full-Stack Pipeline](references/agent-teams-full-stack.md)
- [Team Worktree Setup](references/team-worktree-setup.md)
- [Micro-Planning Guide](references/micro-planning-guide.md)
- [Scope Creep Detection](references/scope-creep-detection.md)
- [Worktree Workflow](references/worktree-workflow.md)
