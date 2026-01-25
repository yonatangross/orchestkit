# TypedDict State Pattern

Lightweight state definition using Python's TypedDict for LangGraph workflows.

## Implementation

```python
from typing import TypedDict, Annotated
from operator import add

class WorkflowState(TypedDict):
    """Simple state with accumulating results."""
    input: str
    output: str
    agent_responses: Annotated[list[dict], add]  # Accumulates across nodes
    metadata: dict
    error: str | None

def process_node(state: WorkflowState) -> dict:
    """Return partial state update (immutable)."""
    return {
        "output": f"Processed: {state['input']}",
        "agent_responses": [{"node": "process", "status": "done"}]
    }
```

## When to Use

- Internal workflow state (no validation overhead)
- Simple key-value state structures
- Performance-critical graphs
- When IDE type hints are sufficient

## Anti-patterns

- Using TypedDict for API input/output (use Pydantic instead)
- Mutating state in place (breaks checkpointing)
- Forgetting `Annotated[list, add]` for accumulating fields
- Deeply nested state structures (hard to debug)