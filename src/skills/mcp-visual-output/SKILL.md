---
name: mcp-visual-output
description: "Interactive MCP visual output via @json-render/mcp. Upgrade plain JSON tool responses to interactive dashboards rendered in sandboxed iframes inside Claude, Cursor, and ChatGPT conversations. Covers createMcpApp(), registerJsonRenderTool(), CSP config, streaming, and dashboard component patterns. Use when building MCP servers that return visual output, upgrading existing MCP tools with interactive UI, or creating eval/monitoring dashboards."
tags: [mcp, json-render, visual-output, dashboard, iframe, sandbox, interactive-ui, genui]
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
metadata:
  category: mcp
  upstream-package: "@json-render/mcp"
  upstream-version-tested: "2.0.0"
---

# MCP Visual Output

Upgrade plain MCP tool responses to interactive dashboards rendered inside AI conversations. Built on `@json-render/mcp`, which bridges the json-render spec system with MCP's tool/resource model -- the AI generates a typed JSON spec, and a sandboxed iframe renders it as an interactive UI.

> **Building an MCP server from scratch?** Use `ork:mcp-patterns` for server setup, transport, and security. This skill focuses on the **visual output layer** after your server is running.
>
> **Need the full component catalog?** See `ork:json-render-catalog` for all available components, props, and composition patterns.

## Decision Tree -- Which File to Read

```
What are you doing?
|
+-- Setting up visual output for the first time
|   +-- New MCP server -----------> rules/mcp-app-setup.md
|   +-- Existing MCP server ------> rules/mcp-app-setup.md (registerJsonRenderTool section)
|
+-- Configuring security / sandbox
|   +-- CSP declarations ----------> rules/sandbox-csp.md
|   +-- Iframe permissions --------> rules/sandbox-csp.md
|
+-- Rendering strategy
|   +-- Progressive streaming -----> rules/streaming-output.md
|   +-- Dashboard layouts ----------> rules/dashboard-patterns.md
|
+-- API reference
|   +-- Server-side API -----------> references/mcp-integration.md
|   +-- Component recipes ----------> references/component-recipes.md
```

## Quick Reference

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| **Setup** | `mcp-app-setup.md` | HIGH | createMcpApp() and registerJsonRenderTool() |
| **Security** | `sandbox-csp.md` | HIGH | CSP declarations, iframe sandboxing |
| **Rendering** | `streaming-output.md` | MEDIUM | Progressive rendering via JSON Patch |
| **Patterns** | `dashboard-patterns.md` | MEDIUM | Stat grids, status badges, data tables |

**Total: 4 rules across 3 categories**

## How It Works

1. **Define a catalog** -- typed component schemas using `defineCatalog()` + Zod
2. **Register with MCP** -- `createMcpApp()` for new servers or `registerJsonRenderTool()` for existing ones
3. **AI generates specs** -- the model produces a JSON spec conforming to the catalog
4. **Iframe renders it** -- a bundled React app inside a sandboxed iframe renders the spec with `useJsonRenderApp()` + `<Renderer />`

The AI never writes HTML or CSS. It produces a structured JSON spec that references catalog components by type. The iframe app renders those components using a pre-built registry.

## Quick Start -- New MCP Server

```typescript
import { createMcpApp } from '@json-render/mcp'
import { catalog } from './catalog'
import bundledHtml from './app.html'

// 1. Create the MCP app (wraps McpServer + registers the render tool)
const app = createMcpApp({
  catalog,           // component schemas the AI can use
  html: bundledHtml, // pre-built iframe app (single HTML file)
})

// 2. Start -- works with stdio, Streamable HTTP, or any MCP transport
app.start()
```

## Quick Start -- Enhance Existing Server with Visual Output

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerJsonRenderTool } from '@json-render/mcp'
import { catalog } from './catalog'
import bundledHtml from './app.html'

const server = new McpServer({ name: 'my-server', version: '1.0.0' })

