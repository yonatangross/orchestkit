# State Recovery Pattern

Resume workflows after crashes or interruptions.

## Implementation

```python
import logging
from langgraph.graph import StateGraph

async def run_with_recovery(
    app: StateGraph,
    workflow_id: str,
    initial_state: dict
) -> dict:
    """Run workflow with automatic recovery."""
    config = {"configurable": {"thread_id": workflow_id}}

    # Try to resume existing workflow
    try:
        existing_state = app.get_state(config)
        if existing_state and existing_state.values:
            logging.info(f"Resuming workflow {workflow_id}")
            return await app.ainvoke(None, config=config)
    except Exception as e:
        logging.debug(f"No existing checkpoint: {e}")

    # Start fresh workflow
    logging.info(f"Starting new workflow {workflow_id}")
    return await app.ainvoke(initial_state, config=config)

# Usage
result = await run_with_recovery(
    app=compiled_workflow,
    workflow_id="order-processing-12345",
    initial_state={"order_id": "12345", "items": [...]}
)
```

## When to Use

- Crash recovery for critical workflows
- Idempotent workflow execution
- Long-running batch processing
- High-availability requirements

## Anti-patterns

- Not checking for existing checkpoints
- Ignoring checkpoint version mismatches
- Resuming with new initial state (conflicts)
- No logging of recovery events