---
title: "Cognitive Load Thresholds"
impact: "HIGH"
impactDescription: "Exceeding working memory limits (Miller's Law) and decision time (Hick's Law) causes errors, abandonment, and frustration — specific numeric thresholds make these principles enforceable"
tags: [cognitive-load, millers-law, hicks-law, doherty-threshold, working-memory, decision-paralysis, optimistic-updates]
---

## Cognitive Load Thresholds

Three cognitive science laws with specific, countable thresholds. Apply these as checks during component design — if any count exceeds the limit, restructure before shipping.

### Miller's Law: 4±1 Working Memory Chunks (max 7)

**Incorrect:**
```tsx
// 11 top-level nav items — exceeds 7, forces chunking in working memory
<nav>
  <a href="/home">Home</a>
  <a href="/products">Products</a>
  <a href="/pricing">Pricing</a>
  <a href="/blog">Blog</a>
  <a href="/docs">Docs</a>
  <a href="/changelog">Changelog</a>
  <a href="/status">Status</a>
  <a href="/community">Community</a>
  <a href="/about">About</a>
  <a href="/careers">Careers</a>
  <a href="/contact">Contact</a>
</nav>
```

**Correct:**
```tsx
// 5 top-level items + grouped overflow — stays within 7, categories aid recall
<nav>
  <a href="/home">Home</a>
  <a href="/products">Products</a>
  <a href="/pricing">Pricing</a>
  <a href="/docs">Docs</a>
  <DropdownMenu label="Company">
    <a href="/blog">Blog</a>
    <a href="/about">About</a>
    <a href="/careers">Careers</a>
    <a href="/contact">Contact</a>
  </DropdownMenu>
</nav>
```

**Thresholds to enforce:**

| Element | Max | Action if exceeded |
|---------|-----|-------------------|
| Top-level nav items | 7 | Group into categories |
| Dropdown options (no search) | 7 | Add search/filter input |
| Tab bar items | 5 | Add "More" overflow or switch pattern |
| Dashboard widgets per view | 7 | Add scroll sections or collapse groups |

### Hick's Law: Decision Time Grows Logarithmically with Options

**Incorrect:**
```tsx
// 4 CTAs — decision paralysis, diluted primary action
<div className="flex gap-3">
  <Button variant="primary">Save</Button>
  <Button variant="secondary">Save as Draft</Button>
  <Button variant="secondary">Export PDF</Button>
  <Button variant="outline">Preview</Button>
</div>
```

**Correct:**
```tsx
// 1 primary + 1 secondary + overflow for rare actions
<div className="flex gap-3">
  <Button variant="primary">Save</Button>
  <Button variant="secondary">Save as Draft</Button>
  <DropdownMenu label="More actions">
    <DropdownItem>Export PDF</DropdownItem>
    <DropdownItem>Preview</DropdownItem>
  </DropdownMenu>
</div>
```

**Rules:** 1 primary CTA per view maximum. 2 secondary CTAs maximum. Use overflow menus for the rest.

### Doherty Threshold: Every Interaction Must Respond Within 400ms

**Incorrect:**
```tsx
// No feedback during save — blank wait of unknown duration
async function handleSave() {
  await api.save(data) // Could take 2s — user gets nothing
  toast('Saved!')
}
```

**Correct:**
```tsx
// Optimistic update at 0ms, skeleton at 200ms, reconcile after API
const [optimisticItems, addOptimistic] = useOptimistic(
  items,
  (state, newItem) => [...state, { ...newItem, pending: true }]
)

async function handleSave(newItem: Item) {
  startTransition(() => {
    addOptimistic(newItem) // Instant — user sees result immediately
  })
  await api.save(newItem) // Reconcile in background
}
```

**Thresholds:**

| Delay | Required feedback |
|-------|------------------|
| 0–400ms | No indicator needed (perceived as instant) |
| 400ms–1s | Loading indicator (spinner or inline) |
| > 1s | Progress indicator + skeleton if layout changes |
| > 2s | Determinate progress bar if measurable |

**Key rules:**
- Optimistic updates: reflect expected result at 0ms, reconcile after API responds
- Skeleton: display within 200ms of navigation trigger — never show blank screen first
- Use `determinate` progress (bar with %) when total is known; `indeterminate` (spinner) only as fallback
- Never fire-and-forget mutations without visual acknowledgment

References:
- https://www.nngroup.com/articles/response-times-3-important-limits/ (Doherty Threshold)
- https://en.wikipedia.org/wiki/Hick%27s_law
- https://en.wikipedia.org/wiki/The_Magical_Number_Seven,_Plus_or_Minus_Two (Miller's Law)
