---
name: langgraph-subgraphs
description: LangGraph subgraph patterns for modular workflows. Use when building nested graphs, composing reusable workflow components, or coordinating multi-agent systems with isolated state.
tags: [langgraph, subgraphs, modular, composition]
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# LangGraph Subgraphs

Compose modular, reusable workflow components with nested graphs.

## Two Primary Patterns

### Pattern 1: Invoke from Node (Different Schemas)

Use when subgraph needs completely isolated state.

```python
from langgraph.graph import StateGraph, START, END

# Parent state
class ParentState(TypedDict):
    query: str
    analysis_result: dict

# Subgraph state (completely different)
class AnalysisState(TypedDict):
    input_text: str
    findings: list[str]
    score: float

# Build subgraph
analysis_builder = StateGraph(AnalysisState)
analysis_builder.add_node("analyze", analyze_node)
analysis_builder.add_node("score", score_node)
analysis_builder.add_edge(START, "analyze")
analysis_builder.add_edge("analyze", "score")
analysis_builder.add_edge("score", END)
analysis_subgraph = analysis_builder.compile()

# Parent node that invokes subgraph
def call_analysis(state: ParentState) -> dict:
    """Transform state at boundaries."""
    # Map parent → subgraph state
    subgraph_input = {"input_text": state["query"], "findings": [], "score": 0.0}

    # Invoke subgraph
    subgraph_output = analysis_subgraph.invoke(subgraph_input)

    # Map subgraph → parent state
    return {
        "analysis_result": {
            "findings": subgraph_output["findings"],
            "score": subgraph_output["score"]
        }
    }

# Add to parent graph
parent_builder = StateGraph(ParentState)
parent_builder.add_node("analysis", call_analysis)
```

### Pattern 2: Add as Node (Shared State)

Use when parent and subgraph share state keys.

```python
from langgraph.graph.message import add_messages

# Shared state with messages channel
class SharedState(TypedDict):
    messages: Annotated[list, add_messages]
    context: dict

# Subgraph uses same state
agent_builder = StateGraph(SharedState)
agent_builder.add_node("think", think_node)
agent_builder.add_node("act", act_node)
agent_builder.add_edge(START, "think")
agent_builder.add_edge("think", "act")
agent_builder.add_edge("act", END)
agent_subgraph = agent_builder.compile()

# Add compiled subgraph directly as node
parent_builder = StateGraph(SharedState)
parent_builder.add_node("agent_team", agent_subgraph)  # Direct embedding
parent_builder.add_edge(START, "agent_team")
parent_builder.add_edge("agent_team", END)
```

## When to Use Each Pattern

| Pattern | Use When |
|---------|----------|
| **Invoke** | Different schemas, private message histories, multi-level nesting |
| **Add as Node** | Shared state keys, agent coordination, message passing |

## Multi-Level Nesting

```python
# Grandchild subgraph
grandchild = grandchild_builder.compile()

# Child subgraph (contains grandchild)
def call_grandchild(state: ChildState):
    result = grandchild.invoke({"data": state["input"]})
    return {"processed": result["output"]}

child_builder.add_node("processor", call_grandchild)
child = child_builder.compile()

# Parent (contains child)
def call_child(state: ParentState):
    result = child.invoke({"input": state["query"]})
    return {"result": result["processed"]}

parent_builder.add_node("child_workflow", call_child)
```

## Checkpointing Strategies

### Parent-Only (Recommended)

```python
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)

# Checkpointer propagates to all subgraphs automatically
parent = parent_builder.compile(checkpointer=checkpointer)
```

### Independent Subgraph Memory

```python
# Subgraph maintains its own checkpoint history
# Useful for agent message histories that should persist independently
agent_subgraph = agent_builder.compile(checkpointer=True)

# Parent with its own checkpointer
parent = parent_builder.compile(checkpointer=PostgresSaver(...))
```

## State Mapping Best Practices

```python
def call_subgraph_with_mapping(state: ParentState) -> dict:
    """Explicit state transformation at boundaries."""
    # 1. Extract relevant data from parent
    subgraph_input = {
        "query": state["user_query"],
        "context": state.get("context", {}),
        "history": []  # Subgraph has own history
    }

    # 2. Invoke with config propagation
    config = get_runnable_config()
    result = subgraph.invoke(subgraph_input, config)

    # 3. Transform output back to parent schema
    return {
        "subgraph_result": result["output"],
        "metadata": {
            "subgraph": "analysis",
            "steps": result.get("step_count", 0)
        }
    }
```

## Streaming & Inspection

```python
# Stream with subgraph visibility
for namespace, chunk in graph.stream(inputs, subgraphs=True, stream_mode="updates"):
    depth = len(namespace)
    prefix = "  " * depth
    print(f"{prefix}[{'/'.join(namespace) or 'root'}] {chunk}")

# Inspect subgraph state (only works when interrupted)
config = {"configurable": {"thread_id": "thread-1"}}
state = graph.get_state(config, subgraphs=True)

# Access nested state
for subgraph_state in state.tasks:
    print(f"Subgraph: {subgraph_state.name}")
    print(f"State: {subgraph_state.state}")
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Schema design | Shared for coordination, isolated for encapsulation |
| Checkpointing | Parent-only unless agents need independent history |
| State mapping | Explicit transforms at boundaries for clarity |
| Team development | Each team owns their subgraph with defined interface |

## Common Mistakes

- Not transforming state at boundaries (schema mismatch errors)
- Forgetting to propagate config for tracing/checkpointing
- Using shared state when isolation is needed
- Missing `subgraphs=True` when streaming nested graphs

## Evaluations

See [references/evaluations.md](references/evaluations.md) for test cases.

## Related Skills

- `langgraph-streaming` - Stream updates from subgraphs
- `langgraph-supervisor` - Subgraphs as workers in supervisor patterns
- `langgraph-checkpoints` - Cross-subgraph checkpointing strategies
- `langgraph-state` - State schema mapping between graphs
- `langgraph-parallel` - Parallel subgraph execution
- `langgraph-functional` - Subgraphs with Functional API

## Capability Details

### invoke-pattern
**Keywords:** invoke, different schema, isolated state, transform
**Solves:**
- Embed graphs with different state schemas
- Isolate subgraph state from parent
- Transform data at graph boundaries

### add-as-node-pattern
**Keywords:** add_node, shared state, messages, coordination
**Solves:**
- Embed graphs with shared state
- Coordinate agents via message passing
- Build multi-agent systems

### nested-graphs
**Keywords:** nested, multi-level, parent, child, grandchild
**Solves:**
- Build deeply nested graph hierarchies
- Compose complex workflows from simple parts
- Implement recursive graph patterns

### subgraph-checkpointing
**Keywords:** checkpoint, memory, independent, propagate
**Solves:**
- Configure checkpointing for subgraphs
- Maintain independent agent histories
- Handle persistence in nested structures
