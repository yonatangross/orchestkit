---
title: Use progressive rendering for MCP visual output instead of waiting for full specs
impact: "MEDIUM"
impactDescription: "Waiting for the full spec before rendering causes a blank iframe until the AI finishes generating -- users see nothing for 5-15 seconds on complex dashboards"
tags: [streaming, progressive-rendering, json-patch, mcp, visual-output]
---

## Streaming Output

The AI generates json-render specs token by token. Progressive rendering shows components as they complete instead of waiting for the entire spec. The `@json-render/mcp` library handles this via JSON Patch -- partial updates applied to the spec as the AI streams.

**Incorrect -- waiting for full spec before rendering:**
```typescript
// Client-side iframe app
import { useJsonRenderApp } from '@json-render/mcp/app'
import { Renderer } from '@json-render/react'

function App() {
  const { spec, loading } = useJsonRenderApp()

  // BAD: shows nothing until the entire spec is complete
  if (loading || !spec?.elements) return <div>Loading...</div>

  // Only renders after AI is completely done generating
  return <Renderer spec={spec} registry={registry} />
}
```

**Correct -- progressive rendering as elements complete:**
```typescript
import { useJsonRenderApp } from '@json-render/mcp/app'
import { Renderer } from '@json-render/react'
import { registry } from './registry'

function App() {
  const { spec, loading, streaming } = useJsonRenderApp({
    progressive: true,  // enable incremental spec updates
  })

  // Render whatever is available, even partial specs
  return (
    <div>
      {streaming && <StreamingIndicator />}
      {spec && <Renderer spec={spec} registry={registry} />}
      {!spec && loading && <Skeleton />}
    </div>
  )
}
```

**Correct -- server-side: flat specs stream better than deep trees:**
```typescript
// BAD: deeply nested tree -- inner components blocked until parents complete
const deepSpec = {
  root: 'page',
  elements: {
    page: {
      type: 'Layout', children: ['section1'],
    },
    section1: {
      type: 'Section', children: ['subsection'],
    },
    subsection: {
      type: 'Card', children: ['content'],
    },
    content: {
      type: 'StatGrid',  // not renderable until 3 ancestors finish
      props: { items: [...] },
    },
  },
}

// GOOD: flat layout -- each component renderable as soon as it appears
const flatSpec = {
  root: 'dashboard',
  elements: {
    dashboard: {
      type: 'Stack', children: ['stats', 'table', 'status'],
    },
    stats: {
      type: 'StatGrid',   // renders immediately when streamed
      props: { items: [...] },
    },
    table: {
      type: 'DataTable',  // renders as soon as stats is done
      props: { columns: [...], rows: [...] },
    },
    status: {
      type: 'StatusBadge', // renders independently
      props: { label: 'Pipeline', status: 'success' },
    },
  },
}
```

**Key rules:**
- Always set `progressive: true` in `useJsonRenderApp()` to enable incremental rendering
- Design specs with flat element trees (2-3 levels max) so components can render as they arrive
- Show a streaming indicator while the AI is still generating, but render available components immediately
- The json-render spec uses a flat element map (not nested JSX), which naturally supports progressive updates -- each element is independently addressable
- Keep individual element props small -- large arrays (100+ row tables) delay that element's first render
- For large datasets, paginate at the spec level (show first 20 rows, add a "load more" action)

Reference: [JSON Patch RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902)
