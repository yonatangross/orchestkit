---
name: json-render-catalog
compatibility: "Claude Code 2.1.170+"
description: "json-render component catalog patterns for AI-safe generative UI. Define Zod-typed catalogs that constrain what AI can generate, use @json-render/shadcn for 36 pre-built components, optimize specs with YAML mode, and apply the three edit modes (patch/merge/diff) for progressive updates. Use when building AI-generated UIs, defining component catalogs, or integrating json-render into React/Vue/Svelte/React Native/Ink/Next.js projects."
tags: [json-render, genui, zod, catalog, shadcn, ai-ui, component-catalog, vercel]
version: 1.3.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
context: inherit
persuasion-type: reference
metadata:
  category: frontend
  upstream-package: "@json-render/core"
  upstream-version-tested: "0.19.0"
  shadcn-component-count: 36
---

# json-render Component Catalogs

json-render (Vercel Labs, 12.9K stars, Apache-2.0) is a framework for AI-safe generative UI. AI generates flat-tree JSON (or YAML) specs constrained to a developer-defined catalog — the catalog is the contract between your design system and AI output. If a component or prop is not in the catalog, AI cannot generate it.

## Storybook → catalog import (#1529, 2026-04)

When the project ships a Storybook setup, **import the catalog from Storybook stories** instead of hand-writing one. The bundled importer at `scripts/storybook-to-catalog.mjs` reads a `@storybook/addon-mcp` `list-all-documentation` manifest and emits a Zod-typed `catalog.ts` plus a `components.tsx` registry.

```bash
node "${CLAUDE_SKILL_DIR}/scripts/storybook-to-catalog.mjs" storybook-manifest.json \
  --out src/genui/catalog.ts \
  --components src/genui/components.tsx \
  --project-root .
```

Storybook becomes the single source of truth — adding a story automatically expands the AI-allowed surface; removing one shrinks it. AI safety is enforced at import: callbacks, raw object props, and `z.any()` are dropped. Full mapping: `references/storybook-import.md`. Companion fixture for testing: `references/storybook-fixture.json`.

## New in 2026-04 → 2026-05 (json-render 0.14 → 0.19)

- **Custom directives API (0.19)** — `@json-render/core` now ships `defineDirective`, letting you declare new JSON shapes (e.g. `$format`, `$math`) that resolve to computed values at render time. Directives compose by nesting and resolve inside-out. All four renderers (React, Vue, Svelte, Solid) have built-in directive resolution. This is the safe escape hatch for computed values without widening the catalog to `z.any()`.
- **`@json-render/directives` package (0.19)** — seven ready-made directives: `$format` (date / currency / number / percent via `Intl`), `$math` (add, subtract, multiply, divide, mod, min, max, round, floor, ceil, abs), `$concat`, `$count`, `$truncate`, `$pluralize`, `$join`. Plus `createI18nDirective` for `$t` translation keys with `{{param}}` interpolation, and `standardDirectives` for one-line registration. Register once, use in any spec — AI no longer needs string-mangling or duplicated literals.
- **Devtools ecosystem (0.18)** — five new packages: `@json-render/devtools` core + framework adapters for React, Vue, Svelte, Solid. Inspector panel has six tabs (Spec, State, Actions, Stream, Catalog, Pick) with DOM element picking that maps back to spec keys. Tree-shakes to `null` in production. Companion Next.js demo app shipped with AI-chat + catalog integration. Action observer infrastructure exposed for adapters to mirror events into the panel.
- **Zod 4 fix (0.18)** — `formatZodType` now correctly handles `z.record()`, `z.default()`, and `z.literal()` (previously produced empty/wrong prompt output).
- **Three edit modes (0.14)** — `patch` (RFC 6902), `merge` (RFC 7396), `diff` (unified) for progressive AI refinements. `buildEditUserPrompt()` + `diffToPatches()` + `deepMergeSpec()` in `@json-render/core`.
- **`@json-render/yaml` (0.14)** — official YAML wire format + streaming parser; `buildUserPrompt({ format: 'yaml' })`.
- **`@json-render/ink` (0.15)** — render catalogs to terminal UIs (Ink-based, 20+ components) using the same spec.
- **`@json-render/next` (0.16)** — generate full Next.js apps (routes, layouts, SSR, metadata) from a single spec.
- **`@json-render/shadcn-svelte` (0.16)** — 36-component Svelte 5 + Tailwind mirror of the React shadcn catalog.
- **shadcn catalog at 36 components** (was documented as 29 — the count was wrong even at 0.13). Use `@json-render/shadcn` as-is or `mergeCatalogs()` with your custom types.
- **`@json-render/react-three-fiber`** now ships 20 components including `GaussianSplat` (0.17).
- **`@json-render/mcp`** — upgrade plain MCP tool JSON into interactive iframes inside Claude/Cursor/ChatGPT conversations. See the `ork:mcp-visual-output` skill.
- **MCP multi-surface**: same spec renders to React, PDF (`@json-render/react-pdf`), email (`@json-render/react-email`), terminal (Ink), Next.js apps, and Remotion videos.

## Directives — @json-render/directives (0.19)

