---
title: Stream Modes
impact: MEDIUM
impactDescription: "Default stream mode returns full state — use 'updates' or 'custom' for efficient UI integration"
tags: streaming, modes, values, updates, messages, custom, debug
---

## Stream Modes

LangGraph provides 5 stream modes. Choose based on your use case.

| Mode | Purpose | Use Case |
|------|---------|----------|
| `values` | Full state after each step | Debugging, state inspection |
| `updates` | State deltas after each step | Efficient UI updates |
| `messages` | LLM tokens + metadata | Chat interfaces, typing indicators |
| `custom` | User-defined events | Progress bars, status updates |
| `debug` | Maximum information | Development, troubleshooting |

**Incorrect — default mode only:**
```python
for chunk in graph.stream(inputs):  # defaults to "values" — full state every step
    print(chunk)  # Massive output, hard to parse
```

**Correct — multiple modes for comprehensive feedback:**
```python
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

**Subgraph streaming:**
```python
for namespace, chunk in graph.stream(inputs, subgraphs=True, stream_mode="updates"):
    print(f"[{'/'.join(namespace) or 'root'}] {chunk}")
```

**Key rules:**
- Use `["updates", "custom"]` for most UIs
- Use `"messages"` for chat interfaces
- Enable `subgraphs=True` for complex nested workflows
- Combine multiple modes in a list for comprehensive output

Reference: [LangGraph Streaming](https://langchain-ai.github.io/langgraph/concepts/streaming/)
