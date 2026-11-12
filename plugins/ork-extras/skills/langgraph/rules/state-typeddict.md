---
title: Design TypedDict state with Annotated accumulators to prevent silent data loss
impact: CRITICAL
impactDescription: "Wrong state schema causes silent data loss across nodes — fields overwrite instead of accumulating"
tags: state, typeddict, annotated, reducers, accumulate
---

## TypedDict State Pattern

Use TypedDict for lightweight internal state. Use `Annotated[list[T], add]` for any field that multiple nodes write to.

**Incorrect:**
```python
from typing import TypedDict

class WorkflowState(TypedDict):
    findings: list[dict]  # No reducer — each node REPLACES the list

def agent_a(state):
    return {"findings": [{"source": "a", "result": "..."}]}

def agent_b(state):
    return {"findings": [{"source": "b", "result": "..."}]}
    # agent_a's findings are LOST
```

**Correct:**
```python
from typing import TypedDict, Annotated
from operator import add

class WorkflowState(TypedDict):
    input: str
    output: str
    findings: Annotated[list[dict], add]  # Accumulates across nodes
    metadata: dict

def agent_a(state):
    return {"findings": [{"source": "a", "result": "..."}]}

def agent_b(state):
    return {"findings": [{"source": "b", "result": "..."}]}
    # Both findings are preserved: [agent_a's, agent_b's]
```

**Context Schema (2026 pattern)** — pass runtime config without polluting state:
```python
from dataclasses import dataclass

@dataclass
class ContextSchema:
    llm_provider: str = "anthropic"
    temperature: float = 0.7

graph = StateGraph(WorkflowState, context_schema=ContextSchema)

def my_node(state: WorkflowState, context: ContextSchema):
    return {"output": call_llm(state["input"], context.temperature)}
```

**Node Caching (2026 pattern):**
```python
from langgraph.cache.memory import InMemoryCache
from langgraph.types import CachePolicy

builder.add_node("embed", embed_node, cache_policy=CachePolicy(ttl=300))
graph = builder.compile(cache=InMemoryCache())
```

**Key rules:**
- Always use `Annotated[list[T], add]` for multi-agent accumulation
- Return partial state updates from nodes, never mutate in place
- Use `context_schema` for runtime config (temperature, provider)
- Use `CachePolicy` for expensive operations (embeddings, API calls)

Reference: [LangGraph State Concepts](https://langchain-ai.github.io/langgraph/concepts/low_level/#state)
