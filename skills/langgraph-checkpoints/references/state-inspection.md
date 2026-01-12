# State Inspection and Debugging

Inspect and debug workflow state at any checkpoint.

## Implementation

```python
from langgraph.graph import StateGraph

def inspect_workflow(app: StateGraph, thread_id: str):
    """Debug workflow by inspecting state history."""
    config = {"configurable": {"thread_id": thread_id}}

    # Get current state
    current = app.get_state(config)
    print(f"Current node: {current.next}")
    print(f"Values: {current.values}")

    # Get full history
    history = list(app.get_state_history(config))
    for i, checkpoint in enumerate(history):
        print(f"\n--- Step {len(history) - i} ---")
        print(f"Node: {checkpoint.metadata.get('source', 'unknown')}")
        print(f"State: {checkpoint.values}")

def rollback_to_step(app: StateGraph, thread_id: str, steps_back: int):
    """Rollback workflow to a previous checkpoint."""
    config = {"configurable": {"thread_id": thread_id}}
    history = list(app.get_state_history(config))

    if steps_back >= len(history):
        raise ValueError(f"Only {len(history)} steps available")

    previous_state = history[steps_back]
    app.update_state(config, previous_state.values)
    print(f"Rolled back to step {len(history) - steps_back}")
```

## When to Use

- Debugging failed workflows
- Understanding state transitions
- Rolling back to fix errors
- Testing checkpoint integrity

## Anti-patterns

- No structured logging of state changes
- Modifying production checkpoints carelessly
- Not preserving checkpoint metadata
- Ignoring state history limits