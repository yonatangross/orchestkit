# Custom Events Reference

Emit custom events from workflow nodes using StreamWriter.

## Basic Usage

```python
from langgraph.config import get_stream_writer

def processing_node(state: State):
    writer = get_stream_writer()

    # Emit progress events
    writer({"type": "start", "message": "Beginning processing"})

    for i, item in enumerate(state["items"]):
        writer({
            "type": "progress",
            "current": i + 1,
            "total": len(state["items"]),
            "item": item["name"]
        })
        process(item)

    writer({"type": "complete", "message": "All items processed"})

    return {"status": "done"}
```

## Event Schema Design

```python
from pydantic import BaseModel
from typing import Literal

class ProgressEvent(BaseModel):
    type: Literal["progress"]
    current: int
    total: int
    percentage: float
    message: str

class StatusEvent(BaseModel):
    type: Literal["status"]
    status: Literal["running", "paused", "error", "complete"]
    details: str | None = None

class ErrorEvent(BaseModel):
    type: Literal["error"]
    error_code: str
    message: str
    recoverable: bool

# Use in node
def node_with_typed_events(state: State):
    writer = get_stream_writer()

    event = ProgressEvent(
        type="progress",
        current=5,
        total=10,
        percentage=50.0,
        message="Halfway done"
    )
    writer(event.model_dump())

    return state
```

## Consuming Custom Events

```python
# Single mode
for chunk in graph.stream(inputs, stream_mode="custom"):
    event_type = chunk.get("type")
    if event_type == "progress":
        update_progress_bar(chunk["percentage"])
    elif event_type == "error":
        show_error(chunk["message"])

# With other modes
for mode, chunk in graph.stream(inputs, stream_mode=["updates", "custom"]):
    if mode == "custom":
        handle_custom_event(chunk)
```

## From Tools

```python
from langchain_core.tools import tool
from langgraph.config import get_stream_writer

@tool
def long_analysis(data: str) -> str:
    """Analyze data with progress updates."""
    writer = get_stream_writer()

    steps = ["parsing", "analyzing", "summarizing"]
    for i, step in enumerate(steps):
        writer({
            "type": "tool_progress",
            "tool": "long_analysis",
            "step": step,
            "progress": (i + 1) / len(steps) * 100
        })
        execute_step(step, data)

    return "Analysis complete"
```

## Python < 3.11 Async

```python
from langgraph.types import StreamWriter

# Explicit writer injection required
async def async_node(state: State, writer: StreamWriter):
    writer({"status": "started"})
    result = await async_operation()
    writer({"status": "completed"})
    return {"result": result}
```
