---
title: "Figma Auto Layout to CSS Flexbox/Grid"
impact: "HIGH"
impactDescription: "Incorrect Auto Layout mapping produces layouts that break at different viewport sizes, with wrong spacing, alignment, or sizing behavior."
tags: [figma-auto-layout, flexbox, css-grid, responsive-layout, gap, padding]
---

## Figma Auto Layout to CSS Flexbox/Grid

Figma Auto Layout maps directly to CSS Flexbox. Every Auto Layout property has a 1:1 CSS equivalent. Use Grid only when the design requires 2D placement that Auto Layout cannot express.

**Incorrect:**
```css
/* Using margin instead of gap, wrong sizing */
.card-list {
  display: flex;
}
.card-list > * {
  margin-right: 16px;    /* Use gap instead */
  width: 33.33%;         /* Ignores Figma's Fill/Hug/Fixed */
}
.card-list > *:last-child {
  margin-right: 0;       /* Gap handles this automatically */
}
```

**Correct:**
```css
/* Direct mapping from Auto Layout properties */
.card-list {
  display: flex;
  flex-direction: row;          /* Direction: Horizontal */
  gap: 16px;                    /* Item spacing: 16 */
  padding: 24px;                /* Padding: 24 (all sides) */
  align-items: flex-start;      /* Align items: Top */
  flex-wrap: wrap;              /* Wrap enabled */
}
.card-list > .card {
  flex: 1 1 0%;                /* Sizing: Fill container */
  min-width: 280px;            /* Min width constraint */
}
```

**Complete mapping table:**
```
Auto Layout Property        → CSS Property
──────────────────────────────────────────────────────
Direction: Horizontal       → flex-direction: row
Direction: Vertical         → flex-direction: column
Gap (item spacing)          → gap: {value}px
Padding (uniform)           → padding: {value}px
Padding (per-side)          → padding: {top} {right} {bottom} {left}
Align items: Top/Left       → align-items: flex-start
Align items: Center         → align-items: center
Align items: Bottom/Right   → align-items: flex-end
Justify: Packed (start)     → justify-content: flex-start
Justify: Space between      → justify-content: space-between
Sizing: Fill container      → flex: 1 1 0%
Sizing: Hug contents        → width: fit-content  (or omit width)
Sizing: Fixed               → width: {value}px
Min/Max width               → min-width / max-width
Wrap                        → flex-wrap: wrap
Absolute position           → position: absolute + inset values
```

**When to use CSS Grid instead of Flexbox:**
```css
/* Grid: when Figma uses a grid layout component or 2D placement */
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  padding: 32px;
}
```

**Key rules:**
- Always use `gap` for spacing between items — never `margin` on children
- Map Fill container to `flex: 1 1 0%`, not percentage widths
- Map Hug contents to `width: fit-content` or omit explicit width
- Read padding values from Auto Layout panel, not by measuring edges
- Use Flexbox for 1D layouts (most Auto Layout frames), Grid for 2D
- Preserve min/max width constraints from Figma for responsive behavior
- Absolute-positioned children in Auto Layout map to `position: absolute` with inset

Reference: [CSS Flexbox Guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
