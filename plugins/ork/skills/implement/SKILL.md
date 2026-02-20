---
name: implement
license: MIT
compatibility: "Claude Code 2.1.47+. Requires memory MCP server, context7 MCP server, network access."
description: "Full-power feature implementation with parallel subagents. Use when implementing, building, or creating features."
argument-hint: "[feature-description]"
context: fork
version: 2.3.0
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

Parallel subagent execution for feature implementation with scope control and reflection.

## Quick Start

```bash
/ork:implement user authentication
/ork:implement real-time notifications
/ork:implement dashboard analytics
```

---

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

### Worktree Isolation (CC 2.1.49)

For features touching 5+ files, offer worktree isolation to prevent conflicts with the main working tree:

```python
AskUserQuestion(questions=[{
  "question": "Isolate this feature in a git worktree?",
  "header": "Isolation",
  "options": [
    {"label": "Yes — worktree (Recommended)", "description": "Creates isolated branch via EnterWorktree, merges back on completion"},
    {"label": "No — work in-place", "description": "Edit files directly in current branch"}
  ],
  "multiSelect": false
}])
```

If worktree selected:
1. Call `EnterWorktree(name: "feat-{slug}")` to create isolated branch
2. All agents work in the worktree directory
3. On completion, merge back: `git checkout {original-branch} && git merge feat-{slug}`
4. If merge conflicts arise, present diff to user via `AskUserQuestion`

See [Worktree Isolation Mode](references/worktree-isolation-mode.md) for detailed workflow.

---

## Task Management (MANDATORY)

Create tasks with `TaskCreate` BEFORE doing any work. Each phase gets a subtask. Update status with `TaskUpdate` as you progress.

---

## Workflow (10 Phases)

| Phase | Activities | Agents |
|-------|------------|--------|
| **1. Discovery** | Research best practices, Context7 docs, break into tasks | — |
| **2. Micro-Planning** | Detailed plan per task ([guide](references/micro-planning-guide.md)) | — |
| **3. Worktree** | Isolate in git worktree for 5+ file features ([workflow](references/worktree-workflow.md)) | — |
| **4. Architecture** | 5 parallel background agents | workflow-architect, backend-system-architect, frontend-ui-developer, llm-integrator, ux-researcher |
| **5. Implementation + Tests** | Parallel agents, single-pass artifacts with mandatory tests | backend-system-architect, frontend-ui-developer, llm-integrator, test-generator, rapid-ui-designer |
| **6. Integration Verification** | Code review + real-service integration tests | backend, frontend, code-quality-reviewer, security-auditor |
| **7. Scope Creep** | Compare planned vs actual ([detection](references/scope-creep-detection.md)) | workflow-architect |
| **8. E2E Verification** | Browser + API E2E testing ([guide](references/e2e-verification.md)) | — |
| **9. Documentation** | Save decisions to memory graph | — |
| **10. Reflection** | Lessons learned, estimation accuracy | workflow-architect |

See [Agent Phases](references/agent-phases.md) for detailed agent prompts and spawn templates.

For Agent Teams mode, see [Agent Teams Phases](references/agent-teams-phases.md).

### Issue Tracking

If working on a GitHub issue, run the Start Work ceremony from `issue-progress-tracking` and post progress comments after major phases.

### Feedback Loop

Maintain checkpoints after each task. See [Feedback Loop](references/feedback-loop.md) for triggers and actions.

---

## Test Requirements Matrix

Phase 5 test-generator MUST produce tests matching the change type:

| Change Type | Required Tests | `testing-patterns` Rules |
|-------------|---------------|--------------------------|
| API endpoint | Unit + Integration + Contract | `integration-api`, `verification-contract`, `mocking-msw` |
| DB schema/migration | Migration + Integration | `integration-database`, `data-seeding-cleanup` |
| UI component | Unit + Snapshot + A11y | `unit-aaa-pattern`, `integration-component`, `a11y-jest-axe`, `e2e-playwright` |
| Business logic | Unit + Property-based | `unit-aaa-pattern`, `pytest-markers`, `verification-property` |
| LLM/AI feature | Unit + Eval | `llm-deepeval`, `llm-mocking`, `llm-structured` |
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

If detected: run integration tests against real services, not just mocks. Reference `testing-patterns` rules: `integration-database`, `integration-api`, `data-seeding-cleanup`.

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
- **Clean up agents** — use `TeamDelete()` after completion; press `Ctrl+F` twice as manual fallback

---

## Related Skills

- `ork:explore`: Explore codebase before implementing
- `ork:verify`: Verify implementations work correctly
- `ork:worktree-coordination`: Git worktree management patterns
- `ork:issue-progress-tracking`: Auto-updates GitHub issues with commit progress

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
- [E2E Verification](references/e2e-verification.md)
- [Worktree Isolation Mode](references/worktree-isolation-mode.md)
