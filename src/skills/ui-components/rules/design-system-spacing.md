---
title: Use 8px grid spacing scale for consistent component and layout spacing
impact: MEDIUM
impactDescription: "Inconsistent spacing creates visual discord; 8px grid ensures mathematical harmony"
tags: spacing, 8px-grid, tailwind, layout, consistency
---

## 8px Grid Spacing System

**Incorrect -- arbitrary pixel values:**
```tsx
// WRONG: Random spacing with no system
<div style={{ padding: '13px', marginBottom: '7px', gap: '11px' }}>
  <h2 style={{ marginTop: '19px' }}>Title</h2>
  <p style={{ padding: '5px 9px' }}>Content</p>
</div>

// WRONG: Mixing spacing systems
<div className="p-3 mb-[7px] gap-[11px]">
```

**Correct -- 8px grid spacing scale:**

### Spacing Scale

| Token | Value | Tailwind | Use Case |
|-------|-------|----------|----------|
| `micro` | 4px | `p-1`, `gap-1` | Icon-to-label gaps, inline element spacing |
| `tight` | 8px | `p-2`, `gap-2` | Compact lists, tight form fields, badge padding |
| `compact` | 12px | `p-3`, `gap-3` | Card padding (small), button group gaps |
| `default` | 16px | `p-4`, `gap-4` | Standard padding, form field gaps, paragraph spacing |
| `comfortable` | 24px | `p-6`, `gap-6` | Card padding (large), section gaps within a panel |
| `loose` | 32px | `p-8`, `gap-8` | Page section separation, modal padding |
| `section` | 48px | `p-12`, `gap-12` | Major page sections, hero spacing |

### Component Spacing Guide

```tsx
// Card with consistent spacing
<Card className="p-6 space-y-4">          {/* comfortable padding, default internal gaps */}
  <CardHeader className="space-y-2">       {/* tight gaps between title/description */}
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">      {/* default gaps between content blocks */}
    <p>Body text</p>
  </CardContent>
  <CardFooter className="gap-2">           {/* tight gaps between action buttons */}
    <Button variant="outline">Cancel</Button>
    <Button>Submit</Button>
  </CardFooter>
</Card>
```

### Layout Spacing

```tsx
// Page layout with section spacing
<main className="space-y-12 px-8 py-12">   {/* section gaps, loose horizontal padding */}
  <section className="space-y-6">           {/* comfortable gaps within section */}
    <h1 className="mb-4">Page Title</h1>    {/* default gap below heading */}
    <div className="grid gap-6">            {/* comfortable grid gaps */}
      {items.map(item => <Card key={item.id} />)}
    </div>
  </section>
</main>
```

### Rules

- All spacing values must be multiples of 4px
- Use Tailwind spacing utilities, never arbitrary `px` values
- Nest spacing: outer containers use larger values, inner elements use smaller
- Consistent gap hierarchy: section (48px) > panel (24-32px) > content (16px) > elements (8px) > micro (4px)

Key decisions:
- Base unit: 8px (with 4px half-step for micro adjustments)
- Never use odd pixel values or non-grid-aligned spacing
- Prefer `gap` and `space-y`/`space-x` over individual margins
- Scale spacing with viewport using responsive utilities (`gap-4 md:gap-6 lg:gap-8`)
