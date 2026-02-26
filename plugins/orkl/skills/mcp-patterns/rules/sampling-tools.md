---
title: Bound MCP sampling loops with user approval to prevent unbounded LLM call chains
impact: MEDIUM
impactDescription: "Without bounded loops and user approval, sampling-based agents run unbounded LLM calls, skip human review, and leak sensitive tool results"
tags: sampling, tools, agent-loop, security, human-in-the-loop
---

## Sampling with Tool Calling

MCP sampling lets servers request LLM completions from clients, with optional tool definitions for agentic multi-turn loops. The client controls model access and user approval throughout.

**Incorrect -- no iteration cap, skips user approval:**
```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("agent-server")

@mcp.tool()
async def run_agent(task: str, ctx) -> str:
    messages = [{"role": "user", "content": {"type": "text", "text": task}}]
    tools = [{"name": "search", "description": "Search docs",
              "inputSchema": {"type": "object", "properties": {"q": {"type": "string"}}, "required": ["q"]}}]

    # Unbounded loop -- runs forever if LLM keeps calling tools
    while True:
        result = await ctx.session.create_message(
            messages=messages, tools=tools, max_tokens=2000
        )
        if result.stop_reason != "toolUse":
            return result.content.text
        # Blindly append and continue without any limit
        messages.append({"role": "assistant", "content": result.content})
        tool_results = [execute_tool(tc) for tc in result.content]
        messages.append({"role": "user", "content": tool_results})
```

**Correct -- bounded loop, tool choice control, proper message structure:**
```python
from mcp.server.fastmcp import FastMCP, Context

mcp = FastMCP("agent-server")

MAX_ITERATIONS = 5

TOOLS = [{
    "name": "search",
    "description": "Search documentation by keyword",
    "inputSchema": {
        "type": "object",
        "properties": {"q": {"type": "string", "description": "Search query"}},
        "required": ["q"],
    },
}]

@mcp.tool()
async def run_agent(task: str, ctx: Context) -> str:
    """Run a bounded agent loop with tool access via sampling."""
    messages = [{"role": "user", "content": {"type": "text", "text": task}}]

    for i in range(MAX_ITERATIONS):
        # Force text-only response on final iteration
        tool_choice = (
            {"mode": "none"} if i == MAX_ITERATIONS - 1
            else {"mode": "auto"}
        )
        result = await ctx.session.create_message(
            messages=messages,
            tools=TOOLS,
            tool_choice=tool_choice,
            max_tokens=2000,
        )

        # LLM chose not to use tools -- return final answer
        if result.stop_reason != "toolUse":
            return result.content.text if hasattr(result.content, "text") else str(result.content)

        # Execute each tool call, build tool_result messages
        assistant_content = result.content if isinstance(result.content, list) else [result.content]
        messages.append({"role": "assistant", "content": assistant_content})

        # Tool results MUST be in their own user message -- no mixed content
        tool_results = []
        for block in assistant_content:
            if block.type == "tool_use":
                output = await execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "toolUseId": block.id,
                    "content": [{"type": "text", "text": str(output)}],
                })
        messages.append({"role": "user", "content": tool_results})

    return "Agent reached iteration limit without a final answer."
```

**Declaring sampling capability with tool support (client-side):**
```python
# Client must advertise sampling.tools capability during initialization
capabilities = {
    "sampling": {
        "tools": {}  # Required for tool-enabled sampling requests
    }
}
```

**Key rules:**
- Always cap iteration count and use `toolChoice: {mode: "none"}` on the final turn to force a text response
- Tool result messages MUST contain only `tool_result` blocks -- never mix with text or image content
- Every `tool_use` block (by `id`) must have a matching `tool_result` (by `toolUseId`) before the next assistant turn
- Clients MUST declare `sampling.tools` capability; servers MUST NOT send tool-enabled requests without it
- Human-in-the-loop: clients SHOULD present sampling requests and tool calls for user review before execution
- Use `toolChoice` modes: `auto` (LLM decides), `required` (must call a tool), `none` (text only)
- Parallel tool calls are supported -- handle arrays of `tool_use` blocks in a single assistant message
- Implement rate limiting on the client side to prevent runaway sampling loops
