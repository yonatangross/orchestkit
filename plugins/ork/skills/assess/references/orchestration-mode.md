<!-- SHARED: keep in sync with ../../../verify/references/orchestration-mode.md -->
# Orchestration Mode Selection

Shared logic for choosing between Agent Teams and Task tool orchestration in assess/verify skills.

## Environment Check

```python
import os
teams_available = os.environ.get("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS") is not None
force_task_tool = os.environ.get("ORCHESTKIT_FORCE_TASK_TOOL") == "1"

if force_task_tool or not teams_available:
    mode = "task_tool"
else:
    # Teams available — use for full multi-dimensional work
    mode = "agent_teams" if scope == "full" else "task_tool"
```

## Decision Rules

1. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set --> **Agent Teams mode** (for full assessment/verification)
2. Flag not set --> **Task tool mode** (default)
3. Quick/single-dimension scope --> **Task tool** (regardless of flag)
4. `ORCHESTKIT_FORCE_TASK_TOOL=1` --> **Task tool** (override)

## Agent Teams vs Task Tool

| Aspect | Task Tool (Star) | Agent Teams (Mesh) |
|--------|------------------|-------------------|
| Topology | All agents report to lead | Agents communicate with each other |
| Finding correlation | Lead cross-references after completion | Agents share findings in real-time |
| Cross-domain overlap | Independent scoring | Agents alert each other about overlapping concerns |
| Cost | ~200K tokens | ~500K tokens |
| Best for | Focused/single-dimension work | Full multi-dimensional assessment/verification |

## Fallback

If Agent Teams encounters issues mid-execution, fall back to Task tool for remaining work. This is safe because both modes produce the same output format (dimensional scores 0-10).

## Context Window Note

For full codebase work (>20 files), use the 1M context window to avoid agent context exhaustion. On 200K context, scope discovery should limit files to prevent overflow.
