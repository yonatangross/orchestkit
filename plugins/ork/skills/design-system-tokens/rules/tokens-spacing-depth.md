---
title: "Define elevation and spacing as explicit token scales"
impact: HIGH
impactDescription: "Magic numbers in spacing and ad-hoc box-shadow values produce inconsistent visual rhythm and impossible-to-theme depth systems"
tags: [spacing, elevation, shadow, depth, tokens, visual-rhythm]
---

## Spacing and Depth as Tokens

Every spacing value and shadow must come from a named token — no magic numbers. Spacing tokens create visual rhythm through proximity grouping; elevation tokens communicate layer hierarchy through a consistent light-source model.

**Incorrect:**
```css
.card { padding: 12px 20px; box-shadow: 0 3px 8px rgba(0,0,0,0.12); }
.modal { box-shadow: 0 12px 20px rgba(0,0,0,0.18); }
.dropdown { margin-top: 6px; }
```

**Correct — token definitions:**
```json
{
  "spacing": {
    "$type": "dimension",
    "xs":  { "$value": "4px" },
    "sm":  { "$value": "8px" },
    "md":  { "$value": "16px" },
    "lg":  { "$value": "24px" },
    "xl":  { "$value": "32px" },
    "2xl": { "$value": "48px" },
    "3xl": { "$value": "64px" }
  },
  "elevation": {
    "$type": "shadow",
    "0": { "$value": "none" },
    "1": { "$value": "0 1px 2px rgba(0,0,0,0.05)" },
    "2": { "$value": "0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)" },
    "3": { "$value": "0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05)" },
    "4": { "$value": "0 20px 25px rgba(0,0,0,0.15), 0 8px 10px rgba(0,0,0,0.07)" }
  }
}
```

**Correct — CSS custom properties:**
```css
:root {
  --space-xs: 4px;   --space-sm: 8px;   --space-md: 16px;
  --space-lg: 24px;  --space-xl: 32px;  --space-2xl: 48px;

  --elevation-0: none;
  --elevation-1: 0 1px 2px rgba(0,0,0,0.05);
  --elevation-2: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --elevation-3: 0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05);
  --elevation-4: 0 20px 25px rgba(0,0,0,0.15), 0 8px 10px rgba(0,0,0,0.07);
}

/* Component tokens reference the scale */
.card    { padding: var(--space-md); box-shadow: var(--elevation-1); }
.popover { box-shadow: var(--elevation-2); }
.modal   { box-shadow: var(--elevation-3); }
.toast   { box-shadow: var(--elevation-4); }
```

**Key rules:**

Spacing:
- Base unit is 4px; the scale is geometric: 4, 8, 16, 24, 32, 48, 64
- Start with generous whitespace, then reduce — under-spaced UIs feel cramped and hard to scan
- Use proximity to signal grouping: related elements share a closer spacing step
- Sibling flow spacing via `* + * { margin-block-start: var(--space-md) }` (owl selector)

Elevation (5 levels, top-left light source):
- Level 0 — flat, inline: no shadow, use background color change to separate regions
- Level 1 — raised surfaces (cards, list items): single, subtle contact shadow
- Level 2 — overlays floating above content (dropdowns, popovers): contact + ambient shadows
- Level 3 — modal dialogs: pronounced contact shadow, heavier ambient shadow
- Level 4 — highest-priority floating elements (toasts, command palette): maximum shadow
- Every shadow uses two parts: a tight dark contact shadow + a large soft ambient shadow

Flat depth (no shadows needed):
- Layer backgrounds: white card on `--color-bg-secondary` reads as elevated without a shadow
- Overlap elements deliberately to imply z-order
- Accent borders (left or top, 2px, brand color) add depth cues without full borders

Reference: [references/token-naming-conventions.md](../references/token-naming-conventions.md)
