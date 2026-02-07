# Orchestration Mode Selection

## Decision Logic

```python
# Check mode — Agent Teams is default when available (Issue #362)
import os
teams_available = os.environ.get("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS") is not None
force_task_tool = os.environ.get("ORCHESTKIT_FORCE_TASK_TOOL") == "1"

if force_task_tool or not teams_available:
    mode = "task_tool"
else:
    # Teams available — use it for non-trivial work
    mode = "agent_teams" if avg_complexity >= 2.5 else "task_tool"
```

## Comparison Table

| Aspect | Task Tool (star) | Agent Teams (mesh) |
|--------|------------------|--------------------|
| Communication | All agents report to lead only | Teammates message each other |
| API contract | Lead relays between agents | Backend messages frontend directly |
| Cost | ~500K tokens (full-stack) | ~1.2M tokens (full-stack) |
| Wall-clock | Sequential phases | Overlapping (30-40% faster) |
| Quality review | After all agents complete | Continuous (reviewer on team) |
| Best for | Independent tasks, low complexity | Cross-cutting features, high complexity |

## Fallback

If Agent Teams mode encounters issues (teammate failures, messaging problems), fall back to Task tool mode for remaining phases. The approaches are compatible — work done in Teams mode transfers to Task tool continuation.
