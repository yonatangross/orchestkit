# Orchestration Mode Selection

## Decision Logic

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
