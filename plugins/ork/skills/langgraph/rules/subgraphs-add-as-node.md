---
title: Add subgraph directly as node when parent and child share the same state
impact: MEDIUM
impactDescription: "Using invoke pattern when states are shared adds unnecessary transformation code"
tags: subgraphs, add-node, shared-state, messages, coordination
---

## Add Subgraph as Node (Shared State)

Use when parent and subgraph share the same state schema. Add compiled graph directly as a node.

**Incorrect — unnecessary state mapping for shared schema:**
```python
def call_agent(state: SharedState):
    # Unnecessary transformation when schemas match
    input = {"messages": state["messages"], "context": state["context"]}
    output = agent_subgraph.invoke(input)
    return {"messages": output["messages"], "context": output["context"]}
```

**Correct — add compiled graph directly:**
```python
from langgraph.graph.message import add_messages

class SharedState(TypedDict):
    messages: Annotated[list, add_messages]
    context: dict

# Build subgraph with SAME state
agent_builder = StateGraph(SharedState)
agent_builder.add_node("think", think_node)
agent_builder.add_node("act", act_node)
agent_builder.add_edge(START, "think")
agent_builder.add_edge("think", "act")
agent_builder.add_edge("act", END)
agent_subgraph = agent_builder.compile()

# Add compiled subgraph directly as node — no wrapper needed
parent_builder = StateGraph(SharedState)
parent_builder.add_node("agent_team", agent_subgraph)
parent_builder.add_edge(START, "agent_team")
parent_builder.add_edge("agent_team", END)
```

**Key rules:**
- Use when parent and subgraph have identical or overlapping state schemas
- No state transformation needed — shared keys pass through automatically
- Ideal for agent coordination via message passing
- Reducers (like `add_messages`) work across the boundary

Reference: [LangGraph Subgraphs](https://langchain-ai.github.io/langgraph/concepts/low_level/#subgraphs)
