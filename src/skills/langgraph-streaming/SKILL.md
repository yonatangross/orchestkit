---
name: langgraph-streaming
description: LangGraph streaming patterns for real-time updates. Use when implementing progress indicators, token streaming, custom events, or real-time user feedback in workflows.
tags: [langgraph, streaming, real-time, events]
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# LangGraph Streaming

Real-time updates and progress tracking for LangGraph workflows.

## 5 Stream Modes

```python
# Available modes
for mode, chunk in graph.stream(inputs, stream_mode=["values", "updates", "messages", "custom", "debug"]):
    print(f"[{mode}] {chunk}")
```

| Mode | Purpose | Use Case |
|------|---------|----------|
| **values** | Full state after each step | Debugging, state inspection |
| **updates** | State deltas after each step | Efficient UI updates |
| **messages** | LLM tokens + metadata | Chat interfaces, typing indicators |
| **custom** | User-defined events | Progress bars, status updates |
| **debug** | Maximum information | Development, troubleshooting |

## Custom Events with StreamWriter

```python
from langgraph.config import get_stream_writer

def node_with_progress(state: State):
    """Emit custom progress events."""
    writer = get_stream_writer()

    for i, item in enumerate(state["items"]):
        writer({
            "type": "progress",
            "current": i + 1,
            "total": len(state["items"]),
            "status": f"Processing {item}"
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

## LLM Token Streaming

```python
# Stream tokens from LLM calls
for message_chunk, metadata in graph.stream(
    {"topic": "AI safety"},
    stream_mode="messages"
):
    if message_chunk.content:
        print(message_chunk.content, end="", flush=True)

# Filter by node
for msg, meta in graph.stream(inputs, stream_mode="messages"):
    if meta["langgraph_node"] == "writer_agent":
        print(msg.content, end="")

# Filter by tags
model = init_chat_model("claude-sonnet-4-20250514", tags=["main_response"])

for msg, meta in graph.stream(inputs, stream_mode="messages"):
    if "main_response" in meta.get("tags", []):
        print(msg.content, end="")
```

## Subgraph Streaming

```python
# Enable subgraph visibility
for namespace, chunk in graph.stream(
    inputs,
    subgraphs=True,
    stream_mode="updates"
):
    # namespace shows graph hierarchy: (), ("child",), ("child", "grandchild")
    print(f"[{'/'.join(namespace) or 'root'}] {chunk}")
```

## Multiple Modes Simultaneously

```python
# Combine modes for comprehensive feedback
async for mode, chunk in graph.astream(
    inputs,
    stream_mode=["updates", "custom", "messages"]
):
    match mode:
        case "updates":
            update_ui_state(chunk)
        case "custom":
            show_progress(chunk)
        case "messages":
            append_to_chat(chunk)
```

## Non-LangChain LLM Streaming

```python
def call_custom_llm(state: State):
    """Stream from arbitrary LLM APIs."""
    writer = get_stream_writer()

    for chunk in your_streaming_client.generate(state["prompt"]):
        writer({"type": "llm_token", "content": chunk.text})

    return {"response": full_response}
```

## FastAPI SSE Integration

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

@app.post("/stream")
async def stream_workflow(request: WorkflowRequest):
    async def event_generator():
        async for mode, chunk in graph.astream(
            request.inputs,
            stream_mode=["updates", "custom"]
        ):
            yield f"data: {json.dumps({'mode': mode, 'data': chunk})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
```

## Python < 3.11 Async

```python
# Manual config propagation required
async def call_model(state: State, config: RunnableConfig):
    response = await model.ainvoke(state["messages"], config)
    return {"messages": [response]}

# Explicit writer injection
async def node_with_custom_stream(state: State, writer: StreamWriter):
    writer({"status": "processing"})
    result = await process_async(state)
    return {"result": result}
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Mode selection | Use `["updates", "custom"]` for most UIs |
| Token streaming | Use `messages` mode with node filtering |
| Progress tracking | Use custom mode with `get_stream_writer()` |
| Subgraph visibility | Enable `subgraphs=True` for complex workflows |

## Common Mistakes

- Forgetting `stream_mode` parameter (defaults to `values` only)
- Not handling async properly in Python < 3.11
- Missing `flush=True` on print for real-time display
- Not filtering messages by node/tags (noisy output)

## Evaluations

See [references/evaluations.md](references/evaluations.md) for test cases.

## Related Skills

- `langgraph-subgraphs` - Stream updates from nested graphs
- `langgraph-human-in-loop` - Stream status while awaiting human
- `langgraph-supervisor` - Stream agent progress in supervisor workflows
- `langgraph-parallel` - Stream from parallel execution branches
- `langgraph-tools` - Stream tool execution progress
- `api-design-framework` - SSE endpoint design patterns

## Capability Details

### stream-modes
**Keywords:** stream mode, values, updates, messages, custom, debug
**Solves:**
- Configure streaming output format
- Choose appropriate mode for use case
- Combine multiple stream modes

### custom-events
**Keywords:** custom event, progress, status, stream writer, get_stream_writer
**Solves:**
- Emit custom progress events
- Track workflow status
- Implement progress bars

### token-streaming
**Keywords:** token, LLM stream, chat, typing indicator, messages mode
**Solves:**
- Stream LLM tokens in real-time
- Build chat interfaces
- Show typing indicators

### subgraph-streaming
**Keywords:** subgraph, nested, hierarchy, namespace
**Solves:**
- Stream from nested graphs
- Track subgraph progress
- Debug complex workflows
