---
title: Use the Renderer component with catalog validation for web rendering
impact: MEDIUM
impactDescription: "Manual spec parsing bypasses catalog validation and loses progressive streaming, error boundaries, and type safety"
tags: [react, renderer, streaming, error-boundary, web]
---

## React Renderer

The `<Renderer>` component from `@json-render/react` validates specs against the catalog at runtime and renders each element using the registry. Never parse specs manually.

**Incorrect — parsing the spec manually:**
```tsx
// WRONG: Manual parsing, no validation, no streaming
function Dashboard({ spec }) {
  return (
    <div>
      {Object.entries(spec.elements).map(([id, el]) => {
        const Component = components[el.type] // no catalog validation
        return <Component key={id} {...el.props} />
      })}
    </div>
  )
}
```

**Correct — using the Renderer component:**
```tsx
import { Renderer } from '@json-render/react'
import { catalog } from './catalog'
import { webRegistry } from './registries/web'

function Dashboard({ spec }) {
  return (
    <Renderer
      spec={spec}
      catalog={catalog}
      registry={webRegistry}
      fallback={<LoadingSkeleton />}
      onError={(err) => console.error('Render error:', err)}
    />
  )
}
```

**Key rules:**
- Always pass `catalog` to `<Renderer>` — it validates that spec types exist in the catalog and props match Zod schemas
- Use `fallback` prop for loading states during progressive streaming
- Use `onError` callback or wrap in an error boundary for graceful degradation
- For streaming specs (AI generating in real-time), the Renderer updates progressively as elements arrive
- The registry maps catalog types to React components — keep it separate from the catalog definition

### Progressive Streaming Pattern

```tsx
import { Renderer, useStreamingSpec } from '@json-render/react'

function StreamingDashboard({ specStream }) {
  const spec = useStreamingSpec(specStream) // updates as patches arrive

  return (
    <Renderer
      spec={spec}
      catalog={catalog}
      registry={webRegistry}
      fallback={<Skeleton />}
    />
  )
}
```

Elements render as soon as their props are complete — the user sees the UI building in real-time.
