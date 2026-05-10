<!-- SYNCED from vercel-labs/json-render (skills/mcp/SKILL.md) -->
<!-- Hash: fdc45b80ea851e518ba1ce37cbc6bdfff8627512caca55265f1f85b8639c662d -->
<!-- Re-sync: bash scripts/sync-vercel-skills.sh -->


# @json-render/mcp

MCP Apps integration that serves json-render UIs as interactive MCP Apps inside Claude, ChatGPT, Cursor, VS Code, and other MCP-capable clients.

## Quick Start

### Server (Node.js)

```typescript
import { createMcpApp } from "@json-render/mcp";
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";

const catalog = defineCatalog(schema, {
  components: { ...shadcnComponentDefinitions },
  actions: {},
});

const server = createMcpApp({
  name: "My App",
  version: "1.0.0",
  catalog,
  html: fs.readFileSync("dist/index.html", "utf-8"),
});

await server.connect(new StdioServerTransport());
```

### Client (React, inside iframe)

```tsx
import { useJsonRenderApp } from "@json-render/mcp/app";
import { JSONUIProvider, Renderer } from "@json-render/react";

function McpAppView({ registry }) {
  const { spec, loading, error } = useJsonRenderApp();
  if (error) return <div>Error: {error.message}</div>;
  if (!spec) return <div>Waiting...</div>;
  return (
    <JSONUIProvider registry={registry} initialState={spec.state ?? {}}>
      <Renderer spec={spec} registry={registry} loading={loading} />
    </JSONUIProvider>
  );
}
```

## Architecture

1. `createMcpApp()` creates an `McpServer` that registers a `render-ui` tool and a `ui://` HTML resource
2. The tool description includes the catalog prompt so the LLM knows how to generate valid specs
3. The HTML resource is a Vite-bundled single-file React app with json-render renderers
4. Inside the iframe, `useJsonRenderApp()` connects to the host via `postMessage` and renders specs

## Server API

- `createMcpApp(options)` - main entry, creates a full MCP server
- `registerJsonRenderTool(server, options)` - register a json-render tool on an existing server
- `registerJsonRenderResource(server, options)` - register the UI resource

## Client API (`@json-render/mcp/app`)

- `useJsonRenderApp(options?)` - React hook, returns `{ spec, loading, connected, error, callServerTool }`
- `buildAppHtml(options)` - generate HTML from bundled JS/CSS

## Building the iframe HTML

Bundle the React app into a single self-contained HTML file using Vite + `vite-plugin-singlefile`:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: "dist" },
});
```

## Client Configuration

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "my-app": {
      "command": "npx",
      "args": ["tsx", "server.ts", "--stdio"]
    }
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "my-app": {
      "command": "npx",
      "args": ["tsx", "/path/to/server.ts", "--stdio"]
    }
  }
}
```

## Dependencies

```bash
# Server
npm install @json-render/mcp @json-render/core @modelcontextprotocol/sdk

# Client (iframe)
npm install @json-render/react @json-render/shadcn react react-dom

# Build tools
npm install -D vite @vitejs/plugin-react vite-plugin-singlefile
```

<!-- /SYNCED — OrchestKit-local notes below survive the next sync -->

## Auth status visibility (CC 2.1.132+)

When a json-render-backed MCP server is loaded as a claude.ai connector, CC 2.1.132 distinguishes auth-required from broken in `/mcp`:

```
$ claude  /mcp
  my-app       needs auth                       ← OAuth not completed for this connector
  my-app       connected · tools fetch failed   ← handshake OK, tools/list failed (retried once)
  my-app       failed                           ← genuinely broken
```

Implications when shipping an MCP App:

- Return `401` (not a generic 500) for unauthenticated requests so CC surfaces `needs auth` instead of `failed`. Generic-500 used to render the same way pre-2.1.132 but no longer does.
- Don't lazy-throw inside `tools/list`. CC 2.1.132 retries it once; persistent failure shows as `connected · tools fetch failed`, which is a worse user experience than failing the initial connect cleanly.
- Headless `-p` callers no longer retry non-transient 4xx — an MCP App that issues `401` will fail fast in CI/scripted invocations as intended.

See `configure/references/mcp-config.md` (`## CC 2.1.132 changes`) for the matching CLI-side status semantics.
