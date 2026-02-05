---
name: langgraph-state
description: LangGraph state management patterns. Use when designing workflow state schemas, using TypedDict vs Pydantic, implementing accumulating state with Annotated operators, or managing shared state across nodes.
tags: [langgraph, state, management, graphs]
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# LangGraph State Management

Design and manage state schemas for LangGraph workflows.

## TypedDict Approach (Simple)

```python
from typing import TypedDict, Annotated
from operator import add

class WorkflowState(TypedDict):
    input: str
    output: str
    agent_responses: Annotated[list[dict], add]  # Accumulates
    metadata: dict
```

## MessagesState Pattern (2026 Best Practice)

```python
from langgraph.graph import MessagesState
from langgraph.graph.message import add_messages
from typing import Annotated

# Option 1: Use built-in MessagesState (recommended)
class AgentState(MessagesState):
    """Extends MessagesState with custom fields."""
    user_id: str
    context: dict

# Option 2: Define messages manually with add_messages reducer
class CustomState(TypedDict):
    messages: Annotated[list, add_messages]  # Smart append/update by ID
    metadata: dict
```

**Why `add_messages` matters:**
- Appends new messages (doesn't overwrite)
- Updates existing messages by ID
- Handles message deduplication automatically

> **Note**: `MessageGraph` is deprecated in LangGraph v1.0.0. Use `StateGraph` with a `messages` key instead.

## Pydantic Approach (Validation)

```python
from pydantic import BaseModel, Field

class WorkflowState(BaseModel):
    input: str = Field(description="User input")
    output: str = ""
    agent_responses: list[dict] = Field(default_factory=list)

    def add_response(self, agent: str, result: str):
        self.agent_responses.append({"agent": agent, "result": result})
```

## Accumulating State Pattern

```python
from typing import Annotated
from operator import add

class AnalysisState(TypedDict):
    url: str
    raw_content: str

    # Accumulate agent outputs
    findings: Annotated[list[Finding], add]
    embeddings: Annotated[list[Embedding], add]

    # Control flow
    current_agent: str
    agents_completed: list[str]
    quality_passed: bool
```

**Key Pattern: `Annotated[list[T], add]`**
- Without `add`: Each node replaces the list
- With `add`: Each node appends to the list
- Critical for multi-agent workflows

## Custom Reducers

```python
from typing import Annotated

def merge_dicts(a: dict, b: dict) -> dict:
    """Custom reducer that merges dictionaries."""
    return {**a, **b}

class State(TypedDict):
    config: Annotated[dict, merge_dicts]  # Merges updates

def last_value(a, b):
    """Keep only the latest value."""
    return b

class State(TypedDict):
    status: Annotated[str, last_value]  # Overwrites
```

## State Immutability

```python
def node(state: WorkflowState) -> WorkflowState:
    """Return new state, don't mutate in place."""
    # Wrong: state["output"] = "result"
    # Right:
    return {
        **state,
        "output": "result"
    }
```

## Context Schema (2026 Pattern)

Pass runtime configuration without polluting state:

```python
from dataclasses import dataclass
from langgraph.graph import StateGraph

@dataclass
class ContextSchema:
    """Runtime configuration, not persisted in state."""
    llm_provider: str = "anthropic"
    temperature: float = 0.7
    max_retries: int = 3
    debug_mode: bool = False

# Create graph with context schema
graph = StateGraph(WorkflowState, context_schema=ContextSchema)

# Access context in nodes
def my_node(state: WorkflowState, context: ContextSchema):
    if context.llm_provider == "anthropic":
        response = call_claude(state["input"], context.temperature)
    else:
        response = call_openai(state["input"], context.temperature)

    if context.debug_mode:
        logger.debug(f"Response: {response}")

    return {"output": response}

# Invoke with context
graph.invoke(
    {"input": "Hello"},
    context={"llm_provider": "openai", "temperature": 0.5}
)
```

## Node Caching (2026 Pattern)

Cache expensive node results with TTL:

```python
from langgraph.cache.memory import InMemoryCache
from langgraph.types import CachePolicy

# Add node with cache policy
builder.add_node(
    "embed_content",
    embed_content_node,
    cache_policy=CachePolicy(ttl=300)  # Cache for 5 minutes
)

builder.add_node(
    "llm_call",
    llm_node,
    cache_policy=CachePolicy(ttl=60)  # Cache for 1 minute
)

# Compile with cache
graph = builder.compile(cache=InMemoryCache())
```

## RemainingSteps (Proactive Recursion Handling)

Check remaining steps to wrap up gracefully:

```python
from langgraph.types import RemainingSteps

def agent_node(state: WorkflowState, remaining: RemainingSteps):
    """Proactively handle recursion limit."""
    if remaining.steps < 5:
        # Running low on steps, wrap up
        return {
            "action": "summarize_and_exit",
            "reason": f"Only {remaining.steps} steps remaining"
        }

    # Continue normal processing
    return {"action": "continue"}
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| TypedDict vs Pydantic | TypedDict for internal state, Pydantic at boundaries |
| Messages state | Use `MessagesState` or `add_messages` reducer |
| Accumulators | Always use `Annotated[list, add]` for multi-agent |
| Nesting | Keep state flat (easier debugging) |
| Immutability | Return new state, don't mutate |
| Runtime config | Use `context_schema` for non-persistent config |
| Expensive ops | Use `CachePolicy` to cache node results |
| Recursion | Use `RemainingSteps` for proactive handling |

**2026 Guidance**: Use TypedDict inside the graph (lightweight, no runtime overhead). Use Pydantic at boundaries (inputs/outputs, user-facing data) for validation.

## Common Mistakes

- Forgetting `add` reducer (overwrites instead of accumulates)
- Mutating state in place (breaks checkpointing)
- Deeply nested state (hard to debug)
- No type hints (lose IDE support)
- Putting runtime config in state (use context_schema instead)
- Not caching expensive operations (repeated embedding calls)

## Evaluations

See [references/evaluations.md](references/evaluations.md) for test cases.

## Related Skills

- `langgraph-routing` - Using state fields for routing decisions
- `langgraph-checkpoints` - Persist state for fault tolerance
- `langgraph-parallel` - Accumulating state from parallel nodes
- `langgraph-supervisor` - State tracking for agent completion
- `langgraph-functional` - State in Functional API patterns
- `type-safety-validation` - Pydantic model patterns

## Capability Details

### state-definition
**Keywords:** StateGraph, TypedDict, state schema, define state
**Solves:**
- Define workflow state with TypedDict
- Create Pydantic state models
- Structure agent state properly

### state-channels
**Keywords:** channel, Annotated, state channel, MessageChannel
**Solves:**
- Configure state channels for data flow
- Implement message accumulation
- Handle channel-based state updates

### state-reducers
**Keywords:** reducer, add_messages, operator.add, accumulate
**Solves:**
- Implement state reducers with Annotated
- Accumulate messages across nodes
- Handle state merging strategies

### subgraphs
**Keywords:** subgraph, nested graph, parent state, child graph
**Solves:**
- Compose graphs with subgraphs
- Pass state between parent and child
- Implement modular workflow components

### state-persistence
**Keywords:** persist, state persistence, durable state, save state
**Solves:**
- Persist state across executions
- Implement durable workflows
- Handle state serialization
