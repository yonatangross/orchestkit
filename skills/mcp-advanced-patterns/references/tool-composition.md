# Tool Composition Patterns

Patterns for combining multiple MCP tools into orchestrated workflows.

## Pipeline Composition

```python
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable
from collections.abc import AsyncIterator
import asyncio

@dataclass
class ToolResult:
    """Result from a tool execution."""
    success: bool
    data: Any
    error: str | None = None
    metadata: dict = field(default_factory=dict)

@dataclass
class ComposedTool:
    """Combine multiple tools into a pipeline."""
    name: str
    description: str
    tools: dict[str, Callable[..., Awaitable[ToolResult]]]
    pipeline: list[str]
    error_handler: Callable[[str, Exception], ToolResult] | None = None

    async def execute(self, input_data: dict[str, Any]) -> ToolResult:
        """Execute tool pipeline with error handling."""
        result = ToolResult(success=True, data=input_data)

        for tool_name in self.pipeline:
            if not result.success:
                break

            tool = self.tools.get(tool_name)
            if not tool:
                return ToolResult(
                    success=False,
                    data=None,
                    error=f"Tool '{tool_name}' not found"
                )

            try:
                result = await tool(result.data)
            except Exception as e:
                if self.error_handler:
                    result = self.error_handler(tool_name, e)
                else:
                    result = ToolResult(
                        success=False,
                        data=None,
                        error=f"Tool '{tool_name}' failed: {str(e)}"
                    )

        return result
```

## Parallel Tool Execution

```python
@dataclass
class ParallelComposition:
    """Execute multiple tools in parallel and merge results."""
    name: str
    tools: dict[str, Callable[..., Awaitable[ToolResult]]]
    merge_strategy: Callable[[list[ToolResult]], ToolResult]

    async def execute(self, input_data: dict[str, Any]) -> ToolResult:
        """Run all tools in parallel."""
        tasks = [
            asyncio.create_task(tool(input_data))
            for tool in self.tools.values()
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Convert exceptions to ToolResults
        processed = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed.append(ToolResult(
                    success=False,
                    data=None,
                    error=str(result)
                ))
            else:
                processed.append(result)

        return self.merge_strategy(processed)


def merge_all_successful(results: list[ToolResult]) -> ToolResult:
    """Merge strategy: require all tools to succeed."""
    if all(r.success for r in results):
        return ToolResult(
            success=True,
            data=[r.data for r in results],
            metadata={"tool_count": len(results)}
        )
    errors = [r.error for r in results if not r.success]
    return ToolResult(success=False, data=None, error="; ".join(errors))


def merge_any_successful(results: list[ToolResult]) -> ToolResult:
    """Merge strategy: succeed if any tool succeeds."""
    successful = [r for r in results if r.success]
    if successful:
        return ToolResult(
            success=True,
            data=[r.data for r in successful],
            metadata={"successful_count": len(successful)}
        )
    errors = [r.error for r in results if not r.success]
    return ToolResult(success=False, data=None, error="; ".join(errors))
```

## Conditional Branching

```python
@dataclass
class BranchingComposition:
    """Execute tools based on conditions."""
    name: str
    tools: dict[str, Callable[..., Awaitable[ToolResult]]]
    router: Callable[[dict[str, Any]], str]  # Returns tool name to use

    async def execute(self, input_data: dict[str, Any]) -> ToolResult:
        """Route to appropriate tool based on input."""
        tool_name = self.router(input_data)

        tool = self.tools.get(tool_name)
        if not tool:
            return ToolResult(
                success=False,
                data=None,
                error=f"Router selected unknown tool: {tool_name}"
            )

        return await tool(input_data)


# Example: Route based on content type
def content_type_router(data: dict) -> str:
    content_type = data.get("type", "text")
    return {
        "text": "text_processor",
        "image": "image_analyzer",
        "audio": "audio_transcriber",
    }.get(content_type, "text_processor")
```

## Retry Composition

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_result
)

@dataclass
class RetryableComposition:
    """Wrap tool with retry logic."""
    tool: Callable[..., Awaitable[ToolResult]]
    max_attempts: int = 3
    min_wait: float = 1.0
    max_wait: float = 10.0

    async def execute(self, input_data: dict[str, Any]) -> ToolResult:
        """Execute with exponential backoff retry."""

        @retry(
            stop=stop_after_attempt(self.max_attempts),
            wait=wait_exponential(min=self.min_wait, max=self.max_wait),
            retry=retry_if_result(lambda r: not r.success)
        )
        async def _execute_with_retry():
            return await self.tool(input_data)

        try:
            return await _execute_with_retry()
        except Exception as e:
            return ToolResult(
                success=False,
                data=None,
                error=f"All {self.max_attempts} attempts failed: {str(e)}"
            )
```

## Streaming Composition

```python
async def streaming_pipeline(
    tools: list[Callable[[AsyncIterator[Any]], AsyncIterator[Any]]],
    source: AsyncIterator[Any]
) -> AsyncIterator[Any]:
    """Chain tools that process streams."""
    current = source

    for tool in tools:
        current = tool(current)

    async for item in current:
        yield item


# Example streaming tools
async def filter_tool(stream: AsyncIterator[dict]) -> AsyncIterator[dict]:
    """Filter items based on condition."""
    async for item in stream:
        if item.get("valid", False):
            yield item


async def transform_tool(stream: AsyncIterator[dict]) -> AsyncIterator[dict]:
    """Transform each item."""
    async for item in stream:
        yield {**item, "processed": True}
```

## Best Practices

| Pattern | Use Case | Complexity |
|---------|----------|------------|
| Pipeline | Sequential processing | Low |
| Parallel | Independent operations | Medium |
| Branching | Conditional routing | Medium |
| Retry | Unreliable tools | Low |
| Streaming | Large data processing | High |

## Error Handling Strategies

```python
def default_error_handler(tool_name: str, error: Exception) -> ToolResult:
    """Default error handler with logging."""
    import structlog
    logger = structlog.get_logger()

    logger.error(
        "tool_execution_failed",
        tool_name=tool_name,
        error=str(error),
        error_type=type(error).__name__
    )

    return ToolResult(
        success=False,
        data=None,
        error=f"{tool_name}: {str(error)}"
    )


def fallback_error_handler(
    fallback_tool: Callable[..., Awaitable[ToolResult]]
) -> Callable[[str, Exception], ToolResult]:
    """Create handler that falls back to another tool."""

    async def handler(tool_name: str, error: Exception) -> ToolResult:
        # Log original error
        import structlog
        structlog.get_logger().warning(
            "tool_fallback_triggered",
            original_tool=tool_name,
            error=str(error)
        )
        # Execute fallback (caller must await)
        return await fallback_tool({})

    return handler
```
