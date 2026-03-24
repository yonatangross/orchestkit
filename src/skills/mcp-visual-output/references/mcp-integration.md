# @json-render/mcp API Reference

Full API for integrating json-render visual output with MCP servers.

## Server-Side API

### `createMcpApp(config)`

Creates a new MCP server with json-render visual output built in.

```typescript
import { createMcpApp } from '@json-render/mcp'

const app = createMcpApp({
  catalog: CatalogDefinition,    // required: component schemas (defineCatalog output)
  html: string,                  // required: bundled iframe app as HTML string
  name?: string,                 // MCP server name (default: 'json-render-app')
  version?: string,              // MCP server version (default: '1.0.0')
  csp?: CspConfig,               // CSP domain declarations
  toolName?: string,             // name of the render tool (default: 'json-render')
  toolDescription?: string,      // description shown to the AI
})
```

**Returns:** `McpApp` instance with `.start()`, `.server` (underlying McpServer), and `.close()`.

### `registerJsonRenderTool(server, config)`

Adds a json-render tool to an existing MCP server.

```typescript
import { registerJsonRenderTool } from '@json-render/mcp'

registerJsonRenderTool(server, {
  catalog: CatalogDefinition,    // required
  html: string,                  // required
  csp?: CspConfig,               // CSP domain declarations
  toolName?: string,             // default: 'json-render'
  toolDescription?: string,      // default: auto-generated from catalog
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

### `defineCatalog(components)`

Defines a type-safe component catalog using Zod schemas.

```typescript
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

const catalog = defineCatalog({
  ComponentName: {
    props: z.object({ ... }),       // Zod schema for component props
    children: boolean | z.ZodType,  // false = no children, true = any, or typed
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

const app = createMcpApp({ catalog, html: bundledHtml })

// For remote deployment, use Streamable HTTP transport
app.start({
  transport: 'http',
  port: 3001,
  path: '/mcp',
})
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
