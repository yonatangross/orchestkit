---
title: json-render Catalog Registration
impact: MEDIUM
impactDescription: "Stage 4 RENDER — register adapted components as json-render catalog entries for multi-surface reuse"
tags: [json-render, catalog, multi-surface, registration, design-to-code]
---

## json-render Catalog Registration

After Stage 3 ADAPT produces a working React component, register it in the project's json-render catalog so the same component can render to PDF, email, video, or MCP output without reimplementation.

### When to Register

- The project has `@json-render/core` as a dependency
- A `defineCatalog()` call exists in the project (typically `src/catalog.ts` or `lib/catalog.ts`)
- The component has stable, typed props suitable for AI-driven rendering

If none of these conditions are met, skip catalog registration and inform the user.

### How to Generate a Zod Schema from Component Props

**Incorrect:**
```typescript
// Skipping catalog registration — component is stuck in one surface
// Only usable as a direct React import, cannot be rendered to PDF/email/video
export function PricingCard({ plan, price, features }: PricingCardProps) {
  return <div>...</div>
}
// No Zod schema, no catalog entry — dead end for multi-surface
```

**Correct:**
```typescript
import { z } from 'zod'

// 1. Derive Zod schema from the component's TypeScript props
export const PricingCardSchema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']),
  price: z.string().max(20),
  features: z.array(z.string().max(100)).min(1).max(10),
  highlighted: z.boolean().default(false),
})

// 2. Component implementation uses the same schema type
export type PricingCardProps = z.infer<typeof PricingCardSchema>

export function PricingCard({ plan, price, features, highlighted }: PricingCardProps) {
  return <div>...</div>
}
```

### How to Add to the Project's defineCatalog() Call

**Incorrect:**
```typescript
// Manual object spread loses runtime validation
const catalog = {
  ...existingComponents,
  PricingCard: { component: PricingCard },
}
```

**Correct:**
```typescript
import { mergeCatalogs } from '@json-render/core'
import { existingCatalog } from './catalog'
import { PricingCardSchema, PricingCard } from './components/PricingCard'

export const catalog = mergeCatalogs(existingCatalog, {
  PricingCard: {
    props: PricingCardSchema,
    children: false, // leaf component — no nested children
  },
})

// For layout components that wrap other catalog entries:
export const catalogWithLayout = mergeCatalogs(existingCatalog, {
  FeatureSection: {
    props: FeatureSectionSchema,
    children: true, // accepts any catalog children
  },
})
```

### Key Rules

- Always use `.max()` bounds on strings and arrays to prevent unbounded AI generation
- Use `z.enum()` for any prop with a finite set of valid values
- Set `children: false` for data-display components, `children: true` for layout wrappers
- Use `mergeCatalogs()` instead of manual spreading to preserve runtime validation
- Export the Zod schema alongside the component for reuse in tests and type generation
