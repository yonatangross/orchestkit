---
title: Server Transport
impact: HIGH
impactDescription: "Wrong transport choice leads to connection failures in production or inability to serve multiple clients"
tags: transport, stdio, sse, streamable-http, claude-desktop, configuration
---

## Server Transport

Choose stdio for CLI/Desktop, SSE for browsers, Streamable HTTP for production multi-client.

**Transport decision matrix:**

| Transport | Use Case | Pros | Cons |
|-----------|----------|------|------|
| stdio | CLI, Claude Desktop | Simple, no network | Single client only |
| SSE | Web apps, browsers | Browser-compatible | HTTP overhead |
| Streamable HTTP | Production APIs | Multi-client, scalable | More setup |

**Incorrect -- hardcoded transport, no configuration:**
```python
# Forces stdio -- can't switch to web deployment
from mcp.server.stdio import stdio_server

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())
```

**Correct -- Python stdio server:**
```python
from mcp.server import Server
from mcp.server.stdio import stdio_server

server = Server("my-tools")

# Register handlers...

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

**Correct -- TypeScript stdio server:**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "my-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Register handlers...

await server.connect(new StdioServerTransport());
```

**Correct -- SSE for web deployment:**
```python
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Route

sse = SseServerTransport("/messages")

async def handle_sse(request):
    async with sse.connect_sse(
        request.scope, request.receive, request._send
    ) as streams:
        await server.run(
            streams[0], streams[1],
            server.create_initialization_options()
        )

app = Starlette(routes=[
    Route("/sse", endpoint=handle_sse),
    Route("/messages", endpoint=sse.handle_post_message, methods=["POST"]),
])
```

**Claude Desktop configuration:**
```json
{
  "mcpServers": {
    "my-tools": {
      "command": "npx",
      "args": ["-y", "@myorg/my-tools"],
      "env": { "DATABASE_URL": "postgres://..." }
    },
    "python-tools": {
      "command": "uv",
      "args": ["run", "python", "-m", "my_mcp_server"],
      "cwd": "/path/to/project"
    }
  }
}
```

**Key rules:**
- Use `uv` (not `pip`) for Python MCP server commands in Claude Desktop config
- Set `cwd` when the server needs access to project files
- Pass secrets via `env`, never hardcode in args
- TypeScript servers: use `npx -y` for zero-install execution
