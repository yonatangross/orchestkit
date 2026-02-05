# Checkpointing Subgraphs Reference

Configure persistence for nested graph hierarchies.

## Parent-Only Checkpointing (Recommended)

```python
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)

# Checkpointer propagates to all subgraphs automatically
parent = parent_builder.compile(checkpointer=checkpointer)

# Invoke with thread_id
config = {"configurable": {"thread_id": "analysis-123"}}
result = parent.invoke(inputs, config)

# Resume works across entire hierarchy
result = parent.invoke(None, config)  # Resumes from checkpoint
```

## Independent Subgraph Memory

```python
# Use when subgraph needs its own checkpoint history
# Example: Agent that maintains conversation across parent invocations

agent_subgraph = agent_builder.compile(checkpointer=True)

# Parent with separate checkpointer
parent = parent_builder.compile(
    checkpointer=PostgresSaver.from_conn_string(DATABASE_URL)
)

# Agent maintains its own history per thread
# Parent maintains workflow state
```

## Thread ID Strategies

```python
# Option 1: Shared thread (subgraph checkpoints tied to parent)
config = {"configurable": {"thread_id": "workflow-123"}}

# Option 2: Derived thread IDs (independent subgraph histories)
def call_subgraph(state: ParentState, config: RunnableConfig) -> dict:
    parent_thread = config["configurable"]["thread_id"]
    subgraph_thread = f"{parent_thread}:analyzer"

    subgraph_config = {
        "configurable": {"thread_id": subgraph_thread}
    }

    return subgraph.invoke(input, subgraph_config)
```

## Inspecting Nested State

```python
config = {"configurable": {"thread_id": "workflow-123"}}

# Get state including subgraphs (only when interrupted)
state = graph.get_state(config, subgraphs=True)

# Access parent state
print(state.values)

# Access subgraph states
for task in state.tasks:
    print(f"Subgraph: {task.name}")
    print(f"State: {task.state}")
    print(f"Interrupted: {task.interrupts}")
```

## Resuming Nested Interrupts

```python
from langgraph.types import Command

# Interrupt in subgraph
# Parent invoke stops, returns interrupt info

config = {"configurable": {"thread_id": "workflow-123"}}
result = parent.invoke(inputs, config)

if "__interrupt__" in result:
    # Get user input for subgraph interrupt
    user_response = get_user_input(result["__interrupt__"])

    # Resume entire hierarchy
    final = parent.invoke(Command(resume=user_response), config)
```

## Store vs Checkpointer in Subgraphs

```python
from langgraph.store.postgres import PostgresStore

store = PostgresStore.from_conn_string(DATABASE_URL)
checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)

# Compile with both
parent = parent_builder.compile(
    checkpointer=checkpointer,  # Thread-scoped state
    store=store                  # Cross-thread memory
)

# Subgraph nodes can access store for long-term memory
def subgraph_node(state, *, store: BaseStore):
    # Read cross-thread data
    user_prefs = await store.aget(
        namespace=("users", state["user_id"]),
        key="preferences"
    )
    return state
```

## Anti-Patterns

```python
# DON'T: Different checkpointers for subgraphs
# Causes inconsistent state on failures
subgraph = builder.compile(checkpointer=MemorySaver())
parent = builder.compile(checkpointer=PostgresSaver(...))

# DO: Let parent checkpointer propagate
parent = builder.compile(checkpointer=PostgresSaver(...))
# Subgraphs inherit automatically
```
