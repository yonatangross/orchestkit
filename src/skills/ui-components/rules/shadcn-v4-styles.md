---
title: "shadcn/ui v4 Style System — 6 Styles + Preset Codes"
impact: "HIGH"
impactDescription: "Using wrong class names for the project's shadcn style produces visually inconsistent components that don't match the design system"
tags: [shadcn, styles, v4, preset, luma, vega, nova, maia, lyra, mira]
---

## shadcn/ui v4 Style System

shadcn CLI v4 ships 6 visual styles that rewrite component class names — not just CSS variables. Each style defines its own radius, elevation, spacing, and visual weight. Detect the project's style from `components.json` and apply the correct classes.

**Incorrect — hardcoding classes without checking project style:**
```tsx
// Assumes rounded-md everywhere — wrong for Luma (rounded-4xl) or Lyra (rounded-none)
const Card = ({ children }: CardProps) => (
  <div className="rounded-lg border p-4 shadow-sm">
    {children}
  </div>
)
```

**Correct — reading project style and applying matching classes:**
```tsx
// 1. Detect style: Read components.json → "style" field
//    "radix-luma" | "radix-vega" | "base-nova" | etc.

// 2. Apply style-correct classes:
// Luma:  rounded-4xl, shadow-md + ring-1 ring-foreground/5, gap-6 py-6
// Vega:  rounded-lg, shadow-sm, gap-4 py-4 (balanced, general purpose)
// Nova:  rounded-md, no shadow, px-2 py-1 (compact dashboards)
// Maia:  rounded-xl, shadow-sm, gap-5 py-5 (soft, consumer)
// Lyra:  rounded-none, no shadow, gap-4 py-4 (sharp, editorial)
// Mira:  rounded-sm, no shadow, px-1 py-0.5 (ultra-dense)

const Card = ({ children }: CardProps) => (
  <div className="rounded-4xl border shadow-md ring-1 ring-foreground/5 p-6">
    {children}
  </div>
)
```

### Preset Codes

All style + theme + font + icon choices encode into a shareable 7-char preset code:

**Incorrect — using deprecated style names:**
```json
{
  "style": "new-york"
}
```

**Correct — using v4 style names and preset codes:**
```bash
# Initialize with preset (encodes all 10 design system params)
npx shadcn@latest init --preset b2D0xPaDb

# Preview changes before applying
npx shadcn@latest add button --diff
```

```json
{
  "style": "radix-luma"
}
```

### Style Detection Pattern

```typescript
import { readFileSync } from 'fs'

// Read components.json to detect active style
const config = JSON.parse(readFileSync('components.json', 'utf-8'))
const style = config.style // "radix-luma", "base-nova", etc.
const styleName = style.split('-').pop() // "luma", "nova", etc.
```

### Style Reference

| Style | Radius | Elevation | Spacing | Best For |
|-------|--------|-----------|---------|----------|
| Vega | `rounded-lg` | `shadow-sm` | Balanced | General purpose |
| Nova | `rounded-md` | None | Compact | Dense dashboards |
| Maia | `rounded-xl` | `shadow-sm` | Generous | Consumer apps |
| Lyra | `rounded-none` | None | Balanced | Editorial, dev tools |
| Mira | `rounded-sm` | None | Ultra-dense | Spreadsheets, data |
| Luma | `rounded-4xl` | `shadow-md` + ring | Breathable | Polished native-app |

Configure visually at [ui.shadcn.com/create](https://ui.shadcn.com/create). Old `"new-york"` and `"default"` are superseded by Vega.
