---
title: Silent Tool Skipping Detection
impact: CRITICAL
impactDescription: "Agents silently skipping expected tool calls produce plausible but wrong results — no error raised, just incorrect output"
tags: monitoring, silent-failure, tool-skipping, agent, observability
---

## Silent Tool Skipping Detection

Detect when LLM agents skip expected tool calls without raising errors.

**Incorrect — assuming success if no error:**
```python
result = await agent.run()
# No error raised, but agent skipped the search tool entirely
# Result is fabricated from training data, not real data
return result  # Wrong answer delivered confidently
```

**Correct — validate tool usage against expectations:**
```python
from langfuse import Langfuse

def check_tool_usage(trace_id: str, expected_tools: list[str]) -> dict:
    langfuse = Langfuse()
    trace = langfuse.fetch_trace(trace_id)

    actual_tools = [
        span.name for span in trace.observations
        if span.type == "tool"
    ]

    missing_tools = set(expected_tools) - set(actual_tools)

    if missing_tools:
        return {
            "alert": True,
            "type": "tool_skipping",
            "missing": list(missing_tools),
            "message": f"Agent skipped expected tools: {missing_tools}"
        }
    return {"alert": False}

# Usage
expected_tools = ["search", "calculate"]
tool_check = check_tool_usage(trace_id, expected_tools)
if tool_check["alert"]:
    alert(tool_check)
    fallback_to_manual_execution()
```

**Key rules:**
- Never assume success just because no error was raised
- Define expected tool lists per agent task and validate after execution
- Tool skipping is often caused by middleware interference or prompt changes
- Alert on tool skipping with Critical priority — it produces wrong results silently
- Always have a fallback path when expected tools are not called
