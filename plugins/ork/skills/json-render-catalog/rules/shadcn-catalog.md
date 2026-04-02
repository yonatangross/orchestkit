---
title: "shadcn Catalog — 29 Pre-Built Components"
impact: "MEDIUM"
impactDescription: "Building custom catalog components from scratch when shadcn provides production-ready alternatives wastes effort and introduces inconsistency"
tags: [json-render, shadcn, components, catalog, pre-built]
---

## shadcn Catalog — 29 Pre-Built Components

`@json-render/shadcn` provides 29 components with Zod schemas and implementations ready to use. Start here before building custom catalog entries — these components cover most dashboard, form, and content display needs.

**Incorrect:**
```typescript
// Building from scratch when shadcn already provides it
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

const catalog = defineCatalog({
  // Reimplementing what shadcn already has
  Alert: {
    props: z.object({
      title: z.string(),
      description: z.string(),
      variant: z.enum(['default', 'destructive']),
    }),
    children: false,
  },
  // ... 35 more hand-rolled components
})
```

**Correct:**
```typescript
import { shadcnCatalog, shadcnComponents } from '@json-render/shadcn'
import { mergeCatalogs } from '@json-render/core'
import { z } from 'zod'

// Use shadcn as-is for standard components
<Render catalog={shadcnCatalog} components={shadcnComponents} spec={spec} />

// Extend with domain-specific components only
const appCatalog = mergeCatalogs(shadcnCatalog, {
  PricingCard: {
    props: z.object({
      plan: z.enum(['free', 'pro', 'enterprise']),
      price: z.string().max(20),
      features: z.array(z.string().max(100)).max(10),
    }),
    children: false,
  },
})
```

### The 29 shadcn Components

**Layout & Container:**
| Component | Key Props | Children |
|-----------|-----------|----------|
| Card | title, description, footer | true |
| Accordion | type (single/multiple), collapsible | true |
| Tabs | defaultValue, orientation | true |
| Sheet | side (top/right/bottom/left) | true |
| Dialog | title, description | true |
| Collapsible | open, defaultOpen | true |
| Separator | orientation, decorative | false |
| ScrollArea | orientation | true |
| AspectRatio | ratio | true |

**Data Display:**
| Component | Key Props | Children |
|-----------|-----------|----------|
| Table | columns, rows, caption | false |
| Badge | variant, label | false |
| Avatar | src, alt, fallback | false |
| Progress | value, max | false |
| Skeleton | width, height, variant | false |
| HoverCard | triggerText | true |
| Tooltip | content, side | true |

**Form & Input:**
| Component | Key Props | Children |
|-----------|-----------|----------|
| Button | label, variant, size, disabled | false |
| Input | placeholder, type, label | false |
| Textarea | placeholder, rows, label | false |
| Select | options, placeholder, label | false |
| Checkbox | label, checked, disabled | false |
| RadioGroup | options, defaultValue, label | false |
| Switch | label, checked, disabled | false |
| Slider | min, max, step, defaultValue | false |
| Label | text, htmlFor | false |
| Toggle | label, pressed, variant | false |
| ToggleGroup | type, items | false |

**Navigation:**
| Component | Key Props | Children |
|-----------|-----------|----------|
| NavigationMenu | items | false |
| Breadcrumb | items, separator | false |
| Menubar | menus | false |
| DropdownMenu | triggerLabel, items | false |
| ContextMenu | items | true |
| Command | placeholder, groups | false |

**Feedback:**
| Component | Key Props | Children |
|-----------|-----------|----------|
| Alert | title, description, variant | false |
| AlertDialog | title, description, actionLabel | false |
| Toast | title, description, variant, action | false |
### When to Extend vs Use As-Is

| Scenario | Approach |
|----------|----------|
| Standard UI (dashboards, settings, forms) | Use shadcn as-is |
| Domain-specific display (pricing, metrics, timelines) | Add custom components via `mergeCatalogs` |
| Branded components (custom design system) | Override shadcn implementations, keep schemas |
| Project uses shadcn v4 style (Luma, Nova, etc.) | Override implementations with style-correct classes |
| Highly specialized (3D, charts, maps) | Add custom + use `@json-render/react-three-fiber` |

### Style-Aware Overrides

When your project uses a shadcn v4 style, the default `shadcnComponents` use generic Tailwind classes that may not match. Override implementations to match the project's style.

**Incorrect — using default components in a Luma project:**
```typescript
// Default shadcnComponents use rounded-lg — wrong for Luma (rounded-4xl)
<Render catalog={shadcnCatalog} components={shadcnComponents} spec={spec} />
```

**Correct — overriding implementations for project's v4 style:**
```typescript
import { shadcnCatalog, shadcnComponents } from '@json-render/shadcn'
// Read components.json → style to determine overrides (Luma, Nova, etc.)
const lumaOverrides = {
  Card: ({ title, children }) => (
    <div className="rounded-4xl border shadow-md ring-1 ring-foreground/5 p-6">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-6">{children}</div>
    </div>
  ),
}
const components = { ...shadcnComponents, ...lumaOverrides }
```

**Key rules:**
- Start with `shadcnCatalog` — covers 80% of common UI patterns out of the box
- Use `mergeCatalogs()` to add domain-specific components alongside shadcn
- Override implementations (not schemas) for branded styling or v4 style conformance
- Check `components.json` → `"style"` to determine which class overrides apply
