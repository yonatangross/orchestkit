---
title: Sustainability UX patterns for reducing digital carbon footprint
impact: MEDIUM
impactDescription: "Unnecessary assets, over-fetching, and heavy animations waste energy and bandwidth — page weight directly impacts carbon emissions"
tags: sustainability, carbon-footprint, page-weight, lazy-loading, avif, webp, dark-mode, green-ux
---

# Sustainability UX

2026 digital sustainability patterns — reduce carbon footprint through efficient resource usage, optimized assets, and intentional UX.

## Avoid Heavy Animations When Not Needed

**Incorrect — auto-playing decorative video wastes bandwidth and energy:**
```html
<video autoplay loop muted playsinline>
  <source src="/hero-bg.mp4" type="video/mp4" />
</video>
```

**Correct — use CSS animation or static image, offer video opt-in:**
```html
<!-- Static hero with optional video -->
<picture>
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="Hero" loading="eager" />
</picture>
<button onclick="loadHeroVideo()">Play video</button>
```

## Prevent Over-Fetching

**Incorrect — fetching entire dataset for a paginated view:**
```typescript
// Loads ALL 10,000 records on mount
const { data } = useQuery({
  queryKey: ['products'],
  queryFn: () => fetch('/api/products').then(r => r.json()),
});
const page = data?.slice(offset, offset + 20);
```

**Correct — cursor-based pagination fetches only what is needed:**
```typescript
const { data, fetchNextPage } = useInfiniteQuery({
  queryKey: ['products'],
  queryFn: ({ pageParam }) =>
    fetch(`/api/products?cursor=${pageParam}&limit=20`).then(r => r.json()),
  getNextPageParam: (last) => last.nextCursor,
  initialPageParam: '',
});
```

## Serve Optimized Image Formats

**Incorrect — serving unoptimized PNG/JPEG:**
```html
<img src="/photo.png" alt="Product" width="800" height="600" />
```

**Correct — AVIF/WebP with fallback, sized appropriately:**
```html
<picture>
  <source srcset="/photo.avif" type="image/avif" />
  <source srcset="/photo.webp" type="image/webp" />
  <img src="/photo.jpg" alt="Product" width="800" height="600"
       loading="lazy" decoding="async" />
</picture>
```

## Lazy Load Below-Fold Content

**Incorrect — loading all images eagerly:**
```tsx
function Gallery({ images }: { images: string[] }) {
  return images.map(src => <img src={src} alt="" />);
}
```

**Correct — lazy load below-fold, eager only for above-fold:**
```tsx
function Gallery({ images }: { images: string[] }) {
  return images.map((src, i) => (
    <img
      src={src}
      alt=""
      loading={i < 2 ? 'eager' : 'lazy'}
      decoding="async"
    />
  ));
}
```

## Dark Mode Reduces OLED Power

Offer dark mode to reduce power consumption on OLED displays (up to 60% less power for dark UI).

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
    --text: #e0e0e0;
  }
}
```

## Enforce Page Weight Budget

Target < 1MB total page weight (HTML + CSS + JS + images + fonts). Set up CI enforcement:

```javascript
// lighthouse-ci config or bundlesize
const budgets = [
  { resourceType: 'total', budget: 1000 }, // 1MB total
  { resourceType: 'script', budget: 300 },  // 300KB JS
  { resourceType: 'image', budget: 500 },   // 500KB images
  { resourceType: 'font', budget: 100 },    // 100KB fonts
];
```

## Key Rules

1. **Avoid** auto-playing videos and heavy animations for decoration
2. **Use** cursor-based pagination — never fetch entire datasets
3. **Serve** AVIF with WebP fallback — 30-50% smaller than JPEG/PNG
4. **Lazy load** all below-fold images and components
5. **Offer** dark mode — reduces OLED power by up to 60%
6. **Enforce** < 1MB page weight budget in CI
7. **Measure** page weight on every PR — prevent creep