// Add visual output capability alongside existing tools
registerJsonRenderTool(server, {
  catalog,
  html: bundledHtml,
})
```

## Client-Side Iframe App

The iframe app receives specs from the MCP host and renders them:

```typescript
import { useJsonRenderApp } from '@json-render/mcp/app'
import { Renderer } from '@json-render/react'
import { registry } from './registry'

function App() {
  const { spec, loading } = useJsonRenderApp()
  if (loading) return <Skeleton />
  return <Renderer spec={spec} registry={registry} />
}
```

## Catalog Definition

Catalogs define what components the AI can use. Each component has typed props via Zod:

```typescript
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

export const dashboardCatalog = defineCatalog({
  StatGrid: {
    props: z.object({
      items: z.array(z.object({
        label: z.string(),
        value: z.string(),
        trend: z.enum(['up', 'down', 'flat']).optional(),
        color: z.enum(['green', 'red', 'yellow', 'blue']).optional(),
      })),
    }),
    children: false,
  },
  StatusBadge: {
    props: z.object({
      label: z.string(),
      status: z.enum(['success', 'warning', 'error', 'info', 'pending']),
    }),
    children: false,
  },
  DataTable: {
    props: z.object({
      columns: z.array(z.object({ key: z.string(), label: z.string() })),
      rows: z.array(z.record(z.string())),
    }),
    children: false,
  },
})
```

## Example: Eval Results Dashboard

The AI generates a spec like this -- flat element map, no nesting beyond 2 levels:

```json
{
  "root": "dashboard",
  "elements": {
    "dashboard": {
      "type": "Card",
      "props": { "title": "Eval Results -- v7.21.1" },
      "children": ["stats", "table"]
    },
    "stats": {
      "type": "StatGrid",
      "props": {
        "items": [
          { "label": "Skills Evaluated", "value": "94", "trend": "flat" },
          { "label": "Pass Rate", "value": "97.8%", "trend": "up", "color": "green" },
          { "label": "Avg Score", "value": "8.2/10", "trend": "up" }
        ]
      }
    },
    "table": {
      "type": "DataTable",
      "props": {
        "columns": [
          { "key": "skill", "label": "Skill" },
          { "key": "score", "label": "Score" },
          { "key": "status", "label": "Status" }
        ],
        "rows": [
          { "skill": "implement", "score": "9.1", "status": "pass" },
          { "skill": "verify", "score": "8.7", "status": "pass" }
        ]
      }
    }
  }
}
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| New vs existing server | `createMcpApp()` for new; `registerJsonRenderTool()` to add to existing |
| CSP policy | Minimal -- only declare domains you actually need |
| Streaming | Always enable progressive rendering; never wait for full spec |
| Dashboard depth | Keep element trees flat (2-3 levels max) for streamability |
| Component count | 3-5 component types per catalog covers most dashboards |
| Visual vs text | Use visual output for multi-metric views; plain text for single values |

## When to Use Visual Output vs Plain Text

| Scenario | Use Visual Output | Use Plain Text |
|----------|------------------|----------------|
| Multiple metrics at a glance | Yes -- StatGrid | No |
| Tabular data (5+ rows) | Yes -- DataTable | No |
| Status of multiple systems | Yes -- StatusBadge grid | No |
| Single value answer | No | Yes |
| Error message | No | Yes |
| File content / code | No | Yes |

## Common Mistakes

1. Returning raw HTML strings from MCP tools instead of json-render specs (breaks type safety, no streaming)
2. Deeply nested component trees that cannot stream progressively (keep flat)
3. Using `script-src 'unsafe-inline'` in CSP declarations (security risk, unnecessary)
4. Waiting for the full spec before rendering (defeats progressive rendering)
5. Defining 20+ component types in a single catalog (increases prompt token cost)
6. Missing `html` bundle in `createMcpApp()` config (iframe has nothing to render)

## Related Skills

- `ork:mcp-patterns` -- MCP server building, transport, security
- `ork:json-render-catalog` -- Full component catalog and composition patterns
- `ork:multi-surface-render` -- Rendering across Claude, Cursor, ChatGPT, web
- `ork:ai-ui-generation` -- GenUI patterns for AI-generated interfaces
