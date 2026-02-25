# Agent Spawn Definitions

Dimension-to-agent mapping and spawn patterns for Phase 2.

## Task Tool Mode (Default)

For each dimension, spawn a background agent with **scope constraints**:

```python
for dimension, agent_type in [
    ("CORRECTNESS + MAINTAINABILITY", "code-quality-reviewer"),
    ("SECURITY", "security-auditor"),
    ("PERFORMANCE + SCALABILITY", "python-performance-engineer"),  # Use python-performance-engineer for backend; frontend-performance-engineer for frontend
    ("TESTABILITY", "test-generator"),
]:
    Task(subagent_type=agent_type, run_in_background=True, max_turns=25,
         prompt=f"""Assess {dimension} (0-10) for: {target}

## Scope Constraint
ONLY read and analyze the following {len(scope_files)} files -- do NOT explore beyond this list:
{file_list}

Budget: Use at most 15 tool calls. Read files from the list above, then produce your score
with reasoning, evidence, and 2-3 specific improvement suggestions.
Do NOT use Glob or Grep to discover additional files.""")
```

Then collect results from all agents and proceed to Phase 3.

## Agent Teams Alternative

See [agent-teams-mode.md](agent-teams-mode.md) for Agent Teams assessment workflow with cross-validation and team teardown.

## Context Window Note

For full codebase assessments (>20 files), use the 1M context window to avoid agent context exhaustion. On 200K context, the scope discovery in [scope-discovery.md](scope-discovery.md) limits files to prevent overflow.
