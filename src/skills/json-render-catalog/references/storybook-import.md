---
title: Storybook → json-render catalog import
impact: HIGH
impactDescription: Eliminates the dual-source-of-truth problem (Storybook stories vs json-render catalog). Storybook becomes the single source; the catalog is generated from it.
tags: [storybook, json-render, catalog, generative-ui, zod, single-source]
---

# Storybook → json-render Catalog Import

The `storybook-to-catalog.mjs` script imports a Storybook component manifest (from `@storybook/addon-mcp`'s `list-all-documentation` tool) and emits a Zod-typed json-render catalog. This makes Storybook the single source of truth for generative UI: stories define props, prop types become Zod constraints, AI can only generate components that have stories.

This is the implementation for issue #1529 (Lane C • Tier B): genui-architect imports Storybook stories as AI-safe catalog.

## Workflow

```
Storybook stories
   │
   ├─[ @storybook/addon-mcp ]─▶ list-all-documentation tool
   │                              │
   │                              ▼
   │                            JSON manifest (components + argTypes)
   │
   └─[ storybook-to-catalog.mjs ]──▶ catalog.ts (Zod schemas) + components.tsx (registry)
```

1. Run Storybook with `@storybook/addon-mcp` enabled (see `ork:storybook-mcp-integration`).
2. Capture the manifest:
   ```bash
   curl -s http://localhost:6006/mcp -X POST \
     -H 'Content-Type: application/json' \
     -d '{"method":"tools/call","params":{"name":"list-all-documentation"}}' \
     > storybook-manifest.json
   ```
3. Generate the catalog:
   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/storybook-to-catalog.mjs" \
     storybook-manifest.json \
     --out src/genui/catalog.ts
   ```
4. Review the generated catalog. Tune individual schemas if AI is generating unsafe values.

## Storybook ArgType → Zod mapping

The script applies a deterministic mapping. Anything outside this list is **dropped from the catalog** with a warning — AI safety first; you can add it back manually after review.

| Storybook arg | Zod | Notes |
|---|---|---|
| `{ control: 'text' }` | `z.string().max(500)` | Length cap prevents prompt-injection-via-text |
| `{ control: 'number' }` | `z.number()` | If `min`/`max` set, applied via `.min().max()` |
| `{ control: 'boolean' }` | `z.boolean()` | — |
| `{ control: 'select', options: [...] }` | `z.enum([...])` | Best case — fully constrained |
| `{ control: 'radio', options: [...] }` | `z.enum([...])` | Same |
| `{ control: 'color' }` | `z.string().regex(/^#[0-9a-fA-F]{6}$/)` | Hex only |
| `{ control: 'date' }` | `z.iso.datetime()` | ISO-8601 |
| `{ control: 'object' }` | **DROPPED** | Too open-ended for AI safety; add manually with explicit shape |
| `{ control: 'array' }` | `z.array(z.string()).max(20)` | Length cap; assumed string elements |
| TypeScript `ReactNode` | `children: 'allowed'` | Marks the catalog entry as a container |
| TypeScript `() => void` (callbacks) | **DROPPED** | AI cannot generate functions; the registry wires them |

## Output

The script emits two files:

### `catalog.ts`
```typescript
// AUTO-GENERATED from Storybook — do not edit by hand
// Source: storybook-manifest.json (sha-1: <hash>)
// Generated: 2026-04-28T05:00:00Z
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

export const catalog = defineCatalog(schema, {
  components: {
    Card: {
      description: 'Card component with optional title and elevation',
      props: z.object({
        title: z.string().max(500).optional(),
        elevation: z.enum(['flat', 'low', 'high']),
      }),
      children: 'allowed',
    },
    Button: {
      description: 'Button with size and variant',
      props: z.object({
        label: z.string().max(500),
        size: z.enum(['sm', 'md', 'lg']),
        variant: z.enum(['primary', 'secondary', 'ghost']),
        disabled: z.boolean().optional(),
      }),
      children: false,
    },
    // ...
  },
})
```

### `components.tsx`
```typescript
// AUTO-GENERATED from Storybook — wires catalog to actual React components
// Edit imports if your story files live elsewhere.
import type { CatalogComponents } from '@json-render/react'
import type { catalog } from './catalog'
import { Card } from '../components/Card'
import { Button } from '../components/Button'

export const components: CatalogComponents<typeof catalog> = {
  Card,
  Button,
  // ...
}
```

The `components.tsx` import paths are derived from the story file paths in the manifest (e.g. `src/components/Card/Card.stories.tsx` → `import { Card } from '../components/Card/Card'`). Always review the imports — story file colocation conventions vary.

## Validation

The script validates:
- Every emitted Zod schema parses cleanly (round-trip check)
- No `z.any()` or `z.unknown()` slips into the catalog (would defeat AI safety)
- Component names are unique
- At least one component is exported (otherwise the catalog is useless)

On any validation failure the script exits 1 and emits no files. The dropped-prop log is always written to stderr so you can see what was skipped.

## Genui-architect integration

The `genui-architect` agent has a "Storybook import" task path (see agent file). When the user has a Storybook setup, the agent should:

1. Probe for the Storybook MCP via `ToolSearch(query="+storybook list-all-documentation")`
2. If available, capture the manifest and run this script — emit the catalog as the **starting point**
3. Hand-tune individual schemas where AI safety demands tighter constraints than the auto-mapping produces
4. Verify the catalog is wired by sample-rendering a few stories via `mcp__storybook-mcp__preview-stories`

When Storybook MCP is **not** available, fall back to the existing manual catalog design workflow documented in `json-render-catalog/SKILL.md`.

## Why this matters

Without this importer, teams using both Storybook and json-render maintain two parallel definitions: the story file (props + canonical examples) and the catalog (Zod schemas). They drift. The Storybook manifest already carries everything needed to generate the catalog — emitting it once and regenerating on demand keeps Storybook as the single source of truth and eliminates the drift class entirely.
