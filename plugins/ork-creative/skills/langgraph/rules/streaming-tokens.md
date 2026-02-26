---
title: Filter LLM token streams by node or tags to avoid cross-node noise
impact: MEDIUM
impactDescription: "Unfiltered token streaming shows tokens from ALL nodes — filter by node or tags"
tags: streaming, tokens, messages, llm, chat, filtering
---

## LLM Token Streaming

Stream LLM tokens in real-time. Filter by node name or model tags to control output.

**Incorrect — no filtering, noisy output:**
```python
for msg, meta in graph.stream(inputs, stream_mode="messages"):
    print(msg.content, end="")  # Shows tokens from ALL LLM calls — mixed output
```

**Correct — filtered by node:**
```python
for msg, meta in graph.stream(inputs, stream_mode="messages"):
    if meta["langgraph_node"] == "writer_agent":
        print(msg.content, end="", flush=True)
```

**Filtered by tags (more flexible):**
```python
model = init_chat_model("claude-sonnet-4-20250514", tags=["main_response"])

for msg, meta in graph.stream(inputs, stream_mode="messages"):
    if "main_response" in meta.get("tags", []):
        print(msg.content, end="", flush=True)
```

**Non-LangChain LLM streaming:**
```python
from langgraph.config import get_stream_writer

def call_custom_llm(state):
    writer = get_stream_writer()
    for chunk in your_streaming_client.generate(state["prompt"]):
        writer({"type": "llm_token", "content": chunk.text})
    return {"response": full_response}
```

**Key rules:**
- Use `stream_mode="messages"` for token-by-token streaming
- Filter by `meta["langgraph_node"]` or `meta["tags"]` to isolate output
- Use `flush=True` on print for real-time display
- Use `get_stream_writer()` for non-LangChain LLM APIs

Reference: [LangGraph Streaming](https://langchain-ai.github.io/langgraph/concepts/streaming/)
