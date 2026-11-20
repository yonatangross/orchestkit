---
title: Use CSS Subgrid for automatic nested grid alignment instead of duplicating grid definitions
impact: HIGH
impactDescription: "Without subgrid, nested grid items cannot align with parent grid tracks — developers duplicate column/row definitions manually, causing fragile layouts that break when the parent grid changes"
tags: [subgrid, css-grid, layout, alignment, card-layout]
---

## CSS Subgrid

Use `grid-template-columns: subgrid` and `grid-template-rows: subgrid` to inherit parent grid tracks in nested elements. Baseline 2023+ (Chrome 117, Safari 16, Firefox 71).

**Incorrect — manually duplicating parent grid columns:**
```css
/* WRONG: Nested grid duplicates parent's column definition */
.parent-grid {
  display: grid;
  grid-template-columns: 200px 1fr 100px;
  gap: 1rem;
}

.child-card {
  display: grid;
  /* Fragile: must manually match parent columns */
  grid-template-columns: 200px 1fr 100px;
  grid-column: 1 / -1;
}

/* If parent columns change, every child must be updated */
```

**Correct — subgrid inherits parent tracks automatically:**
```css
.parent-grid {
  display: grid;
  grid-template-columns: 200px 1fr 100px;
  gap: 1rem;
}

.child-card {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  /* Automatically aligns to parent's 3-column track */
}
```

**Card layout with aligned sections (rows subgrid):**
```css
/* Cards with aligned titles, content, and actions */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  grid-auto-rows: auto;
  gap: 1.5rem;
}

.card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 3; /* title + content + actions */
}

.card-title   { align-self: start; }
.card-content { align-self: start; }
.card-actions { align-self: end; }
```

**Two-dimensional subgrid (rows + columns):**
```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
}

.dashboard-widget {
  display: grid;
  grid-template-columns: subgrid;
  grid-template-rows: subgrid;
  grid-column: span 2;
  grid-row: span 2;
}
```

**Key rules:**
- Use `subgrid` instead of duplicating parent grid track definitions
- `grid-row: span N` is required so the child occupies tracks to inherit
- Subgrid works for columns, rows, or both simultaneously
- Combine with `auto-fit`/`minmax()` on parent for responsive card grids
- Subgrid inherits the parent's `gap` — override with `gap` on the child if needed
- Baseline 2023+: Chrome 117+, Safari 16+, Firefox 71+, Edge 117+
