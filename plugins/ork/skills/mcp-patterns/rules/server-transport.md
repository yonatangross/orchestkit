---
title: Server Transport
impact: HIGH
impactDescription: "Wrong transport choice leads to connection failures in production or inability to serve multiple clients"
tags: transport, stdio, sse, streamable-http, claude-desktop, configuration
---

## Server Transport

Choose stdio for CLI/Desktop, Streamable HTTP for web apps and production multi-client. SSE is deprecated.

**Transport decision matrix:**

| Transport | Use Case | Pros | Cons |
|-----------|----------|------|------|
| stdio | CLI, Claude Desktop | Simple, no network | Single client only |
| SSE | **Deprecated** | Browser-compatible | Deprecated since March 2025 |
| Streamable HTTP | Web apps, production APIs | Multi-client, scalable, stateless option | More setup |

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

**Deprecated -- SSE for web deployment (use Streamable HTTP instead):**

> SSE transport was deprecated in March 2025. Migrate to Streamable HTTP for
> new projects. SSE remains functional but receives no new features.

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

**Correct -- Streamable HTTP server (Python, recommended):**
```python
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("my-tools")

@mcp.tool()
def greet(name: str = "World") -> str:
    """Greet someone by name."""
    return f"Hello, {name}!"

if __name__ == "__main__":
    # Stateless with JSON responses -- best for production
    mcp.run(transport="streamable-http", stateless_http=True, json_response=True)
    # Stateful with session persistence (when needed):
    # mcp.run(transport="streamable-http")
```

**Correct -- Streamable HTTP server (TypeScript, recommended):**
```typescript
import { createServer } from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";

const server = new McpServer({ name: "my-tools", version: "1.0.0" });

// Register handlers...

createServer(async (req, res) => {
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless; use () => randomUUID() for sessions
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}).listen(3000);
```

**Migrating SSE → Streamable HTTP:**
- Python: Replace `SseServerTransport` with `MCPServer.run(transport="streamable-http")`
- TypeScript: Replace `SSEServerTransport` with `NodeStreamableHTTPServerTransport`
- Client endpoint changes from `/sse` + `/messages` to single `/mcp` path
- Streamable HTTP supports both stateless (scalable) and stateful (session) modes

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
- Use Streamable HTTP for all new web/production deployments (SSE is deprecated)
- Use `uv` (not `pip`) for Python MCP server commands in Claude Desktop config
- Set `cwd` when the server needs access to project files
- Pass secrets via `env`, never hardcode in args
- TypeScript servers: use `npx -y` for zero-install execution
- Prefer stateless mode (`stateless_http=True`) unless session persistence is required