Directives are the safe escape hatch for computed values. AI emits a `$`-prefixed object, the renderer resolves it inside-out before the component receives props — the catalog stays strict (no `z.any()` widening) and the spec stays declarative. The `@json-render/directives` package ships seven prebuilt directives plus an i18n factory; `standardDirectives` exports them as one array for one-line registration. Directives nest freely (e.g. `$format` wrapping `$math`) and are resolved by all four renderer integrations (React, Vue, Svelte, Solid).

### Registration

```tsx
import { defineRegistry, JSONUIProvider, Renderer } from '@json-render/react'
import { standardDirectives, createI18nDirective } from '@json-render/directives'

const directives = [
  ...standardDirectives,
  createI18nDirective({
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en: { greeting: 'Hello, {{name}}!' } },
  }),
]

const { registry } = defineRegistry(catalog, { components })

// directives register on the provider (RendererProps has no directives prop)
<JSONUIProvider registry={registry} directives={directives}>
  <Renderer spec={spec} registry={registry} />
</JSONUIProvider>
```

### The seven prebuilt directives

| Directive | Purpose | Minimal usage |
|-----------|---------|---------------|
| `$format` | `Intl`-based formatting for `date`, `currency`, `number`, `percent`. Supports `locale`, `currency`, `notation`, and `style: "relative"` for human-readable date deltas. | `{ "$format": "currency", "value": 1299, "currency": "USD" }` → `$1,299.00` |
| `$math` | Arithmetic — `add`, `subtract`, `multiply`, `divide`, `mod`, `min`, `max`, `round`, `floor`, `ceil`, `abs`. Division by zero returns `0`; non-numeric inputs coerce to `0`. | `{ "$math": "multiply", "a": { "$state": "/qty" }, "b": 9.99 }` |
| `$concat` | Joins an array of dynamic values into a string, resolving each element through the directive pipeline first. | `{ "$concat": ["Hello, ", { "$state": "/user/name" }, "!"] }` |
| `$count` | Length of an array or string; `0` for anything else. | `{ "$count": { "$state": "/items" } }` |
| `$truncate` | Truncate to `length` (default 100) with optional `suffix` (default `...`). No-op if already short enough. | `{ "$truncate": { "$state": "/bio" }, "length": 80 }` |
| `$pluralize` | Singular/plural/zero selection. Prepends the count automatically (`"3 items"`, `"1 item"`, or the literal `zero` form). | `{ "$pluralize": { "$state": "/cart/count" }, "zero": "no items", "one": "item", "other": "items" }` |
| `$join` | Join an array with a `separator` (default `", "`). | `{ "$join": { "$state": "/tags" }, "separator": " · " }` |

`createI18nDirective({ locale, messages, fallbackLocale? })` registers a `$t` directive with `{{param}}` interpolation: `{ "$t": "greeting", "params": { "name": "Ada" } }`.

### Custom directives via `defineDirective`

`defineDirective` lives in `@json-render/core` (0.19+). A directive declares a Zod schema for its JSON shape and a `resolve(raw, ctx)` function — use `resolvePropValue(raw.field, ctx)` to recursively resolve any nested directive or state reference before computing.

```ts
import { defineDirective, resolvePropValue } from '@json-render/core'
import { z } from 'zod'

export const initialsDirective = defineDirective({
  name: '$initials',
  description: 'First letter of each word, uppercased.',
  schema: z.object({ $initials: z.unknown() }),
  resolve(raw, ctx) {
    const text = String(resolvePropValue(raw.$initials, ctx) ?? '')
    return text.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('')
  },
})
```

Spread into the renderer alongside `standardDirectives`: `directives={[...standardDirectives, initialsDirective]}`. Keep the schema tight — directives are the only place where AI gets to emit non-catalog JSON, so let Zod enforce shape just like a component prop.

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
3. **Runtime renders the spec** — `<Renderer>` component validates and renders each element

The catalog is the safety boundary. AI can only reference types that exist in the catalog, and props are validated against Zod schemas at runtime. This prevents hallucinated components and invalid props from reaching the UI.

## Quick Start — 3 Steps

### Step 1: Define a Catalog

```typescript
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

export const catalog = defineCatalog(schema, {
  components: {
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
import { defineRegistry, Renderer } from '@json-render/react'
import { catalog } from './catalog'
import { components } from './components'

// defineRegistry returns DefineRegistryResult — destructure `registry`
const { registry } = defineRegistry(catalog, { components })

function App({ spec }: { spec: JsonRenderSpec }) {
  return <Renderer spec={spec} registry={registry} />
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

```tsx
import { shadcnCatalog, shadcnComponents } from '@json-render/shadcn'
import { defineRegistry, Renderer } from '@json-render/react'
import { mergeCatalogs } from '@json-render/core'

// Use as-is
const { registry } = defineRegistry(shadcnCatalog, { components: shadcnComponents })
<Renderer spec={spec} registry={registry} />

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
- `@json-render/devtools` + framework adapters (0.18) — six-tab inspector panel, DOM picker, tree-shakes to `null` in prod
- `@json-render/directives` (0.19) — seven Intl/math/string directives + `createI18nDirective` + `standardDirectives` registration helper

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
