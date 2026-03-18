---
title: Use streaming v2 format for type-safe real-time output
impact: MEDIUM
impactDescription: "v1 streaming returns untyped dicts — v2 adds full type safety on stream(), astream(), invoke(), ainvoke()"
tags: streaming, v2, type-safety, langgraph-1.1
---

## Streaming v2 Format (LangGraph 1.1+)

LangGraph 1.1 introduces `version="v2"` — an opt-in streaming format that brings full type safety to all streaming and invocation methods. Default remains `"v1"` for backwards compatibility.

**Incorrect — untyped v1 invoke (default):**
```python
result = graph.invoke({"input": "hello"})
output = result["output"]  # Any — no type info
interrupts = result.get("__interrupt__")  # magic key
```

**Correct — typed v2 invoke:**
```python
from langgraph.types import GraphOutput

result = graph.invoke({"input": "hello"}, version="v2")
result.value       # OutputT — auto-coerced to Pydantic/dataclass if typed
result.interrupts  # tuple[Interrupt, ...] — replaces __interrupt__ key
```

**Correct — typed v2 streaming:**
```python
async for part in graph.astream(
    inputs,
    stream_mode=["updates", "messages"],
    version="v2",
):
    # part is a typed StreamPart discriminated union
    if part["type"] == "updates":
        handle_state_update(part["data"])  # dict[str, Any]
    elif part["type"] == "messages":
        msg, metadata = part["data"]       # tuple[AnyMessage, dict]
    elif part["type"] == "custom":
        show_progress(part["data"])        # Any — StreamWriter content
```

**StreamPart types** (importable from `langgraph.types`):
`ValuesStreamPart`, `UpdatesStreamPart`, `MessagesStreamPart`, `CustomStreamPart`, `CheckpointStreamPart`, `TasksStreamPart`, `DebugStreamPart`. All share `type`, `ns`, `data` fields.

**Pydantic auto-coercion:**
```python
class MyState(BaseModel):
    answer: str

result = compiled.invoke({...}, version="v2")
assert isinstance(result.value, MyState)  # auto-coerced — not a plain dict
```

**Key rules:**
- Default remains `version="v1"` — existing code is unaffected
- Opt in with `version="v2"` on `stream()`, `astream()`, `invoke()`, `ainvoke()`
- Replace `result["key"]` with `result.value` (dict access emits deprecation warnings in v2)
- Replace `result["__interrupt__"]` with `result.interrupts`
- Graph construction, checkpointers, and tool calling are **unchanged**
- Future major version will default to v2

Reference: [LangGraph 1.1 Release Notes](https://github.com/langchain-ai/langgraph/releases)
