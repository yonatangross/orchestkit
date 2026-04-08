---
description: "Mockup-to-component pipeline using Google Stitch, 21st.dev, and Storybook MCP. Accepts screenshots, descriptions, or URLs as input and produces production-ready React components. Checks existing Storybook components before generating, orchestrates design extraction via Stitch MCP, component matching via 21st.dev registry, adaptation to project design tokens, and self-healing verification via run-story-tests. Use when converting visual designs to code, implementing UI from mockups, or building components from screenshots."
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
│ Stage 2: MATCH           │  1. Storybook MCP → check existing
│ Storybook-first lookup   │  2. 21st.dev → search public registry
│ Then 21st.dev fallback   │  3. Filesystem → grep codebase
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
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ Stage 4b: VERIFY         │  Storybook MCP → self-healing loop
│ run-story-tests(a11y)    │  Fix violations, retry (max 3)
│ preview-stories          │  Embed live preview in chat
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
# 1. Create main task IMMEDIATELY
TaskCreate(subject="Design to code: {INPUT}", description="Four-stage pipeline: extract, match, adapt, render", activeForm="Converting design to code")

# 2. Create subtasks for each stage
TaskCreate(subject="Extract design context", activeForm="Extracting design context")               # id=2
TaskCreate(subject="Match components (Storybook-first)", activeForm="Matching components")         # id=3
TaskCreate(subject="Adapt to project tokens and conventions", activeForm="Adapting to project")    # id=4
TaskCreate(subject="Register in json-render catalog", activeForm="Registering in catalog")         # id=5
TaskCreate(subject="Verify with Storybook self-healing", activeForm="Verifying component")         # id=6

# 3. Set dependencies for sequential stages
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Match needs extracted design context
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Adapt needs matched components
TaskUpdate(taskId="5", addBlockedBy=["4"])  # Render needs adapted component
TaskUpdate(taskId="6", addBlockedBy=["5"])  # Verify needs rendered component

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask

# Detect project's design system
Glob("**/tailwind.config.*")
Glob("**/tokens.css")
Glob("**/.tokens.json")
# Read existing tokens if found → used in Stage 3

# Detect shadcn/ui style (v4 style system)
Glob("**/components.json")
# Read → style field (e.g., "radix-luma", "base-nova")
# Determines class names: Luma=rounded-4xl, Nova=compact, Lyra=sharp
# Store: SHADCN_STYLE for Stage 2 filtering + Stage 3 adaptation
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

## Stage 2: Match Components (Storybook-First)

**Priority 1 — Check project's own Storybook (if storybook-mcp available):**
```python
# Search the project's existing component library first
inventory = list-all-documentation()  # Full component + docs manifest
for component in inventory.components:
    if component matches extracted_description:
        details = get-documentation(id=component.id)
        # Returns: props schema, stories, usage patterns
        # → Existing component found — skip external search
```

**Priority 2 — Search 21st.dev (if no Storybook match and 21st-dev-magic available):**
```python
# Search 21st.dev for matching components
# Use the component descriptions from Stage 1
# Example: "animated pricing table with toggle"
# Filter: React, Tailwind CSS, shadcn/ui compatible
# If SHADCN_STYLE detected, prefer components matching style's visual language
# (e.g., Luma → rounded/pill-shaped, Nova → compact/dense, Lyra → sharp/boxy)
```

**Priority 3 — Filesystem fallback (if no MCP servers available):**
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
    {"label": "Reuse from Storybook", "description": "{existing_component} — props: {prop_list}"},
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
2. **Apply shadcn style classes** — If `SHADCN_STYLE` detected, use style-correct class names:
   - Luma: `rounded-4xl` buttons/cards, `shadow-md` + `ring-1 ring-foreground/5`, `gap-6 py-6`
   - Nova: compact `px-2 py-1`, reduced margins, tight spacing
   - Lyra: `rounded-none`, sharp edges, monospace-friendly
   - Mira: ultra-dense, minimal padding
3. **Match naming conventions** — Follow project's component naming patterns
4. **Add TypeScript types** — Full type safety with Zod validation for any data props
5. **Include tests** — MSW handlers for API-backed components, render tests for static
6. **Responsive** — Mobile-first with breakpoints matching project's system

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

**Skip condition:** If the project has no json-render dependency or catalog, inform the user and skip catalog registration. The component from Stage 3 is still fully usable standalone.

### Stage 4b: Self-Healing Verification (if storybook-mcp available)

After generating the component, verify it with Storybook MCP:

```python
# 1. Write CSF3 story for the new component
Write("src/components/{Name}/{Name}.stories.tsx", story_code)

# 2. Run tests via MCP (component + a11y)
results = run-story-tests(
    stories=[{ "storyId": "{name}--default" }],
    a11y=True
)

# 3. Handle failures — self-heal up to 3 attempts
if not results.all_passed:
    for failure in results.failures:
        # Read violation details, fix the component
        Edit("src/components/{Name}/{Name}.tsx", fix)
    # Re-run failing tests
    results = run-story-tests(stories=[...], a11y=True)

# 4. Preview — embed live story in chat for user confirmation
previews = preview-stories(stories=[
    { "absoluteStoryPath": "src/components/{Name}/{Name}.stories.tsx",
      "exportName": "Default" }
])
# Include preview URLs in response for visual confirmation
```

**Skip condition:** If storybook-mcp is not available, skip verification. The component is still usable — just not auto-verified.

## Graceful Degradation

| stitch | 21st-dev-magic | storybook-mcp | Behavior |
|--------|----------------|---------------|----------|
| Available | Available | Available | Full pipeline: extract + Storybook-first match + adapt + render + self-heal verify |
| Available | Available | Unavailable | Extract + 21st.dev match + adapt + render (no verification) |
| Available | Unavailable | Available | Extract + Storybook match + adapt + verify |
| Unavailable | Available | Available | Description-based search + Storybook check + adapt + verify |
| Unavailable | Unavailable | Available | Filesystem search + Storybook verify only |
| Unavailable | Unavailable | Unavailable | Manual analysis + generate from scratch (still works) |

The skill ALWAYS produces output regardless of MCP availability. Storybook MCP adds component reuse (Stage 2) and self-healing verification (Stage 4b) — skipping them still yields a working component.

## Anti-Patterns

- **NEVER** output components with hardcoded colors — use design tokens
- **NEVER** skip TypeScript types — all props must be typed
- **NEVER** generate without checking existing project patterns first
- **NEVER** ignore the project's existing component library structure

## Related Skills

- `storybook-mcp-integration` — Storybook MCP tools: component discovery, testing, previews
- `component-search` — Search 21st.dev registry standalone
- `design-context-extract` — Extract design DNA from screenshots
- `design-system-tokens` — Token architecture and management
- `storybook-testing` — CSF3 patterns, Vitest integration, Chromatic TurboSnap
- `json-render-catalog` — Catalog definition, Zod schemas, defineCatalog patterns
- `multi-surface-render` — Render catalog entries to PDF, email, video, MCP
