---
title: Use createMcpApp() or registerJsonRenderTool() for type-safe visual output
impact: "HIGH"
impactDescription: "Without proper setup, MCP tools return raw strings instead of interactive specs -- no type safety, no streaming, no catalog validation"
tags: [mcp, json-render, createMcpApp, registerJsonRenderTool, setup]
---

## MCP App Setup

Two entry points: `createMcpApp()` wraps a new MCP server with visual output built in. `registerJsonRenderTool()` adds visual output to an existing server. Both require a catalog (component schemas) and an html bundle (the iframe app).

**Incorrect -- returning raw HTML from an MCP tool:**
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const server = new McpServer({ name: 'dashboard', version: '1.0.0' })

// BAD: raw HTML string -- no type safety, no catalog validation,
// no streaming, client may not render HTML at all
server.tool('show-dashboard', {}, async () => ({
  content: [{
    type: 'text',
    text: '<div class="grid"><div class="stat">94 skills</div></div>',
  }],
}))
```

**Correct -- createMcpApp() for a new server:**
```typescript
import { createMcpApp } from '@json-render/mcp'
import { dashboardCatalog } from './catalog'
import bundledHtml from './app.html'

// Creates McpServer + registers the json-render tool automatically
const app = createMcpApp({
  catalog: dashboardCatalog,  // Zod-typed component schemas
  html: bundledHtml,          // pre-built iframe app as a single HTML string
  name: 'dashboard-server',   // optional: MCP server name
  version: '1.0.0',           // optional: MCP server version
})

// Supports any MCP transport
app.start()  // stdio by default
```

**Correct -- registerJsonRenderTool() for an existing server:**
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerJsonRenderTool } from '@json-render/mcp'
import { dashboardCatalog } from './catalog'
import bundledHtml from './app.html'

const server = new McpServer({ name: 'my-server', version: '1.0.0' })

// Your existing tools remain unchanged
server.tool('search', { query: z.string() }, async ({ query }) => ({
  content: [{ type: 'text', text: results }],
}))

// Add visual output alongside existing tools
registerJsonRenderTool(server, {
  catalog: dashboardCatalog,
  html: bundledHtml,
  toolName: 'render',       // optional: defaults to 'json-render'
  toolDescription: 'Render interactive dashboard',  // optional
})
```

**Key rules:**
- Always provide both `catalog` and `html` -- the catalog defines what the AI can generate, the html renders it
- The html bundle must be a self-contained single-file app (all JS/CSS inlined) because it loads inside a sandboxed iframe with no external script access by default
- Use `createMcpApp()` when building a server whose primary purpose is visual output
- Use `registerJsonRenderTool()` when adding visual output to a server that already has text-based tools
- The registered tool accepts a json-render spec as input and returns the rendered iframe as a UI resource
- Never return raw HTML strings from MCP tools -- use the catalog/spec pattern for type safety and streaming support

Reference: [@json-render/mcp README](https://github.com/nichochar/json-render)
