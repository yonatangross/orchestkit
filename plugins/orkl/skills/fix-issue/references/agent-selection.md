# Agent Selection & Orchestration Mode

## Orchestration Mode Selection

Choose **Agent Teams** (mesh -- RCA agents share hypotheses) or **Task tool** (star -- all report to lead):

1. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` -> **Agent Teams mode**
2. Agent Teams unavailable -> **Task tool mode** (default)
3. Otherwise: Complex cross-cutting bugs (backend + frontend + tests involved) -> recommend **Agent Teams**; Focused bugs (single domain) -> **Task tool**

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Hypothesis sharing | Lead relays between agents | Investigators share hypotheses in real-time |
| Conflicting evidence | Lead resolves | Investigators debate directly |
| Cost | ~250K tokens | ~600K tokens |
| Best for | Single-domain bugs | Cross-cutting bugs with multiple hypotheses |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining investigation.

## RCA Agent Roster (Phase 4)

Launch ALL 5 agents in parallel with `run_in_background=True` and `max_turns=25`:

| # | Agent | Role |
|---|-------|------|
| 1 | debug-investigator | Root cause tracing |
| 2 | debug-investigator | Impact analysis |
| 3 | backend-system-architect | Backend fix design |
| 4 | frontend-ui-developer | Frontend fix design |
| 5 | test-generator | Test requirements |

Each agent outputs structured JSON with findings and SUMMARY line.

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
