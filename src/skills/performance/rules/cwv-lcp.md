---
title: LCP Optimization
impact: CRITICAL
impactDescription: "Largest Contentful Paint directly affects search rankings and user perception of page speed"
tags: lcp, largest-contentful-paint, hero, preload, priority, ssr, ttfb
---

# LCP Optimization

Optimize Largest Contentful Paint for the 2026 threshold of <= 2.0s.

## Identify LCP Element

```javascript
new PerformanceObserver((entryList) => {
  const entries = entryList.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log('LCP element:', lastEntry.element);
  console.log('LCP time:', lastEntry.startTime);
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

## Optimize LCP Images

```tsx
// Priority loading for hero image
<img
  src="/hero.webp"
  alt="Hero"
  fetchpriority="high"
  loading="eager"
  decoding="async"
/>

// Next.js Image with priority
import Image from 'next/image';

<Image
  src="/hero.webp"
  alt="Hero"
  priority
  sizes="100vw"
  quality={85}
/>
```

## Preload Critical Resources

```html
<!-- Preload LCP image -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />

<!-- Preload critical font -->
<link rel="preload" as="font" href="/fonts/inter.woff2" type="font/woff2" crossorigin />

<!-- Preconnect to critical origins -->
<link rel="preconnect" href="https://api.example.com" />
<link rel="dns-prefetch" href="https://analytics.example.com" />
```

## Server-Side Rendering

```typescript
// Next.js - ensure SSR for LCP content
export default async function Page() {
  const data = await fetchCriticalData();
  return <HeroSection data={data} />; // Rendered on server
}

// BAD: LCP content loaded client-side
const [data, setData] = useState(null);
useEffect(() => { fetchData().then(setData); }, []);
```

**Incorrect — Lazy-loading LCP image delays paint:**
```tsx
<img src="/hero.webp" alt="Hero" loading="lazy" />
```

**Correct — Priority loading for LCP image:**
```tsx
<img
  src="/hero.webp"
  alt="Hero"
  fetchpriority="high"
  loading="eager"
  decoding="async"
/>
```

## Key Rules

1. **Never** lazy-load the LCP image
2. **Always** use `fetchpriority="high"` on LCP images
3. **Always** server-render LCP content
4. **Preload** critical resources in `<head>`
5. **Preconnect** to third-party origins used for LCP
6. Target **<= 2.0s** for 2026 thresholds
