"""
Function calling template for OpenAI and Anthropic APIs.

Usage:
    from templates.function_def import ToolRegistry, run_tool_loop

    registry = ToolRegistry()
    registry.register(search_documents)
    result = await run_tool_loop(registry, "Find Python tutorials")
"""

import json
import asyncio
from typing import Callable, Any
from functools import wraps
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

# --- Tool Registry ---

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

    def _extract_schema(self, func: Callable) -> dict:
        """Extract OpenAI tool schema from function."""
        hints = func.__annotations__
        properties = {}

        for name, hint in hints.items():
            if name == "return":
                continue
            properties[name] = {"type": self._python_to_json_type(hint)}

        return {
            "type": "function",
            "function": {
                "name": func.__name__,
                "description": func.__doc__ or "",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": list(properties.keys()),
                    "additionalProperties": False
                }
            }
        }

    def _python_to_json_type(self, hint) -> str:
        type_map = {str: "string", int: "integer", float: "number", bool: "boolean"}
        return type_map.get(hint, "string")

    async def execute(self, name: str, args: dict) -> Any:
        """Execute a registered tool."""
        if name not in self.tools:
            raise ValueError(f"Unknown tool: {name}")
        func = self.tools[name]
        if asyncio.iscoroutinefunction(func):
            return await func(**args)
        return func(**args)


# --- Tool Execution Loop ---

async def run_tool_loop(
    registry: ToolRegistry,
    user_message: str,
    model: str = "gpt-4o",
    max_iterations: int = 10
) -> str:
    """Run tool execution loop until completion."""
    client = AsyncOpenAI()
    messages = [{"role": "user", "content": user_message}]

    for _ in range(max_iterations):
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=registry.schemas,
            parallel_tool_calls=False  # Required for strict mode
        )

        message = response.choices[0].message

        if not message.tool_calls:
            return message.content

        messages.append(message.model_dump())

        for tool_call in message.tool_calls:
            result = await registry.execute(
                tool_call.function.name,
                json.loads(tool_call.function.arguments)
            )
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result)
            })

    raise RuntimeError("Max iterations reached")


# --- Example Usage ---

if __name__ == "__main__":
    registry = ToolRegistry()

    @registry.register
    def search_documents(query: str, limit: int) -> list:
        """Search knowledge base for documents."""
        return [{"title": f"Result for {query}", "score": 0.95}]

    @registry.register
    def get_weather(location: str) -> dict:
        """Get weather for a location."""
        return {"location": location, "temp": 22, "unit": "celsius"}

    async def main():
        result = await run_tool_loop(registry, "What's the weather in Paris?")
        print(result)

    asyncio.run(main())