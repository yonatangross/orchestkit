---
title: CLS Prevention
impact: CRITICAL
impactDescription: "Cumulative Layout Shift causes content jumping that frustrates users and hurts search rankings"
tags: cls, layout-shift, dimensions, aspect-ratio, font-display, skeleton
---

# CLS Prevention

Prevent Cumulative Layout Shift for the 2026 threshold of <= 0.08.

## Reserve Space for Dynamic Content

```css
/* Reserve space for images */
.image-container {
  aspect-ratio: 16 / 9;
  width: 100%;
}

/* Reserve space for ads */
.ad-slot {
  min-height: 250px;
}
```

## Explicit Dimensions

```tsx
// Always set width and height
<img src="/photo.jpg" width={800} height={600} alt="Photo" />

// Next.js Image handles this automatically
<Image src="/photo.jpg" width={800} height={600} alt="Photo" />

// For responsive images
<Image src="/photo.jpg" fill sizes="(max-width: 768px) 100vw, 50vw" />
```

## Avoid Layout-Shifting Fonts

```css
/* Use font-display: optional for non-critical fonts */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: optional;
}

/* Or use size-adjust for fallback */
@font-face {
  font-family: 'Fallback';
  src: local('Arial');
  size-adjust: 105%;
  ascent-override: 95%;
}
```

## Animations That Don't Cause Layout Shift

```css
/* BAD: Changes layout properties */
.expanding {
  height: 0;
  transition: height 0.3s;
}
.expanding.open {
  height: 200px; /* Causes layout shift */
}

/* GOOD: Use transform */
.expanding {
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.3s;
}
.expanding.open {
  transform: scaleY(1);
}
```

**Incorrect — Image without dimensions causes layout shift:**
```tsx
<img src="/photo.jpg" alt="Photo" />
```

**Correct — Explicit dimensions reserve space:**
```tsx
<img src="/photo.jpg" width={800} height={600} alt="Photo" />
```

## Key Rules

1. **Always** set width/height on images
2. **Use** `aspect-ratio` for responsive containers
3. **Use** `font-display: optional` for non-critical fonts
4. **Never** animate layout properties (width, height, top, left)
5. **Use** `transform` and `opacity` for animations
6. **Reserve** space for ads, embeds, and dynamic content
7. Target **<= 0.08** for 2026 thresholds
