---
name: json-render-catalog
description: "json-render component catalog patterns for AI-safe generative UI. Define Zod-typed catalogs that constrain what AI can generate, use @json-render/shadcn for 36 pre-built components, optimize specs with YAML mode, and apply the three edit modes (patch/merge/diff) for progressive updates. Use when building AI-generated UIs, defining component catalogs, or integrating json-render into React/Vue/Svelte/React Native/Ink/Next.js projects."
tags: [json-render, genui, zod, catalog, shadcn, ai-ui, component-catalog, vercel]
version: 1.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
context: inherit
persuasion-type: reference
metadata:
  category: frontend
  upstream-package: "@json-render/core"
  upstream-version-tested: "0.17.0"
  shadcn-component-count: 36
---

# json-render Component Catalogs

json-render (Vercel Labs, 12.9K stars, Apache-2.0) is a framework for AI-safe generative UI. AI generates flat-tree JSON (or YAML) specs constrained to a developer-defined catalog — the catalog is the contract between your design system and AI output. If a component or prop is not in the catalog, AI cannot generate it.

## New in 2026-04 (json-render 0.14 → 0.17)

- **Three edit modes (0.14)** — `patch` (RFC 6902), `merge` (RFC 7396), `diff` (unified) for progressive AI refinements. `buildEditUserPrompt()` + `diffToPatches()` + `deepMergeSpec()` in `@json-render/core`.
- **`@json-render/yaml` (0.14)** — official YAML wire format + streaming parser; `buildUserPrompt({ format: 'yaml' })`.
- **`@json-render/ink` (0.15)** — render catalogs to terminal UIs (Ink-based, 20+ components) using the same spec.
- **`@json-render/next` (0.16)** — generate full Next.js apps (routes, layouts, SSR, metadata) from a single spec.
- **`@json-render/shadcn-svelte` (0.16)** — 36-component Svelte 5 + Tailwind mirror of the React shadcn catalog.
- **shadcn catalog at 36 components** (was documented as 29 — the count was wrong even at 0.13). Use `@json-render/shadcn` as-is or `mergeCatalogs()` with your custom types.
- **`@json-render/react-three-fiber`** now ships 20 components including `GaussianSplat` (0.17).
- **`@json-render/mcp`** — upgrade plain MCP tool JSON into interactive iframes inside Claude/Cursor/ChatGPT conversations. See the `ork:mcp-visual-output` skill.
- **MCP multi-surface**: same spec renders to React, PDF (`@json-render/react-pdf`), email (`@json-render/react-email`), terminal (Ink), Next.js apps, and Remotion videos.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Catalog Definition](#catalog-definition) | 1 | HIGH | Defining component catalogs with Zod |
| [Prop Constraints](#prop-constraints) | 1 | HIGH | Constraining AI-generated props for safety |
| [shadcn Catalog](#shadcn-catalog) | 1 | MEDIUM | Using pre-built shadcn components |
| [Token Optimization](#token-optimization) | 1 | MEDIUM | Reducing token usage with YAML mode |
| [Actions & State](#actions--state) | 1 | MEDIUM | Adding interactivity to specs |

**Total: 5 rules across 5 categories**

## How json-render Works

1. **Developer defines a catalog** — Zod-typed component definitions with constrained props
2. **AI generates a spec** — flat-tree JSON/YAML referencing only catalog components
3. **Runtime renders the spec** — `<Render>` component validates and renders each element

The catalog is the safety boundary. AI can only reference types that exist in the catalog, and props are validated against Zod schemas at runtime. This prevents hallucinated components and invalid props from reaching the UI.

## Quick Start — 3 Steps

### Step 1: Define a Catalog

```typescript
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

export const catalog = defineCatalog({
  Card: {
    props: z.object({
      title: z.string(),
      description: z.string().optional(),
    }),
    children: true,
  },
  Button: {
    props: z.object({
      label: z.string(),
      variant: z.enum(['default', 'destructive', 'outline', 'ghost']),
    }),
    children: false,
  },
  StatGrid: {
    props: z.object({
      items: z.array(z.object({
        label: z.string(),
        value: z.string(),
        trend: z.enum(['up', 'down', 'flat']).optional(),
      })).max(20),
    }),
    children: false,
  },
})
```

### LLM Structured Output Compatibility

Use `jsonSchema({ strict: true })` to export catalog schemas compatible with LLM structured output APIs (OpenAI, Anthropic, Gemini):

```typescript
import { jsonSchema } from '@json-render/core'

const schema = jsonSchema(catalog, { strict: true })
// Pass to OpenAI response_format, Anthropic tool_use, or Gemini structured output
```

### Step 2: Implement Components

```tsx
import type { CatalogComponents } from '@json-render/react'
import type { catalog } from './catalog'

export const components: CatalogComponents<typeof catalog> = {
  Card: ({ title, description, children }) => (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground">{description}</p>}
      {children}
    </div>
  ),
  Button: ({ label, variant }) => (
    <button className={cn('btn', `btn-${variant}`)}>{label}</button>
  ),
  StatGrid: ({ items }) => (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  ),
}
```

### Step 3: Render a Spec

```tsx
import { Render } from '@json-render/react'
import { catalog } from './catalog'
import { components } from './components'

function App({ spec }: { spec: JsonRenderSpec }) {
  return <Render catalog={catalog} components={components} spec={spec} />
}
```

## Spec Format

The JSON spec is a flat tree — no nesting, just IDs and references. Load `references/spec-format.md` for full documentation.

```json
{
  "root": "card-1",
  "elements": {
    "card-1": {
      "type": "Card",
      "props": { "title": "Dashboard" },
      "children": ["chart-1", "btn-1"]
    },
    "btn-1": {
      "type": "Button",
      "props": { "label": "View Details", "variant": "default" }
    }
  }
}
```

### With Interactivity (on / watch / state)

```json
{
  "root": "card-1",
  "elements": {
    "card-1": {
      "type": "Card",
      "props": { "title": "Dashboard" },
      "children": ["chart-1", "btn-1"],
      "on": { "press": { "action": "setState", "path": "/view", "value": "detail" } },
      "watch": { "/data": { "action": "load_data", "url": "/api/stats" } }
    }
  },
  "state": { "/activeTab": "overview" }
}
```

Load `rules/action-state.md` for event handlers, watch bindings, and state adapter patterns.

## YAML Mode — 30% Fewer Tokens

For standalone (non-streaming) generation, YAML specs use ~30% fewer tokens than JSON:

```yaml
root: card-1
elements:
  card-1:
    type: Card
    props:
      title: Dashboard
    children: [chart-1, btn-1]
  btn-1:
    type: Button
    props:
      label: View Details
      variant: default
```

Use JSON for inline mode / streaming (JSON Patch RFC 6902 over JSONL requires JSON). Use YAML for standalone mode where token cost matters. Load `rules/token-optimization.md` for selection criteria.

## Progressive Streaming

json-render supports progressive rendering during streaming. As the AI generates spec elements, they render immediately — the user sees the UI building in real-time. This uses JSON Patch (RFC 6902) operations streamed over JSONL:

```jsonl
{"op":"add","path":"/elements/card-1","value":{"type":"Card","props":{"title":"Dashboard"},"children":[]}}
{"op":"add","path":"/elements/btn-1","value":{"type":"Button","props":{"label":"Save","variant":"default"}}}
{"op":"add","path":"/elements/card-1/children/-","value":"btn-1"}
```

Elements render as soon as their props are complete — no waiting for the full spec.

## @json-render/shadcn — 36 Pre-Built Components

The `@json-render/shadcn` package provides a production-ready catalog of 36 components with Zod schemas already defined. Load `rules/shadcn-catalog.md` for the full component list and when to extend vs use as-is.

> **Svelte:** `@json-render/shadcn-svelte` (added in 0.16) mirrors the same 36 components for Svelte 5 + Tailwind projects.

```typescript
import { shadcnCatalog, shadcnComponents } from '@json-render/shadcn'
import { mergeCatalogs } from '@json-render/core'

// Use as-is
<Render catalog={shadcnCatalog} components={shadcnComponents} spec={spec} />

// Or merge with custom components
const catalog = mergeCatalogs(shadcnCatalog, customCatalog)
```

### Style-Aware Catalogs

The shadcn catalog components use default Tailwind classes. When your project uses a specific shadcn v4 style (Luma, Nova, etc.), override component implementations to match:

```typescript
import { shadcnCatalog, shadcnComponents } from '@json-render/shadcn'
import { mergeCatalogs, type CatalogComponents } from '@json-render/core'

// Override shadcn component implementations for Luma style
const lumaComponents: Partial<CatalogComponents<typeof shadcnCatalog>> = {
  Card: ({ title, description, children }) => (
    <div className="rounded-4xl border shadow-md ring-1 ring-foreground/5 p-6">
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground">{description}</p>}
      <div className="mt-6">{children}</div>
    </div>
  ),
  Button: ({ label, variant }) => (
    <button className={cn('rounded-4xl', buttonVariants({ variant }))}>{label}</button>
  ),
}

// Merge: catalog schema unchanged, only rendering adapts to style
const components = { ...shadcnComponents, ...lumaComponents }
```

**Detection pattern:** Read `components.json` → `"style"` field to determine which overrides to apply. Style-specific class names: Luma (`rounded-4xl`, `shadow-md`, `gap-6`), Nova (compact `px-2 py-1`), Lyra (`rounded-none`).

## Edit Modes — patch / merge / diff (0.14+)

For updating specs after initial render (AI-driven refinements, user edits, partial regenerations), core ships three universal edit modes:

| Mode | Spec | When to use |
|------|------|-------------|
| `patch` | RFC 6902 JSON Patch | Precise, streamed diffs (already used for progressive streaming) |
| `merge` | RFC 7396 JSON Merge Patch | Simpler updates, whole-field replacements |
| `diff`  | Unified diff of serialized spec | AI-native output when the model prefers plaintext diffs |

```typescript
import { deepMergeSpec, diffToPatches, buildEditUserPrompt } from '@json-render/core'

// Ask the model for an edit in whichever format it finds easiest
const prompt = buildEditUserPrompt(currentSpec, instruction, { format: 'yaml', mode: 'merge' })

// Normalize any edit mode to RFC 6902 patches for application
const patches = diffToPatches(aiResponse)
const next = deepMergeSpec(currentSpec, patches)
```

`buildUserPrompt()` also gained `format` and `serializer` options in 0.14 — pick YAML for standalone specs and JSON for streaming.

## Package Ecosystem

Core + 23 renderer/integration packages covering web, mobile, terminal, 3D, codegen, and state management. Load `references/package-ecosystem.md` for the full list organized by category.

**Added since 0.13:**
- `@json-render/yaml` (0.14) — YAML wire format + streaming parser
- `@json-render/ink` (0.15) — terminal UI renderer (Ink-based, 20+ components)
- `@json-render/next` (0.16) — generates full Next.js apps (routes, layouts, SSR, metadata)
- `@json-render/shadcn-svelte` (0.16) — 36-component Svelte 5 mirror of the React shadcn catalog
- `@json-render/react-three-fiber` now ships 20 components (includes `GaussianSplat` in 0.17)

## When to Use vs When NOT to Use

**Use json-render when:**
- AI generates UI and you need to constrain what it can produce
- You want runtime-validated specs that prevent hallucinated components
- You need cross-platform rendering (React, Vue, Svelte, React Native, PDF, email)
- You are building generative UI features (dashboards, reports, forms from natural language)

**Do NOT use json-render when:**
- Building static, developer-authored UI — use components directly
- AI generates code (JSX/TSX) rather than specs — use standard code generation
- You need full creative freedom without catalog constraints — json-render is deliberately restrictive
- Performance-critical rendering with thousands of elements — the flat-tree abstraction adds overhead

## Migrating from Custom GenUI

If you have existing custom generative UI (hand-rolled JSON-to-component mapping), load `references/migration-from-genui.md` for a step-by-step migration guide.

## Rule Details

### Catalog Definition

How to define catalogs with `defineCatalog()` and Zod schemas.

| Rule | File | Key Pattern |
|------|------|-------------|
| Catalog Definition | `rules/catalog-definition.md` | defineCatalog with Zod schemas, children types |

### Prop Constraints

Constraining props to prevent AI hallucination.

| Rule | File | Key Pattern |
|------|------|-------------|
| Prop Constraints | `rules/prop-constraints.md` | z.enum, z.string().max(), z.array().max() |

### shadcn Catalog

Using the 36 pre-built shadcn components.

| Rule | File | Key Pattern |
|------|------|-------------|
| shadcn Catalog | `rules/shadcn-catalog.md` | @json-render/shadcn components and extension |

### Token Optimization

Choosing JSON vs YAML for token efficiency.

| Rule | File | Key Pattern |
|------|------|-------------|
| Token Optimization | `rules/token-optimization.md` | YAML for standalone mode, JSON for inline/streaming |

### Actions & State

Adding interactivity with events, watchers, and state.

| Rule | File | Key Pattern |
|------|------|-------------|
| Action & State | `rules/action-state.md` | on events, watch reactivity, state adapters |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Custom vs shadcn catalog | Start with shadcn, extend with custom types for domain-specific components |
| JSON vs YAML spec format | YAML for standalone mode (30% fewer tokens), JSON for inline/streaming |
| Zod constraint strictness | Tighter is better — use z.enum over z.string, z.array().max() over unbounded |
| State management adapter | Match your app's existing state library (Zustand, Redux, Jotai, XState) |

## Common Mistakes

1. Using `z.any()` or `z.unknown()` in catalog props — defeats the purpose of catalog constraints, AI can generate anything
2. Always using JSON specs — wastes 30% tokens when inline/streaming is not needed (use YAML in standalone mode)
3. Nesting component definitions — json-render uses a flat tree; all elements are siblings referenced by ID
4. Skipping `mergeCatalogs()` when combining shadcn + custom — manual merging loses type safety
5. Not setting `.max()` on arrays — AI can generate unbounded lists that break layouts

## Related Skills

- `ork:ai-ui-generation` — AI-assisted UI generation patterns for v0, Bolt, Cursor
- `ork:ui-components` — shadcn/ui component patterns and CVA variants
- `ork:component-search` — Finding and evaluating React/Vue components
- `ork:design-to-code` — Converting designs to production code
