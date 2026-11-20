---
title: Dispatch agents in round-robin order with completion tracking to avoid repeats
impact: MEDIUM
impactDescription: "Without completion tracking, supervisor dispatches same agent repeatedly"
tags: supervisor, round-robin, completion, tracking
---

## Round-Robin Supervisor Dispatch

Visit all agents exactly once before finishing. Track completion to prevent re-dispatch.

**Incorrect — no completion tracking:**
```python
ALL_AGENTS = ["security", "tech", "implementation"]

def supervisor(state):
    # No tracking — may dispatch same agent multiple times
    state["next"] = ALL_AGENTS[0]
    return state
```

**Correct — completion-tracked round-robin:**
```python
ALL_AGENTS = ["security", "tech", "implementation", "tutorial"]

def supervisor(state) -> Command[Literal[*ALL_AGENTS, "quality_gate", END]]:
    completed = set(state["agents_completed"])
    available = [a for a in ALL_AGENTS if a not in completed]

    if not available:
        return Command(goto="quality_gate")

    return Command(
        update={"current_agent": available[0]},
        goto=available[0]
    )

def agent_node_factory(agent_name: str):
    """Create agent node that tracks completion."""
    async def node(state):
        result = await agents[agent_name].run(state["input"])
        return {
            "results": [result],
            "agents_completed": [agent_name],
            "current_agent": None,
        }
    return node

# Register all agents
for name in ALL_AGENTS:
    workflow.add_node(name, agent_node_factory(name))
    workflow.add_edge(name, "supervisor")
```

**Key rules:**
- Track `agents_completed` as `Annotated[list[str], add]` in state
- Check available vs completed to determine next agent
- Route to quality gate or END when all agents done
- Use factory function for consistent agent node creation

Reference: [LangGraph Multi-Agent](https://langchain-ai.github.io/langgraph/concepts/multi_agent/)
