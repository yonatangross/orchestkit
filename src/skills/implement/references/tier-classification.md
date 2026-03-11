# Tier Classification & Workflow Mapping

Project complexity tiers determine architecture ceilings and workflow phases.

## Auto-Detection Signals

Scan codebase for: README keywords (take-home, interview), `.github/workflows/`, Dockerfile, terraform/, k8s/, CONTRIBUTING.md.

## Tier Classification

| Signal | Tier | Architecture Ceiling |
|--------|------|---------------------|
| README says "take-home", time limit | **1. Interview** (load `${CLAUDE_SKILL_DIR}/references/interview-mode.md`) | Flat files, 8-15 files |
| < 10 files, no CI | **2. Hackathon** | Single file if possible |
| `.github/workflows/`, managed DB | **3. MVP** | MVC monolith |
| Module boundaries, Redis, queues | **4. Growth** | Modular monolith, DI |
| K8s/Terraform, monorepo | **5. Enterprise** | Hexagonal/DDD |
| CONTRIBUTING.md, LICENSE | **6. Open Source** | Minimal API, exhaustive tests |

If confidence is low, use `AskUserQuestion` to ask the user. Pass detected tier to ALL downstream agents — see `scope-appropriate-architecture`.

## Tier → Workflow Mapping

| Tier | Phases | Max Agents |
|------|--------|-----------|
| 1. Interview | 1, 5 only | 2 |
| 2. Hackathon | 5 only | 1 |
| 3. MVP | 1-6, 9 | 3-4 |
| 4-5. Growth/Enterprise | All 10 | 5-8 |
| 6. Open Source | 1-7, 9-10 | 3-4 |

Use `AskUserQuestion` to verify scope (full-stack / backend-only / frontend-only / prototype) and constraints.

## Orchestration Mode

- Agent Teams (mesh) when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and complexity >= 2.5
- Task tool (star) otherwise; `ORCHESTKIT_FORCE_TASK_TOOL=1` to override
- Load orchestration modes: `Read("${CLAUDE_SKILL_DIR}/references/orchestration-modes.md")`

## Tier Override

When auto-detection is ambiguous (e.g., a monorepo with no CI yet), prefer the **lower** tier to avoid over-engineering. The user can always escalate.

Manual override example:
```
AskUserQuestion(questions=[{
  "question": "Detected signals for both MVP and Growth. Which tier fits best?",
  "options": [
    {"label": "3. MVP", "description": "MVC monolith, 3-4 agents"},
    {"label": "4. Growth", "description": "Modular monolith with DI, up to 8 agents"}
  ]
}])
```
