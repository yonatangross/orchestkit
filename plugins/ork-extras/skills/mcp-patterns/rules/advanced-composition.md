---
title: Compose multi-tool MCP workflows with error isolation to avoid brittle spaghetti code
impact: MEDIUM
impactDescription: "Without composition patterns, complex multi-tool workflows become brittle spaghetti code with no error isolation"
tags: composition, pipeline, parallel, branching, tool-orchestration
---

## Advanced Composition

Compose multiple MCP tools into pipelines, parallel fans, or conditional branches.

**Incorrect -- manual sequential calls with no error handling:**
```python
result1 = await tool_a(data)
result2 = await tool_b(result1)  # Crashes if tool_a fails
result3 = await tool_c(result2)  # No way to recover
```

**Correct -- pipeline composition with error propagation:**
```python
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

@dataclass
class ToolResult:
    success: bool
    data: Any
    error: str | None = None

@dataclass
class ComposedTool:
    name: str
    tools: dict[str, Callable[..., Awaitable[ToolResult]]]
    pipeline: list[str]

    async def execute(self, input_data: dict[str, Any]) -> ToolResult:
        result = ToolResult(success=True, data=input_data)
        for tool_name in self.pipeline:
            if not result.success:
                break
            try:
                result = await self.tools[tool_name](result.data)
            except Exception as e:
                result = ToolResult(success=False, data=None,
                                    error=f"'{tool_name}' failed: {e}")
        return result

# Usage: search then summarize
search_summarize = ComposedTool(
    name="search_and_summarize",
    tools={"search": search_docs, "summarize": summarize_content},
    pipeline=["search", "summarize"],
)
```

**Correct -- parallel composition with error isolation:**
```python
import asyncio

async def parallel_execute(
    tools: dict[str, Callable],
    input_data: dict,
) -> list[ToolResult]:
    tasks = [
        asyncio.create_task(tool(input_data))
        for tool in tools.values()
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    return [
        ToolResult(success=False, data=None, error=str(r))
        if isinstance(r, Exception) else r
        for r in results
    ]
```

**Correct -- conditional branching:**
```python
def content_router(data: dict) -> str:
    return {
        "text": "text_processor",
        "image": "image_analyzer",
        "audio": "audio_transcriber",
    }.get(data.get("type", "text"), "text_processor")

# Route to the right tool based on input
tool_name = content_router(input_data)
result = await tools[tool_name](input_data)
```

**Key rules:**
- Pipeline: stop on first failure, propagate error context
- Parallel: use `return_exceptions=True` to isolate failures
- Branching: always include a default/fallback route
- Keep composition depth shallow (3-4 steps max)
