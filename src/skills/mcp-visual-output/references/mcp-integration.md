# @json-render/mcp API Reference

Full API for integrating json-render visual output with MCP servers.

## Server-Side API

### `createMcpApp(config)`

Creates a new MCP server with json-render visual output built in. Async — returns `McpServer` directly.

```typescript
import { createMcpApp } from '@json-render/mcp'

const server = await createMcpApp({
  name: string,                  // required: MCP server name
  version: string,               // required: MCP server version
  catalog: CatalogDefinition,    // required: component schemas (defineCatalog output)
  html: string,                  // required: bundled iframe app as HTML string
  tool: {
    name: string,                // required: name of the render tool
    description: string,         // required: description shown to the AI
  },
  csp?: CspConfig,               // CSP domain declarations
})
```

**Returns:** `McpServer` — connect a transport directly, no `.start()` method.

### `registerJsonRenderTool(server, config)`

Adds a json-render tool to an existing MCP server.

```typescript
import { registerJsonRenderTool } from '@json-render/mcp'

registerJsonRenderTool(server, {
  catalog: CatalogDefinition,    // required
  name: string,                  // required: tool name
  title: string,                 // required: display title
  description: string,           // required: description shown to the AI
  resourceUri: string,           // required: URI for the UI resource
  html: string,                  // required: bundled iframe app as HTML string
  csp?: CspConfig,               // CSP domain declarations
})
```

**Returns:** `void`. Mutates the server by registering a new tool and UI resource.

### `CspConfig`

```typescript
interface CspConfig {
  connectDomains?: string[]    // fetch/XHR/WebSocket origins
  resourceDomains?: string[]   // script/image/style/font CDN origins
  frameDomains?: string[]      // nested iframe origins
}
```

## Client-Side API (Iframe App)

### `useJsonRenderApp(options?)`

React hook for the iframe app. Receives specs from the MCP host via postMessage.

```typescript
import { useJsonRenderApp } from '@json-render/mcp/app'

const { spec, loading, streaming, error } = useJsonRenderApp({
  progressive?: boolean,    // enable incremental spec updates (default: false)
  onSpec?: (spec) => void,  // callback when spec updates
  onError?: (err) => void,  // callback on parse/validation errors
})
```

**Returns:**
- `spec: JsonRenderSpec | null` -- current spec (null before first data)
- `loading: boolean` -- true before any spec data arrives
- `streaming: boolean` -- true while the AI is still generating
- `error: Error | null` -- set if spec parsing or validation fails

### `Renderer` Component

```tsx
import { Renderer } from '@json-render/react'

<Renderer
  spec={spec}              // the json-render spec
  registry={registry}      // component registry (maps type names to React components)
  fallback?: ReactNode     // rendered for unknown component types
  onAction?: (action) => void  // callback for component actions (clicks, selections)
/>
```

### `defineCatalog(schema, options)`

Defines a type-safe component catalog using Zod schemas.

```typescript
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

const catalog = defineCatalog(schema, {
  components: {
    ComponentName: {
      props: z.object({ ... }),       // Zod schema for component props
      children: boolean | z.ZodType,  // false = no children, true = any, or typed
    },
  },
})
```

## Host Configuration

### Claude Desktop

```json
{
  "mcpServers": {
    "my-dashboard": {
      "command": "node",
      "args": ["./dist/server.js"],
      "env": {}
    }
  }
}
```

### Cursor

```json
{
  "mcp": {
    "servers": {
      "my-dashboard": {
        "command": "node",
        "args": ["./dist/server.js"]
      }
    }
  }
}
```

### Streamable HTTP (Remote)

```typescript
import { createMcpApp } from '@json-render/mcp'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

const server = await createMcpApp({
  name: 'dashboard',
  version: '1.0.0',
  catalog,
  html: bundledHtml,
  tool: { name: 'render', description: 'Render dashboard' },
})

// For remote deployment, connect Streamable HTTP transport directly
const transport = new StreamableHTTPServerTransport({ port: 3001, path: '/mcp' })
await server.connect(transport)
```

## Spec Format

The json-render spec is a flat element map with a root pointer:

```typescript
interface JsonRenderSpec {
  root: string                           // key of the root element
  elements: Record<string, Element>      // flat map of all elements
}

interface Element {
  type: string                           // component type from catalog
  props?: Record<string, unknown>        // component props (validated against catalog)
  children?: string[]                    // keys of child elements
}
```
