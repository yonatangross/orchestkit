# MCP Transport Patterns

## stdio Transport (CLI)

Standard I/O is the simplest transport for CLI tools and Claude Desktop.

### Python stdio Server
```python
from mcp.server import Server
from mcp.server.stdio import stdio_server

server = Server("my-tools")

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### TypeScript stdio Server
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "my-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## SSE Transport (Web)

Server-Sent Events for browser and web deployments.

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

## Claude Desktop Configuration

```json
// macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
// Windows: %APPDATA%\Claude\claude_desktop_config.json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@myorg/db-tools"],
      "env": {
        "DATABASE_URL": "postgres://..."
      }
    },
    "python-tools": {
      "command": "uv",
      "args": ["run", "python", "-m", "my_mcp_server"],
      "cwd": "/path/to/project"
    }
  }
}
```

## Transport Decision Matrix

| Transport | Use Case | Pros | Cons |
|-----------|----------|------|------|
| stdio | CLI, Claude Desktop | Simple, no network | Single client |
| SSE | Web apps | Browser-compatible | HTTP overhead |
| WebSocket | Real-time | Bidirectional | More complex |
