---
title: "Catalog Definition with defineCatalog and Zod"
impact: "HIGH"
impactDescription: "Without Zod-typed catalogs, AI can generate arbitrary component types and props that crash at runtime or produce broken UI"
tags: [json-render, zod, catalog, defineCatalog, type-safety]
---

## Catalog Definition with defineCatalog and Zod

Every json-render project starts with a catalog — a Zod-typed registry of components the AI is allowed to generate. The catalog is the contract: if a type is not in the catalog, it cannot appear in specs.

**Incorrect:**
```typescript
// No type safety — AI can generate anything, props are unchecked
const components = {
  Card: ({ title, children }) => <div>{title}{children}</div>,
  Button: ({ label }) => <button>{label}</button>,
}

// Rendering without a catalog — no validation
function App({ spec }) {
  return <DynamicRenderer components={components} spec={spec} />
}
```

**Correct:**
```typescript
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

export const catalog = defineCatalog({
  Card: {
    // props: Zod schema validates every prop AI generates
    props: z.object({
      title: z.string().max(100),
      description: z.string().max(500).optional(),
      elevated: z.boolean().default(false),
    }),
    // children: true = accepts child elements, false = leaf node
    children: true,
  },
  Button: {
    props: z.object({
      label: z.string().max(50),
      variant: z.enum(['default', 'destructive', 'outline', 'ghost']),
      size: z.enum(['sm', 'md', 'lg']).default('md'),
      disabled: z.boolean().default(false),
    }),
    children: false,
  },
  DataTable: {
    props: z.object({
      columns: z.array(z.object({
        key: z.string(),
        label: z.string(),
        sortable: z.boolean().default(false),
      })).min(1).max(12),
      rows: z.array(z.record(z.string())).max(100),
    }),
    children: false,
  },
})

// Type-safe rendering with catalog validation
import { Render } from '@json-render/react'
<Render catalog={catalog} components={components} spec={spec} />
```

### Children Types

| Value | Meaning | Use For |
|-------|---------|---------|
| `true` | Accepts any catalog children | Layout components (Card, Section, Grid) |
| `false` | Leaf node, no children | Data display (StatGrid, Chart, Badge) |
| `['Button', 'Badge']` | Only accepts specific types as children | Constrained containers (Toolbar accepts only Button) |

```typescript
Toolbar: {
  props: z.object({ orientation: z.enum(['horizontal', 'vertical']) }),
  children: ['Button', 'Badge'],  // Only Button and Badge allowed as children
},
```

### Merging Catalogs

Use `mergeCatalogs()` to combine the shadcn base with custom domain components:

```typescript
import { mergeCatalogs } from '@json-render/core'
import { shadcnCatalog } from '@json-render/shadcn'

const appCatalog = mergeCatalogs(shadcnCatalog, {
  PricingCard: {
    props: z.object({
      plan: z.enum(['free', 'pro', 'enterprise']),
      price: z.string(),
      features: z.array(z.string()).max(10),
    }),
    children: false,
  },
})
```

**Key rules:**
- Every component in the catalog must have a `props` Zod schema and a `children` declaration
- Use `.max()`, `.min()`, and `.default()` on all schemas to bound what AI can generate
- Use typed children arrays (`['Button']`) for containers that should only accept specific child types
- Use `mergeCatalogs()` to combine catalogs — manual spreading loses runtime validation
- Export the catalog type for use in component implementations: `type AppCatalog = typeof catalog`

Reference: https://github.com/nicholasgriffintn/json-render
