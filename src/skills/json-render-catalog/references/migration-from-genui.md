---
title: "Migrating from Custom GenUI to json-render"
version: 1.0.0
---

# Migrating from Custom GenUI to json-render

Guide for migrating hand-rolled generative UI systems (custom JSON-to-component mapping) to json-render catalogs. The migration adds Zod validation, streaming, and cross-platform support without rewriting component implementations.

## Common Custom GenUI Patterns

Most custom GenUI systems follow one of these patterns:

### Pattern A: Direct Type Mapping
```typescript
// Custom: components map keyed by string type
const componentMap = {
  'card': CardComponent,
  'button': ButtonComponent,
  'table': TableComponent,
}

function render(spec) {
  const Component = componentMap[spec.type]
  return <Component {...spec.props}>{spec.children?.map(render)}</Component>
}
```

### Pattern B: Switch Statement
```typescript
function renderElement(element) {
  switch (element.type) {
    case 'card': return <Card {...element.props} />
    case 'button': return <Button {...element.props} />
    default: return null // Silent failure on unknown types
  }
}
```

### Pattern C: Nested JSON
```json
{
  "type": "card",
  "props": { "title": "Dashboard" },
  "children": [
    {
      "type": "button",
      "props": { "label": "Save" },
      "children": []
    }
  ]
}
```

## Migration Steps

### Step 1: Inventory Existing Components

List every component type your current system supports, along with the props each accepts:

```typescript
// Audit your component map / switch statement
const inventory = [
  { type: 'card', props: ['title', 'description', 'elevated'], hasChildren: true },
  { type: 'button', props: ['label', 'variant', 'onClick'], hasChildren: false },
  { type: 'table', props: ['columns', 'data', 'sortable'], hasChildren: false },
]
```

### Step 2: Define Zod Schemas for Each Component

Convert loosely-typed props to Zod schemas:

```typescript
// Before: untyped props — AI can pass anything
{ type: 'card', props: { title: 'anything', extra: 'unknown-prop' } }

// After: Zod-constrained catalog
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

export const catalog = defineCatalog({
  Card: {
    props: z.object({
      title: z.string().max(100),
      description: z.string().max(500).optional(),
      elevated: z.boolean().default(false),
    }),
    children: true,
  },
  Button: {
    props: z.object({
      label: z.string().max(50),
      variant: z.enum(['default', 'destructive', 'outline', 'ghost']),
      // Note: onClick is NOT in the catalog — use on.press instead
    }),
    children: false,
  },
})
```

### Step 3: Flatten Nested Specs

Convert nested JSON to flat-tree format:

```json
// Before: nested
{
  "type": "card",
  "props": { "title": "Dashboard" },
  "children": [
    { "type": "button", "props": { "label": "Save" } }
  ]
}

// After: flat tree
{
  "root": "card-1",
  "elements": {
    "card-1": {
      "type": "Card",
      "props": { "title": "Dashboard" },
      "children": ["btn-1"]
    },
    "btn-1": {
      "type": "Button",
      "props": { "label": "Save", "variant": "default" }
    }
  }
}
```

### Step 4: Replace Event Handlers

Custom GenUI often passes `onClick`, `onChange` as props. json-render uses the `on` field instead:

```json
// Before: handler in props
{ "type": "button", "props": { "label": "Save", "onClick": "save()" } }

// After: on field with action
{
  "type": "Button",
  "props": { "label": "Save", "variant": "default" },
  "on": { "press": { "action": "submit", "url": "/api/save", "method": "POST" } }
}
```

### Step 5: Wrap Existing Component Implementations

Your existing React/Vue components work as json-render implementations with minimal changes:

```typescript
import type { CatalogComponents } from '@json-render/react'
import type { catalog } from './catalog'

// Reuse existing component implementations
import { Card as ExistingCard } from '@/components/Card'
import { Button as ExistingButton } from '@/components/Button'

export const components: CatalogComponents<typeof catalog> = {
  Card: ({ title, description, elevated, children }) => (
    <ExistingCard title={title} description={description} elevated={elevated}>
      {children}
    </ExistingCard>
  ),
  Button: ({ label, variant }) => (
    <ExistingButton variant={variant}>{label}</ExistingButton>
  ),
}
```

### Step 6: Update AI Prompts

Update your LLM system prompts to generate flat-tree specs instead of nested JSON:

```
// Before: "Generate a UI component tree as nested JSON"
// After: "Generate a json-render spec. Use the flat-tree format with root and elements."
```

Include the catalog schema in the system prompt so the AI knows which types and props are available.

## Migration Checklist

- [ ] Inventoried all existing component types and props
- [ ] Created Zod schemas for each component with proper constraints
- [ ] Converted nested specs to flat-tree format
- [ ] Replaced event handler props with `on` field actions
- [ ] Wrapped existing component implementations with catalog types
- [ ] Updated AI system prompts to generate flat-tree specs
- [ ] Added runtime validation via `<Render catalog={...}>` component
- [ ] Tested with existing specs to verify backward compatibility
- [ ] Enabled streaming support if using progressive rendering
