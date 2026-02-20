---
title: Accumulate tool call chunks carefully when handling structured output within LLM streams
impact: HIGH
impactDescription: "Handling tool calls within streams requires careful chunk accumulation"
tags: [streaming, tool-calls, partial-json, chunk-accumulation, structured]
---

# Streaming with Tool Calls & Structured Data

## Streaming with Tool Call Accumulation

```python
async def stream_with_tools(messages: list, tools: list):
    """Handle streaming responses that include tool calls."""
    stream = await client.chat.completions.create(
        model="gpt-5.2",
        messages=messages,
        tools=tools,
        stream=True
    )

    collected_content = ""
    collected_tool_calls = []

    async for chunk in stream:
        delta = chunk.choices[0].delta

        # Collect content tokens
        if delta.content:
            collected_content += delta.content
            yield {"type": "content", "data": delta.content}

        # Collect tool call chunks
        if delta.tool_calls:
            for tc in delta.tool_calls:
                # Tool calls come in chunks, accumulate them
                if tc.index >= len(collected_tool_calls):
                    collected_tool_calls.append({
                        "id": tc.id,
                        "function": {"name": "", "arguments": ""}
                    })

                if tc.function.name:
                    collected_tool_calls[tc.index]["function"]["name"] += tc.function.name
                if tc.function.arguments:
                    collected_tool_calls[tc.index]["function"]["arguments"] += tc.function.arguments

    # If tool calls, execute them
    if collected_tool_calls:
        yield {"type": "tool_calls", "data": collected_tool_calls}
```

## Partial JSON Parsing

When streaming structured output, JSON arrives incrementally. Use libraries like `partial-json-parser` or accumulate until complete:

```python
import json

def try_parse_partial_json(buffer: str) -> dict | None:
    """Attempt to parse partial JSON, returning None if incomplete."""
    try:
        return json.loads(buffer)
    except json.JSONDecodeError:
        return None

async def stream_structured_output(prompt: str):
    """Stream and incrementally parse structured output."""
    buffer = ""
    async for token in async_stream(prompt):
        buffer += token
        parsed = try_parse_partial_json(buffer)
        if parsed:
            yield {"type": "parsed", "data": parsed}
        else:
            yield {"type": "partial", "data": buffer}
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Tool call handling | Accumulate chunks by index |
| Partial JSON | Try-parse or use dedicated parser |
| Content vs tools | Separate by delta type |
| Post-stream | Execute tools after full accumulation |

## Common Mistakes

- Attempting to parse tool call arguments before fully accumulated
- Not handling the case where both content and tool calls appear
- Losing tool call chunks due to incorrect index tracking
- Not signaling stream completion to consumers

**Incorrect — parsing incomplete tool call arguments:**
```python
async for chunk in stream:
    if chunk.choices[0].delta.tool_calls:
        tc = chunk.choices[0].delta.tool_calls[0]
        # Parse before accumulation completes
        args = json.loads(tc.function.arguments)  # JSONDecodeError on partial data
        execute_tool(tc.function.name, args)
```

**Correct — accumulating tool calls before parsing:**
```python
collected_tool_calls = []
async for chunk in stream:
    if chunk.choices[0].delta.tool_calls:
        for tc in chunk.choices[0].delta.tool_calls:
            if tc.index >= len(collected_tool_calls):
                collected_tool_calls.append({"function": {"arguments": ""}})
            collected_tool_calls[tc.index]["function"]["arguments"] += tc.function.arguments

# Parse after stream completes
for tc in collected_tool_calls:
    args = json.loads(tc["function"]["arguments"])
```
