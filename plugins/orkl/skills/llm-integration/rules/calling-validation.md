---
title: "Function Calling: Validation & Execution Loop"
impact: CRITICAL
impactDescription: "Proper validation and execution loops prevent crashes and infinite tool call cycles"
tags: [validation, execution-loop, pydantic, error-handling, tool-routing]
---

# Tool Validation & Execution Loop

## Tool Execution Loop

```python
async def run_with_tools(messages: list, tools: list) -> str:
    """Execute tool calls until LLM returns final answer."""
    while True:
        response = await llm.chat(messages=messages, tools=tools)

        # Check if LLM wants to call tools
        if not response.tool_calls:
            return response.content

        # Execute each tool call
        for tool_call in response.tool_calls:
            result = await execute_tool(
                tool_call.function.name,
                json.loads(tool_call.function.arguments)
            )

            # Add tool result to conversation
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result)
            })

        # Continue loop (LLM will process tool results)
```

## Tool Registry with Validation

```python
class ToolRegistry:
    """Registry for managing tool definitions and execution."""

    def __init__(self):
        self.tools: dict[str, Callable] = {}
        self.schemas: list[dict] = []

    def register(self, func: Callable) -> Callable:
        """Register a function as a tool."""
        schema = self._extract_schema(func)
        self.tools[func.__name__] = func
        self.schemas.append(schema)
        return func

    async def execute(self, name: str, args: dict) -> Any:
        """Execute a registered tool with validation."""
        if name not in self.tools:
            raise ValueError(f"Unknown tool: {name}")
        func = self.tools[name]
        if asyncio.iscoroutinefunction(func):
            return await func(**args)
        return func(**args)
```

## Guarded Execution Loop

```python
async def run_tool_loop(
    registry: ToolRegistry,
    user_message: str,
    model: str = "gpt-5.2",
    max_iterations: int = 10
) -> str:
    """Run tool execution loop with iteration guard."""
    client = AsyncOpenAI()
    messages = [{"role": "user", "content": user_message}]

    for _ in range(max_iterations):
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=registry.schemas,
            parallel_tool_calls=False
        )

        message = response.choices[0].message
        if not message.tool_calls:
            return message.content

        messages.append(message.model_dump())

        for tool_call in message.tool_calls:
            try:
                result = await registry.execute(
                    tool_call.function.name,
                    json.loads(tool_call.function.arguments)
                )
            except Exception as e:
                result = {"error": str(e)}

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result)
            })

    raise RuntimeError("Max iterations reached")
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Max iterations | 10 (prevent infinite loops) |
| Error handling | Return error as tool result |
| Input validation | Use Pydantic/Zod |
| Tool routing | Registry pattern with name lookup |

## Common Mistakes

- No max iteration guard (infinite tool call loops)
- Crashing on tool failure instead of returning error
- No input validation (LLM sends bad params)
- Missing tool_call_id in response messages

**Incorrect — unbounded tool execution loop:**
```python
async def run_tools(user_message: str):
    messages = [{"role": "user", "content": user_message}]
    while True:  # Infinite loop risk
        response = await llm.chat(messages=messages, tools=tools)
        if not response.tool_calls:
            return response.content
        # Execute tools and continue...
```

**Correct — iteration guard prevents infinite loops:**
```python
async def run_tools(user_message: str, max_iterations: int = 10):
    messages = [{"role": "user", "content": user_message}]
    for _ in range(max_iterations):
        response = await llm.chat(messages=messages, tools=tools)
        if not response.tool_calls:
            return response.content
        # Execute tools and continue...
    raise RuntimeError("Max iterations reached")
```
