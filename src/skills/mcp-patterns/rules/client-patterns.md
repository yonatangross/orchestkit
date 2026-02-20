---
title: Implement MCP client patterns for reliable connections and multi-server orchestration
impact: "MEDIUM"
impactDescription: "Without proper client patterns, connections leak, tool calls fail silently, and multi-server orchestration becomes brittle"
tags: [client, session, transport, tool-discovery, reconnection, multi-server]
---

## Client Patterns

Set up MCP clients with proper session management, error handling, and reconnection. Covers TypeScript and Python SDKs for consuming MCP servers from applications.

**Incorrect -- no error handling, no cleanup:**
```typescript
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const client = new Client({ name: "app", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://localhost:3000/mcp"));
await client.connect(transport);
const result = await client.callTool({ name: "search", arguments: { q: "test" } });
console.log(result.content[0].text); // Crashes if tool errors or content empty
// Transport never closed -- connection leaked
```

```python
from mcp.client.streamable_http import streamable_http_client
from mcp import ClientSession

# No context manager -- session never cleaned up
read, write = await streamable_http_client("http://localhost:3000/mcp").__aenter__()
session = ClientSession(read, write)
await session.initialize()
result = await session.call_tool("search", arguments={"q": "test"})
print(result.content[0].text)  # No type check, no error handling
```

**Correct -- TypeScript client with reconnection and capability negotiation:**
```typescript
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp"),
  {
    sessionId: cachedSessionId,  // Reconnect to existing session
    reconnectionOptions: {
      maxRetries: 5,
      initialReconnectionDelay: 1000,
      maxReconnectionDelay: 30000,
      reconnectionDelayGrowFactor: 1.5,
    },
  }
);

const client = new Client(
  { name: "my-app", version: "1.0.0" },
  { capabilities: { sampling: {} } }  // Declare client capabilities
);

try {
  await client.connect(transport);
  const caps = client.getServerCapabilities();

  // Discover tools before calling
  const { tools } = await client.listTools();
  const hasTool = tools.some((t) => t.name === "search");
  if (!hasTool) throw new Error("Required tool 'search' not available");

  const result = await client.callTool({ name: "search", arguments: { q: "test" } });
  for (const content of result.content) {
    if (content.type === "text") console.log(content.text);
  }
} finally {
  await transport.terminateSession();
  await transport.close();
}
```

**Correct -- Python client with context managers:**
```python
import asyncio
from mcp import ClientSession, StdioServerParameters, types
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import streamable_http_client

async def run_stdio_client():
    server_params = StdioServerParameters(
        command="python", args=["my_server.py"]
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            result = await session.call_tool("add", arguments={"a": 5, "b": 3})
            for content in result.content:
                if isinstance(content, types.TextContent):
                    print(content.text)

async def run_http_client():
    async with streamable_http_client("http://localhost:8000/mcp") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print([t.name for t in tools.tools])
```

**Correct -- multi-server orchestration (TypeScript):**
```typescript
async function connectServers(urls: string[]) {
  const clients = await Promise.all(
    urls.map(async (url) => {
      const transport = new StreamableHTTPClientTransport(new URL(url));
      const client = new Client({ name: "orchestrator", version: "1.0.0" });
      await client.connect(transport);
      const { tools } = await client.listTools();
      return { client, transport, tools, url };
    })
  );

  // Build unified tool registry across servers
  const toolMap = new Map<string, typeof clients[0]>();
  for (const entry of clients) {
    for (const tool of entry.tools) {
      toolMap.set(`${tool.name}@${entry.url}`, entry);
    }
  }
  return { clients, toolMap };
}
```

**Key rules:**
- Always close transports in `finally` blocks (TS) or use context managers (Python)
- Call `initialize()` before any other session method in Python
- Discover tools with `listTools()` before calling -- never assume tool availability
- Use `reconnectionOptions` with exponential backoff for remote HTTP servers
- Cache `sessionId` to resume sessions after reconnection
- Check `content.type` before accessing `.text` -- tools may return images or errors
- For multi-server setups, namespace tools by server to avoid name collisions
- Declare client capabilities (`sampling`, `elicitation`) during construction

Reference: https://modelcontextprotocol.io/specification/2025-11-25/architecture
