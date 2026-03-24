---
description: "Mockup-to-component pipeline using Google Stitch and 21st.dev. Accepts screenshots, descriptions, or URLs as input and produces production-ready React components. Orchestrates design extraction via Stitch MCP, component matching via 21st.dev registry, and adaptation to project design tokens. Use when converting visual designs to code, implementing UI from mockups, or building components from screenshots."
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Auto-generated from skills/design-to-code/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Design to Code

Convert visual designs into production-ready React components using a four-stage pipeline: Extract, Match, Adapt, Render.

```bash
/ork:design-to-code screenshot of hero section    # From description
/ork:design-to-code /tmp/mockup.png               # From screenshot
/ork:design-to-code https://example.com/pricing    # From URL
```

## Pipeline Overview

```
Input (screenshot/description/URL)
  │
  ▼
┌─────────────────────────┐
│ Stage 1: EXTRACT         │  Stitch MCP → HTML + design context
│ get_screen_code          │  Extract colors, typography, layout
│ extract_design_context   │  Produce design-tokens.json
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ Stage 2: MATCH           │  21st.dev Magic → search components
│ Search by description    │  Find production-ready matches
│ Filter by framework      │  React + Tailwind preferred
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ Stage 3: ADAPT           │  Merge extracted design + matched
│ Apply project tokens     │  components into final implementation
│ Customize to codebase    │  Tests + types included
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ Stage 4: RENDER          │  Register as json-render catalog entry
│ Generate Zod schema      │  Same component → PDF, email, video
│ Add to defineCatalog()   │  Multi-surface reuse via MCP output
└─────────────────────────┘
```

## Argument Resolution

```python
INPUT = ""  # Full argument string
# Detect input type:
# - Starts with "/" or "~" or contains ".png"/".jpg" → screenshot file path
# - Starts with "http" → URL to screenshot or live page
# - Otherwise → natural language description
```

## Step 0: Detect Input Type and Project Context

```python
TaskCreate(subject="Design to code: {INPUT}", description="Four-stage pipeline: extract, match, adapt, render")

# Detect project's design system
Glob("**/tailwind.config.*")
Glob("**/tokens.css")
Glob("**/.tokens.json")
# Read existing tokens if found → used in Stage 3
```

## Stage 1: Extract Design Context

**If stitch MCP is available:**
```python
# For screenshot/URL input:
# Use official Stitch MCP tools to extract design HTML and context
# Tools: get_screen, list_screens, get_project

# For description input:
# generate_screen_from_text to create design, then get_screen to extract
```

**If stitch MCP is NOT available (fallback):**
```python
# For screenshot: Read the image file directly (Claude is multimodal)
# Analyze layout, colors, typography, spacing from the image
# For URL: WebFetch the page, extract HTML structure
# For description: Skip extraction, proceed to Stage 2 with description
```

Extract and produce:
- Color palette (hex/oklch values)
- Typography (font families, sizes, weights)
- Spacing patterns (padding, margins, gaps)
- Component structure (headers, cards, buttons, etc.)
- Layout pattern (grid, flex, sidebar, etc.)

## Stage 2: Match Components from Registry

**If 21st-dev-magic is available:**
```python
# Search 21st.dev for matching components
# Use the component descriptions from Stage 1
# Example: "animated pricing table with toggle"
# Filter: React, Tailwind CSS, shadcn/ui compatible
```

**If 21st-dev-magic is NOT available (fallback):**
```python
# Search for components in the project's existing codebase
Grep(pattern="export.*function|export.*const", glob="**/*.tsx")
# Check for shadcn/ui components
Glob("**/components/ui/*.tsx")
# Generate from scratch if no matches found
```

Present matches to user:
```python
AskUserQuestion(questions=[{
  "question": "Which component approach for {component_name}?",
  "header": "Component",
  "options": [
    {"label": "Use 21st.dev match", "description": "{matched_component_name} — {match_score}% match"},
    {"label": "Adapt from codebase", "description": "Modify existing {existing_component}"},
    {"label": "Generate from scratch", "description": "Build new component from extracted design"}
  ],
  "multiSelect": false
}])
```

## Stage 3: Adapt to Project

Merge the extracted design context with matched/generated components:

1. **Apply project tokens** — Replace hardcoded colors/spacing with project's design tokens
2. **Match naming conventions** — Follow project's component naming patterns
3. **Add TypeScript types** — Full type safety with Zod validation for any data props
4. **Include tests** — MSW handlers for API-backed components, render tests for static
5. **Responsive** — Mobile-first with breakpoints matching project's system

### Output Structure
```
src/components/
  └── {ComponentName}/
      ├── {ComponentName}.tsx       # Main component
      ├── {ComponentName}.test.tsx  # Tests
      └── index.ts                 # Barrel export
```

## Stage 4: Register in json-render Catalog

After ADAPT produces a working React component, register it as a json-render catalog entry for multi-surface reuse.

1. **Generate Zod schema** — Derive a Zod schema from the component's TypeScript props
2. **Add catalog entry** — Register in the project's `defineCatalog()` call with props schema and children declaration
3. **Verify rendering** — Confirm the component renders correctly through `<Render catalog={catalog} />` path

```typescript
import { z } from 'zod'

// Zod schema derived from {ComponentName}Props
const componentSchema = z.object({
  title: z.string().max(100),
  variant: z.enum(['default', 'featured']).default('default'),
  // ... props from the adapted component
})

// Add to project catalog
import { defineCatalog, mergeCatalogs } from '@json-render/core'
import { existingCatalog } from './catalog'

export const catalog = mergeCatalogs(existingCatalog, {
  {ComponentName}: {
    props: componentSchema,
    children: true, // or false for leaf components
  },
})
```

**Enables:** same component output to PDF, email, video, or MCP response — no reimplementation needed.

**Skip condition:** If the project has no json-render dependency or catalog, inform the user and skip Stage 4. The component from Stage 3 is still fully usable standalone.

## Graceful Degradation

| stitch | 21st-dev-magic | json-render catalog | Behavior |
|------------|----------------|---------------------|----------|
| Available | Available | Available | Full pipeline: extract + match + adapt + render |
| Available | Available | Unavailable | Extract + match + adapt (skip Stage 4) |
| Available | Unavailable | Available | Extract design, generate + register in catalog |
| Unavailable | Available | Available | Description-based search + adapt + register |
| Unavailable | Unavailable | Unavailable | Manual analysis + generate from scratch (still works) |

The skill ALWAYS produces output regardless of MCP/catalog availability. Stage 4 is additive — skipping it still yields a working component.

## Anti-Patterns

- **NEVER** output components with hardcoded colors — use design tokens
- **NEVER** skip TypeScript types — all props must be typed
- **NEVER** generate without checking existing project patterns first
- **NEVER** ignore the project's existing component library structure

## Related Skills

- `ork:component-search` — Search 21st.dev registry standalone
- `ork:design-context-extract` — Extract design DNA from screenshots
- `ork:design-system-tokens` — Token architecture and management
- `ork:frontend-design` — Creative frontend design generation
- `ork:json-render-catalog` — Catalog definition, Zod schemas, defineCatalog patterns
- `ork:multi-surface-render` — Render catalog entries to PDF, email, video, MCP
