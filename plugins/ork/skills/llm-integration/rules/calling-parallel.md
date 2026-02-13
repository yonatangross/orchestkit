---
title: "Function Calling: Parallel Execution"
impact: HIGH
impactDescription: "Parallel tool calls reduce latency but require careful handling with strict mode"
tags: [parallel, concurrent, asyncio, tool-calls, batch]
---

# Parallel Tool Calls

## Basic Parallel Execution

```python
# OpenAI supports parallel tool calls
response = await llm.chat(
    messages=messages,
    tools=tools,
    parallel_tool_calls=True  # Default in GPT-5 series
)

# Handle multiple calls in parallel
if response.tool_calls:
    results = await asyncio.gather(*[
        execute_tool(tc.function.name, json.loads(tc.function.arguments))
        for tc in response.tool_calls
    ])
```

## Strict Mode Constraint

```python
# Structured outputs with strict=True may not work with parallel_tool_calls
# If using strict mode schemas, disable parallel calls:
response = await llm.chat(
    messages=messages,
    tools=tools_with_strict_true,
    parallel_tool_calls=False  # Required for strict mode reliability
)
```

## Handling Partial Failures

```python
async def execute_tools_parallel(tool_calls: list) -> list[dict]:
    """Execute tool calls in parallel with error handling."""
    async def safe_execute(tc):
        try:
            result = await execute_tool(
                tc.function.name,
                json.loads(tc.function.arguments)
            )
            return {"tool_call_id": tc.id, "content": json.dumps(result)}
        except Exception as e:
            return {"tool_call_id": tc.id, "content": json.dumps({"error": str(e)})}

    results = await asyncio.gather(*[safe_execute(tc) for tc in tool_calls])
    return [{"role": "tool", **r} for r in results]
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Parallel calls | Disable with strict mode |
| Error handling | Return error as tool result |
| Max concurrent | 5-10 (avoid rate limits) |
| Timeout | 30s per tool call |

## Common Mistakes

- Enabling parallel_tool_calls with strict mode schemas
- Not handling individual tool failures in gather
- Exceeding API rate limits with too many concurrent calls
- Missing tool_call_id in response messages
