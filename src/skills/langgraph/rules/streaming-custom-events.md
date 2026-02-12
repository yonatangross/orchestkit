---
title: Custom Event Streaming
impact: MEDIUM
impactDescription: "Without custom events, clients have no visibility into node progress between state updates"
tags: streaming, custom, events, progress, stream-writer
---

## Custom Event Streaming

Emit progress events from nodes using `get_stream_writer()`. Consume via `stream_mode="custom"`.

**Incorrect — no progress visibility:**
```python
def process_items(state):
    for item in state["items"]:
        result = process(item)  # Client sees nothing until ALL items done
    return {"results": results}
```

**Correct — custom progress events:**
```python
from langgraph.config import get_stream_writer

def node_with_progress(state):
    writer = get_stream_writer()

    for i, item in enumerate(state["items"]):
        writer({
            "type": "progress",
            "current": i + 1,
            "total": len(state["items"]),
            "status": f"Processing {item}",
        })
        result = process(item)

    writer({"type": "complete", "message": "All items processed"})
    return {"results": results}

# Consume custom events
for mode, chunk in graph.stream(inputs, stream_mode=["updates", "custom"]):
    if mode == "custom":
        if chunk.get("type") == "progress":
            print(f"Progress: {chunk['current']}/{chunk['total']}")
    elif mode == "updates":
        print(f"State updated: {list(chunk.keys())}")
```

**FastAPI SSE integration:**
```python
@app.post("/stream")
async def stream_workflow(request: WorkflowRequest):
    async def event_generator():
        async for mode, chunk in graph.astream(
            request.inputs, stream_mode=["updates", "custom"]
        ):
            yield f"data: {json.dumps({'mode': mode, 'data': chunk})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**Key rules:**
- Use `get_stream_writer()` to emit custom events from any node
- Events should have a `type` field for client-side routing
- Include progress data (current, total) for progress bars
- Combine with `stream_mode=["updates", "custom"]` for comprehensive output

Reference: [LangGraph Streaming](https://langchain-ai.github.io/langgraph/concepts/streaming/)
