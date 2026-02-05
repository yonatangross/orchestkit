# Stream Modes Reference

Complete guide to LangGraph's 5 streaming modes.

## Mode Comparison

| Mode | Output | Best For |
|------|--------|----------|
| `values` | Full state after each step | Debugging, state inspection |
| `updates` | State deltas only | Efficient UI updates, bandwidth |
| `messages` | LLM tokens + metadata | Chat UIs, typing indicators |
| `custom` | User-defined events | Progress bars, status |
| `debug` | Everything possible | Development, troubleshooting |

## values Mode

```python
# Full state snapshot after each node
for chunk in graph.stream(inputs, stream_mode="values"):
    print(f"Full state: {chunk}")
    # {"messages": [...], "context": {...}, "result": "..."}
```

**Output:** Complete state dictionary after each step.

## updates Mode

```python
# Only the keys that changed
for chunk in graph.stream(inputs, stream_mode="updates"):
    print(f"Changed: {chunk}")
    # {"node_name": {"result": "new_value"}}
```

**Output:** Dictionary with node name → updated keys.

## messages Mode

```python
# LLM token streaming with metadata
for message_chunk, metadata in graph.stream(inputs, stream_mode="messages"):
    print(f"Token: {message_chunk.content}")
    print(f"From node: {metadata['langgraph_node']}")
    print(f"Tags: {metadata.get('tags', [])}")
```

**Output:** Tuple of (AIMessageChunk, metadata dict).

**Metadata fields:**
- `langgraph_node`: Node that produced the token
- `langgraph_step`: Current step number
- `tags`: Tags from the model (if set)
- `run_id`: Unique run identifier

## custom Mode

```python
from langgraph.config import get_stream_writer

def my_node(state):
    writer = get_stream_writer()
    writer({"progress": 50, "status": "halfway"})
    return {"result": "done"}

for chunk in graph.stream(inputs, stream_mode="custom"):
    print(f"Custom event: {chunk}")
    # {"progress": 50, "status": "halfway"}
```

**Output:** Whatever you pass to `writer()`.

## debug Mode

```python
for chunk in graph.stream(inputs, stream_mode="debug"):
    print(f"Debug info: {chunk}")
```

**Output:** Maximum information including internal state, timing, etc.

## Combining Modes

```python
# Multiple modes return (mode, chunk) tuples
for mode, chunk in graph.stream(inputs, stream_mode=["updates", "custom", "messages"]):
    match mode:
        case "updates":
            handle_state_update(chunk)
        case "custom":
            handle_progress(chunk)
        case "messages":
            msg, meta = chunk
            handle_token(msg, meta)
```

## Async Streaming

```python
async for mode, chunk in graph.astream(inputs, stream_mode=["updates", "custom"]):
    await process_chunk(mode, chunk)
```
