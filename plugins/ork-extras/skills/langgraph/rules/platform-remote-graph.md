---
title: Use RemoteGraph to invoke deployed LangGraph instances from client code
impact: HIGH
impactDescription: "Calling deployed graphs without RemoteGraph requires manual HTTP/SDK plumbing — error-prone and misses streaming"
tags: platform, remote-graph, client, deployment, streaming
---

## RemoteGraph

`RemoteGraph` provides a graph-compatible interface for calling deployed LangGraph instances. It supports sync/async invocation, streaming, and state management.

**Incorrect — manual HTTP calls:**
```python
import httpx

# Manual API calls lose type safety and streaming support
response = httpx.post(
    "http://localhost:2024/runs",
    json={"input": {"messages": [{"role": "user", "content": "hello"}]}},
)
```

**Correct — RemoteGraph (sync):**
```python
from langgraph.pregel.remote import RemoteGraph

remote = RemoteGraph(
    "my_agent",
    url="http://localhost:2024",
)

# Invoke like a local graph
result = remote.invoke(
    {"messages": [{"role": "user", "content": "Analyze this data"}]},
    config={"configurable": {"thread_id": "remote-123"}},
)
```

**Async invocation:**
```python
from langgraph.pregel.remote import RemoteGraph

remote = RemoteGraph(
    "my_agent",
    url="http://localhost:2024",
)

result = await remote.ainvoke(
    {"messages": [{"role": "user", "content": "Analyze this data"}]},
    config={"configurable": {"thread_id": "remote-123"}},
)
```

**Streaming from remote graphs:**
```python
# Stream updates in real-time
async for chunk in remote.astream(
    {"messages": [{"role": "user", "content": "Write a report"}]},
    config={"configurable": {"thread_id": "stream-456"}},
    stream_mode="updates",
):
    print(chunk)

# Stream events for fine-grained control
async for event in remote.astream_events(
    {"messages": [{"role": "user", "content": "Summarize"}]},
    config={"configurable": {"thread_id": "events-789"}},
    version="v2",
):
    if event["event"] == "on_chat_model_stream":
        print(event["data"]["chunk"].content, end="")
```

**Use as a subgraph node:**
```python
from langgraph.graph import StateGraph, START, END
from langgraph.pregel.remote import RemoteGraph

remote_analyzer = RemoteGraph("analyzer", url="http://analyzer:2024")

builder = StateGraph(OrchestratorState)
builder.add_node("analyze", remote_analyzer)  # Remote graph as local node
builder.add_node("summarize", summarize_node)
builder.add_edge(START, "analyze")
builder.add_edge("analyze", "summarize")
builder.add_edge("summarize", END)
```

**Key rules:**
- Import from `langgraph.pregel.remote import RemoteGraph`
- First argument is the `graph_id` matching the key in `langgraph.json`
- Supports `invoke`, `ainvoke`, `stream`, `astream`, `astream_events`
- Use `thread_id` in config for stateful conversations
- Can be added as a node in a parent graph for distributed orchestration
- Handle `httpx.ConnectError` and `httpx.TimeoutException` for network failures

Reference: [RemoteGraph](https://langchain-ai.github.io/langgraph/concepts/langgraph_platform/#remotegraph)
