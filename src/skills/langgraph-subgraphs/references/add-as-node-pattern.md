# Add as Node Pattern Reference

Embed compiled subgraph directly as a node for shared state.

## When to Use

- Parent and subgraph share state keys
- Multi-agent coordination via messages
- Simple composition without state transformation
- Subgraph consumes/produces same schema as parent

## Implementation

```python
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing import Annotated

# Shared state schema
class SharedState(TypedDict):
    messages: Annotated[list, add_messages]
    context: dict
    result: str | None

# Build subgraph with same schema
agent_builder = StateGraph(SharedState)
agent_builder.add_node("think", think_node)
agent_builder.add_node("act", act_node)
agent_builder.add_edge(START, "think")
agent_builder.add_edge("think", "act")
agent_builder.add_edge("act", END)
agent_subgraph = agent_builder.compile()

# Add directly as node
parent_builder = StateGraph(SharedState)
parent_builder.add_node("agent", agent_subgraph)  # Direct embedding
parent_builder.add_edge(START, "agent")
parent_builder.add_edge("agent", END)

parent = parent_builder.compile()
```

## Multiple Subgraph Agents

```python
# Build specialized agents
security_agent = build_security_agent().compile()
analysis_agent = build_analysis_agent().compile()
review_agent = build_review_agent().compile()

# Parent coordinates via shared messages
parent_builder = StateGraph(SharedState)
parent_builder.add_node("security", security_agent)
parent_builder.add_node("analysis", analysis_agent)
parent_builder.add_node("review", review_agent)
parent_builder.add_node("supervisor", supervisor_node)

# Supervisor routes to agents
parent_builder.add_edge(START, "supervisor")
parent_builder.add_conditional_edges(
    "supervisor",
    route_to_agent,
    {
        "security": "security",
        "analysis": "analysis",
        "review": "review",
        END: END
    }
)
# Agents return to supervisor
for agent in ["security", "analysis", "review"]:
    parent_builder.add_edge(agent, "supervisor")
```

## Partial State Overlap

```python
# Subgraph only needs subset of parent state
class ParentState(TypedDict):
    messages: Annotated[list, add_messages]
    user_id: str
    preferences: dict
    result: str

class SubgraphState(TypedDict):
    messages: Annotated[list, add_messages]  # Shared
    result: str  # Shared

# Subgraph reads/writes only overlapping keys
# Other parent keys preserved automatically
```

## Advantages

- No state transformation code needed
- Simpler to compose
- Natural message passing between agents
- Automatic state propagation
