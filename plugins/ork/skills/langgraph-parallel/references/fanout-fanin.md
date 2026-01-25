# Fan-Out/Fan-In Pattern

Distribute work across parallel branches and aggregate results.

## Implementation

```python
from langgraph.constants import Send
from typing import Annotated
from operator import add

class ParallelState(TypedDict):
    input: str
    tasks: list[dict]
    results: Annotated[list[dict], add]  # Accumulates from all workers

def create_tasks(state: ParallelState) -> dict:
    """Split work into parallel tasks."""
    return {"tasks": [
        {"id": 1, "chunk": state["input"][:100]},
        {"id": 2, "chunk": state["input"][100:200]},
        {"id": 3, "chunk": state["input"][200:]}
    ]}

def fan_out_router(state: ParallelState):
    """Send to parallel workers."""
    return [Send("worker", {"task": t}) for t in state["tasks"]]

async def worker(state: dict) -> dict:
    """Process single task."""
    result = await process(state["task"])
    return {"results": [result]}

def aggregate(state: ParallelState) -> dict:
    """Combine all worker results."""
    return {"final": merge_results(state["results"])}

workflow.add_conditional_edges("split", fan_out_router)
```

## When to Use

- Processing independent data chunks
- Parallel API calls to different services
- Map-reduce style processing
- Scatter-gather patterns

## Anti-patterns

- Not using `Annotated[list, add]` (results overwrite)
- Too many parallel branches (API rate limits)
- Dependencies between parallel tasks
- No timeout on parallel branches