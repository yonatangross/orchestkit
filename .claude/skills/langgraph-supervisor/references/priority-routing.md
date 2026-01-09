# Priority-Based Routing

Route to agents by priority order, critical agents first.

## Implementation

```python
from langgraph.graph import StateGraph, END

AGENT_PRIORITIES = {
    "security": 1,       # Run first (critical)
    "validation": 2,
    "analysis": 3,
    "formatting": 4      # Run last
}

def priority_supervisor(state: WorkflowState) -> dict:
    """Route by priority, not round-robin."""
    completed = set(state.get("agents_completed", []))
    available = [a for a in AGENT_PRIORITIES if a not in completed]

    if not available:
        return {"next": END}

    # Select highest priority (lowest number)
    next_agent = min(available, key=lambda a: AGENT_PRIORITIES[a])
    return {"next": next_agent, "current_agent": next_agent}

def should_skip_agent(state: WorkflowState, agent: str) -> bool:
    """Check if agent should be skipped based on state."""
    if agent == "security" and state.get("trusted_source"):
        return True
    if agent == "formatting" and state.get("skip_format"):
        return True
    return False

# Dynamic priority adjustment
def adjust_priority(agent: str, state: WorkflowState) -> int:
    base = AGENT_PRIORITIES[agent]
    if state.get("urgent") and agent == "validation":
        return base - 1  # Boost validation for urgent
    return base
```

## When to Use

- Security-critical workflows (security first)
- Conditional agent execution
- Dynamic priority based on context
- Fail-fast patterns

## Anti-patterns

- Hardcoded priorities without override capability
- No skip logic for unnecessary agents
- Priority 0 (reserved for system)
- Too many priority levels (hard to maintain)