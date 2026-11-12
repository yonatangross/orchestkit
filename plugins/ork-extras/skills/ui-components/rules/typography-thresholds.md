---
title: Apply numeric typography thresholds for line length, line height, and font scale
impact: HIGH
impactDescription: "Correct typographic thresholds directly reduce reading fatigue and make UI tasks feel cognitively simpler"
tags: typography, line-length, line-height, font-size, font-weight, rem, type-scale, accessibility
---

## Typography Thresholds

**Incorrect — unconstrained text and cascading em bugs:**
```tsx
// WRONG: Unbounded paragraph width causes too-long lines (eye fatigue)
<p className="w-full text-base">Long body copy...</p>

// WRONG: em units for font-size cause cascading multiplication
<div style={{ fontSize: '1.2em' }}>
  <p style={{ fontSize: '1.2em' }}>  {/* Actually 1.44× root — bug! */}
    Nested text
  </p>
</div>

// WRONG: Line height too tight for body text
<p className="leading-tight text-base">Body copy with 1.25 line height</p>

// WRONG: Font weight 500 for "emphasis" — too subtle
<strong className="font-medium">Important</strong>

// WRONG: Inline links without underline (accessibility failure)
<a className="text-primary no-underline">Click here</a>
```

**Correct — constrained width, rem scale, proper line height:**
```tsx
// RIGHT: Max-width on paragraph containers (50-75ch ideal, 65ch default)
<p className="max-w-prose text-base leading-relaxed">
  Body copy with constrained line length and proper line height.
</p>

// RIGHT: Heading gets tighter line height
<h1 className="text-3xl font-bold leading-tight">Page Heading</h1>
<h2 className="text-2xl font-semibold leading-snug">Section Title</h2>

// RIGHT: Inline links always underlined
<a className="text-primary underline underline-offset-2 hover:text-primary/80">
  Inline link
</a>
```

### Type Scale (Tailwind — modular, 1.25 Major Third ratio)

```css
/* In your global CSS or @theme block */
@theme {
  --font-size-xs:   0.64rem;   /* ~10px */
  --font-size-sm:   0.8rem;    /* ~13px */
  --font-size-base: 1rem;      /* 16px  */
  --font-size-lg:   1.25rem;   /* ~20px */
  --font-size-xl:   1.563rem;  /* ~25px */
  --font-size-2xl:  1.953rem;  /* ~31px */
  --font-size-3xl:  2.441rem;  /* ~39px */
}
```

### Threshold Reference

| Property | Threshold | Notes |
|----------|-----------|-------|
| Line length — print | 50–75 ch | Use `max-w-prose` (65ch) |
| Line length — screen | 60–100 ch | UI panels can go wider |
| Line height — body | 1.4–1.6× | `leading-relaxed` = 1.625 |
| Line height — headings | 1.2–1.3× | `leading-tight` = 1.25 |
| Line height — minimum | 1.2× | Never below this |
| Font weight — body | 400 (regular) | `font-normal` |
| Font weight — emphasis | 600+ (semibold) | `font-semibold` minimum |
| Font weight — headings | 700 (bold) | `font-bold` |
| Font size units | rem only | Never em for font-size |

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Font size units | rem only — em cascades multiplicatively |
| Line length | `max-w-prose` (65ch) on all paragraph containers |
| Link underlines | Always underlined for inline links — no exceptions |
| Type scale | Derive all sizes from a modular scale ratio (1.25 or 1.333) |
| UI font | Sans-serif for UI chrome; proportional serif optional for long-form |
