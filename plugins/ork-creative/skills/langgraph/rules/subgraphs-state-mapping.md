---
title: Propagate config through subgraph state mapping for tracing and checkpointing
impact: MEDIUM
impactDescription: "Forgetting config propagation breaks tracing and checkpointing in nested graphs"
tags: subgraphs, state-mapping, boundaries, checkpointing, nesting
---

## Subgraph State Mapping

Explicit state transforms at boundaries with proper config propagation for tracing and checkpointing.

**Incorrect — no config propagation:**
```python
def call_subgraph(state: ParentState):
    result = subgraph.invoke({"query": state["query"]})  # No config — breaks tracing
    return {"result": result["output"]}
```

**Correct — config propagation and explicit mapping:**
```python
from langgraph.config import get_runnable_config

def call_subgraph_with_mapping(state: ParentState) -> dict:
    # 1. Extract relevant data
    subgraph_input = {
        "query": state["user_query"],
        "context": state.get("context", {}),
        "history": [],
    }

    # 2. Propagate config for tracing/checkpointing
    config = get_runnable_config()
    result = subgraph.invoke(subgraph_input, config)

    # 3. Transform output back
    return {
        "subgraph_result": result["output"],
        "metadata": {"subgraph": "analysis", "steps": result.get("step_count", 0)},
    }
```

**Checkpointing strategies:**
```python
# Parent-only (recommended) — propagates to all subgraphs
parent = parent_builder.compile(checkpointer=PostgresSaver(...))

# Independent subgraph memory — for persistent agent histories
agent_subgraph = agent_builder.compile(checkpointer=True)
```

**Streaming nested graphs:**
```python
for namespace, chunk in graph.stream(inputs, subgraphs=True, stream_mode="updates"):
    depth = len(namespace)
    print(f"{'  ' * depth}[{'/'.join(namespace) or 'root'}] {chunk}")
```

**Key rules:**
- Always propagate config with `get_runnable_config()` for tracing
- Parent-only checkpointer is sufficient for most cases
- Use `subgraphs=True` in stream/get_state for nested visibility
- Keep state mapping explicit and documented at each boundary

Reference: [LangGraph Subgraphs](https://langchain-ai.github.io/langgraph/concepts/low_level/#subgraphs)
