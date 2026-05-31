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
import { Renderer, defineRegistry } from '@json-render/react'
import { catalog } from './catalog'
import { webComponents } from './registries/web'

const { registry: webRegistry } = defineRegistry(catalog, { components: webComponents })

function Dashboard({ spec }) {
  return (
    <Renderer
      spec={spec}
      registry={webRegistry}
      fallback={<LoadingSkeleton />}
    />
  )
}
```

**Key rules:**
- Build the registry with `defineRegistry(catalog, { components })` — this binds catalog validation to the registry; `<Renderer>` receives only `spec` and `registry` (no `catalog` prop in 0.19)
- `RendererProps` is `{ spec, registry, loading?, fallback? }` — no `catalog`, `components`, `directives`, or `onError` at top level
- Use `fallback` prop for loading states during progressive streaming
- Wrap in a React error boundary for graceful degradation
- For streaming specs (AI generating in real-time), the Renderer updates progressively as elements arrive
- The registry maps catalog types to React components — keep it separate from the catalog definition

### Progressive Streaming Pattern

```tsx
import { Renderer, defineRegistry, useStreamingSpec } from '@json-render/react'
import { catalog } from './catalog'
import { webComponents } from './registries/web'

const { registry: webRegistry } = defineRegistry(catalog, { components: webComponents })

function StreamingDashboard({ specStream }) {
  const spec = useStreamingSpec(specStream) // updates as patches arrive

  return (
    <Renderer
      spec={spec}
      registry={webRegistry}
      fallback={<Skeleton />}
    />
  )
}
```

Elements render as soon as their props are complete — the user sees the UI building in real-time.
