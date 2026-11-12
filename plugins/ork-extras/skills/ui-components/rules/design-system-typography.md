---
title: Apply consistent typography scale with semantic size roles for readable hierarchies
impact: MEDIUM
impactDescription: "Inconsistent typography breaks visual hierarchy and reduces scannability"
tags: typography, font-size, font-weight, line-height, tailwind
---

## Typography Scale

**Incorrect -- arbitrary font sizes:**
```tsx
// WRONG: Random sizes with no hierarchy
<h1 style={{ fontSize: '27px', fontWeight: 400 }}>Title</h1>
<p style={{ fontSize: '15px', lineHeight: '1.3' }}>Body</p>
<span style={{ fontSize: '11px' }}>Caption</span>

// WRONG: Mixing Tailwind and arbitrary values
<h1 className="text-[27px] font-normal leading-[1.3]">Title</h1>
```

**Correct -- semantic typography scale:**

### Size Scale

| Token | Size | Tailwind | Semantic Role |
|-------|------|----------|---------------|
| `caption` | 12px | `text-xs` | Captions, timestamps, helper text |
| `secondary` | 14px | `text-sm` | Secondary text, labels, metadata |
| `body` | 16px | `text-base` | Body copy, primary content |
| `large` | 18px | `text-lg` | Large body, lead paragraphs |
| `subheading` | 20px | `text-xl` | Section subheadings |
| `heading` | 24px | `text-2xl` | Card/panel headings |
| `page-title` | 30px | `text-3xl` | Page titles, hero headings |

### Weight Pairing Guide

| Weight | Tailwind | Use With |
|--------|----------|----------|
| Normal (400) | `font-normal` | Body text, paragraphs, descriptions |
| Medium (500) | `font-medium` | Labels, nav items, subtle emphasis |
| Semibold (600) | `font-semibold` | Headings, card titles, table headers |
| Bold (700) | `font-bold` | Primary emphasis, key metrics, CTAs |

### Line Height Rules

| Context | Tailwind | Ratio | When |
|---------|----------|-------|------|
| Headings | `leading-tight` | 1.25 | Short, large text (h1-h3) |
| Body | `leading-normal` | 1.5 | Standard paragraphs, lists |
| Long-form | `leading-relaxed` | 1.625 | Articles, documentation, dense content |

### Correct Usage

```tsx
// Page with consistent typography hierarchy
<main>
  <h1 className="text-3xl font-semibold leading-tight">
    Page Title
  </h1>
  <p className="text-lg font-normal leading-normal text-muted-foreground">
    Lead paragraph with larger body text.
  </p>

  <section>
    <h2 className="text-2xl font-semibold leading-tight">Section Heading</h2>
    <p className="text-base font-normal leading-normal">
      Standard body text for primary content.
    </p>
    <span className="text-sm font-medium text-muted-foreground">
      Label or metadata
    </span>
    <p className="text-xs text-muted-foreground">
      Caption or timestamp
    </p>
  </section>
</main>
```

### Rules

- Never use arbitrary font sizes -- always use the scale tokens
- Pair weights intentionally: body=normal, labels=medium, headings=semibold
- Use `leading-tight` for headings, `leading-normal` for body, `leading-relaxed` for long-form
- Maximum 2 font families per project (1 sans-serif + 1 monospace is ideal)
- Responsive scaling: `text-2xl md:text-3xl lg:text-4xl` for page titles

Key decisions:
- Base size: 16px (`text-base`) -- browser default, accessible
- Scale ratio: ~1.25 (Major Third) for harmonious progression
- Weight hierarchy: normal < medium < semibold < bold (never skip 2+ levels)
- Line height decreases as font size increases
