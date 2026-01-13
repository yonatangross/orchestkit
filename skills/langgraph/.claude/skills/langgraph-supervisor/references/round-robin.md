# Round-Robin Supervisor

Dispatch work to agents in sequential order.

## Implementation

```python
from langgraph.graph import StateGraph, END

ALL_AGENTS = ["security", "tech", "implementation", "tutorial"]

def supervisor_node(state: WorkflowState) -> dict:
    """Route to next available agent round-robin."""
    completed = set(state.get("agents_completed", []))
    available = [a for a in ALL_AGENTS if a not in completed]

    if not available:
        return {"next": "finalize"}
    return {"next": available[0]}

def agent_node_factory(agent_name: str):
    """Create agent node that tracks completion."""
    async def node(state: WorkflowState) -> dict:
        result = await agents[agent_name].run(state["input"])
        return {
            "results": [result],
            "agents_completed": [agent_name]
        }
    return node

workflow = StateGraph(WorkflowState)
workflow.add_node("supervisor", supervisor_node)
for name in ALL_AGENTS:
    workflow.add_node(name, agent_node_factory(name))
    workflow.add_edge(name, "supervisor")

workflow.add_conditional_edges(
    "supervisor",
    lambda s: s["next"],
    {**{a: a for a in ALL_AGENTS}, "finalize": "finalize"}
)
```

## When to Use

- Equal priority agents
- Sequential processing required
- Predictable execution order
- Simple coordination needs

## Anti-patterns

- No completion tracking (infinite loops)
- Missing worker to supervisor edges
- No END condition
- Heavy logic in supervisor