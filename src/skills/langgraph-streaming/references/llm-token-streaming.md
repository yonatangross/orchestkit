# LLM Token Streaming Reference

Stream tokens from LLM calls in real-time.

## Basic Token Streaming

```python
for message_chunk, metadata in graph.stream(
    {"messages": [("user", "Write a poem about AI")]},
    stream_mode="messages"
):
    if message_chunk.content:
        print(message_chunk.content, end="", flush=True)
```

## Metadata Filtering

### Filter by Node

```python
for msg, meta in graph.stream(inputs, stream_mode="messages"):
    # Only show tokens from specific node
    if meta["langgraph_node"] == "writer":
        print(msg.content, end="")
```

### Filter by Tags

```python
# Tag your model
model = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    tags=["main_response"]
)

# Filter by tag
for msg, meta in graph.stream(inputs, stream_mode="messages"):
    if "main_response" in meta.get("tags", []):
        print(msg.content, end="")
```

### Filter by Step

```python
for msg, meta in graph.stream(inputs, stream_mode="messages"):
    if meta["langgraph_step"] > 2:  # Skip early steps
        print(msg.content, end="")
```

## Metadata Fields

```python
metadata = {
    "langgraph_node": "agent",      # Node that invoked LLM
    "langgraph_step": 3,            # Current execution step
    "langgraph_triggers": ["..."],  # What triggered this node
    "run_id": "abc-123",            # Unique run ID
    "tags": ["main_response"],      # Model tags
    "ls_model_name": "claude-...",  # Model identifier
}
```

## Chat UI Integration

```python
async def stream_chat_response(user_message: str):
    """Stream response for chat UI."""
    buffer = []

    async for msg, meta in graph.astream(
        {"messages": [("user", user_message)]},
        stream_mode="messages"
    ):
        if meta["langgraph_node"] == "assistant":
            if msg.content:
                buffer.append(msg.content)
                yield msg.content  # Yield each chunk

    # Return full message for storage
    return "".join(buffer)
```

## With Tool Calls

```python
for msg, meta in graph.stream(inputs, stream_mode="messages"):
    if msg.content:
        # Regular text content
        print(msg.content, end="")
    elif msg.tool_calls:
        # Tool call (not streamed token-by-token)
        for tc in msg.tool_calls:
            print(f"\n[Calling tool: {tc['name']}]")
```

## Disable Streaming

```python
# For models that don't support streaming
model = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    streaming=False
)

# Or with disable_streaming
model = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    disable_streaming=True
)
```
