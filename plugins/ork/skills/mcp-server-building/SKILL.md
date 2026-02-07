---
name: mcp-server-building
description: Building MCP (Model Context Protocol) servers for Claude extensibility. Use when creating MCP servers, building custom Claude tools, extending Claude with external integrations, or developing tool packages for Claude Desktop.
tags: [mcp, server, tools, integration]
context: fork
agent: backend-system-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
complexity: high
---
# MCP Server Building

Build custom MCP servers to extend Claude with tools, resources, and prompts.

## Architecture

```
+-------------+     JSON-RPC      +-------------+
|   Claude    |<----------------->| MCP Server  |
|   (Host)    |   stdio/SSE/WS    |  (Tools)    |
+-------------+                   +-------------+
```

**Three Primitives:**
- **Tools**: Functions Claude can call (with user approval)
- **Resources**: Data Claude can read (files, API responses)
- **Prompts**: Pre-defined prompt templates

## Quick Start

### Minimal Python Server (stdio)

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

server = Server("my-tools")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="greet",
            description="Greet a user by name",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name to greet"}
                },
                "required": ["name"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "greet":
        return [TextContent(type="text", text=f"Hello, {arguments['name']}!")]
    raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### TypeScript Server (production)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "fetch_url",
    description: "Fetch content from a URL",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "fetch_url") {
    const { url } = request.params.arguments as { url: string };
    const response = await fetch(url);
    return { content: [{ type: "text", text: await response.text() }] };
  }
  throw new Error("Unknown tool");
});

await server.connect(new StdioServerTransport());
```

## Detailed Guides

- **Transport patterns**: See [references/transport-patterns.md](references/transport-patterns.md) for stdio, SSE, WebSocket
- **Tool definitions**: See [references/tool-definitions.md](references/tool-definitions.md) for schemas, error handling, caching
- **Resource patterns**: See [references/resource-patterns.md](references/resource-patterns.md) for files and dynamic data
- **Testing**: See [references/testing-patterns.md](references/testing-patterns.md) for MCP Inspector and pytest
- **Auto-discovery**: See [references/auto-discovery.md](references/auto-discovery.md) for CC 2.1.7+ optimization

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport | stdio for CLI, SSE for web | stdio simplest, SSE for browsers |
| Language | TypeScript for production | Better SDK support, type safety |
| Error handling | Return errors as text | Claude can interpret and retry |

## Anti-Patterns

1. **Stateful tools without cleanup** - Always clean up connections
2. **Blocking synchronous code** - Use `asyncio.to_thread()`
3. **Missing input validation** - Validate before processing
4. **Secrets in tool output** - Never return credentials
5. **Unbounded responses** - Limit response sizes

## Related Skills

- `function-calling` - LLM function calling patterns
- `agent-loops` - Agentic patterns using MCP tools
- `input-validation` - Input validation for arguments

## Resources

- MCP Specification: https://modelcontextprotocol.io/docs
- Python SDK: https://github.com/modelcontextprotocol/python-sdk
- TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
