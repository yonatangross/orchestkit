---
title: Enforce maximum content per slide type to prevent overflow
category: layout
impact: HIGH
impactDescription: "Too much content on a slide causes overflow. Split into multiple slides instead of scrolling."
tags: content, density, slides, overflow, presentation
---

# Content Density Rules

To guarantee viewport fitting, enforce these limits per slide type.

## Maximum Content Per Slide

| Slide Type | Maximum Content |
|------------|-----------------|
| Title slide | 1 heading + 1 subtitle + optional tagline |
| Content slide | 1 heading + 4-6 bullet points OR 1 heading + 2 paragraphs |
| Feature grid | 1 heading + 6 cards maximum (2x3 or 3x2 grid) |
| Code slide | 1 heading + 8-10 lines of code maximum |
| Quote slide | 1 quote (max 3 lines) + attribution |
| Image slide | 1 heading + 1 image (max 60vh height) |

## Rules

1. **If content exceeds these limits, split into multiple slides.** Never scroll.
2. Each bullet point should be 1-2 lines maximum.
3. Code slides should show focused snippets, not full files.
4. Feature grids use `auto-fit` with `minmax()` -- stack vertically on narrow screens.
5. Images always have `max-height` constraints using `min(50vh, 400px)` or similar.

## When to Split

- More than 6 bullet points -> split into "Part 1" / "Part 2"
- Code longer than 10 lines -> split by logical section or use a "highlights" approach
- More than 6 feature cards -> use multiple grid slides
- A quote longer than 3 lines -> shorten or attribute on a separate line
