---
title: Custom Annotated Reducers
impact: HIGH
impactDescription: "Default behavior replaces values — custom reducers needed for merge, last-value, and dedup patterns"
tags: state, reducers, annotated, merge, custom
---

## Custom Annotated Reducers

Define custom reducers when `operator.add` doesn't fit. Common patterns: merge dicts, keep latest, dedup.

**Incorrect:**
```python
class State(TypedDict):
    config: dict  # No reducer — later nodes overwrite entire dict
    status: str   # No reducer — same issue

def node_a(state):
    return {"config": {"key_a": "value_a"}}

def node_b(state):
    return {"config": {"key_b": "value_b"}}
    # config is now {"key_b": "value_b"} — key_a is LOST
```

**Correct:**
```python
from typing import Annotated

def merge_dicts(a: dict, b: dict) -> dict:
    """Custom reducer that deep-merges dictionaries."""
    return {**a, **b}

def last_value(a, b):
    """Keep only the latest value."""
    return b

class State(TypedDict):
    config: Annotated[dict, merge_dicts]   # Merges updates from all nodes
    status: Annotated[str, last_value]     # Explicit: keeps latest value

def node_a(state):
    return {"config": {"key_a": "value_a"}}

def node_b(state):
    return {"config": {"key_b": "value_b"}}
    # config is now {"key_a": "value_a", "key_b": "value_b"}
```

**RemainingSteps (2026 pattern)** — proactive recursion handling:
```python
from langgraph.types import RemainingSteps

def agent_node(state: WorkflowState, remaining: RemainingSteps):
    if remaining.steps < 5:
        return {"action": "summarize_and_exit"}
    return {"action": "continue"}
```

**Key rules:**
- Use `Annotated[dict, merge_dicts]` for config-style fields
- Use `Annotated[str, last_value]` to make overwrites explicit
- Always return new state from nodes, never mutate in place (breaks checkpointing)

Reference: [LangGraph Reducers](https://langchain-ai.github.io/langgraph/concepts/low_level/#reducers)
