---
name: core-web-vitals
description: Core Web Vitals optimization for LCP, INP, CLS with 2026 thresholds, performance budgets, and RUM. Use when improving page performance, diagnosing CWV regressions, or setting performance budgets.
tags: [performance, core-web-vitals, lcp, inp, cls, lighthouse, rum, web-vitals]
context: fork
agent: frontend-ui-developer
version: 1.0.0
allowed-tools: [Read, Write, Grep, Glob, Bash]
author: OrchestKit
user-invocable: false
---

# Core Web Vitals

Performance optimization for Google's Core Web Vitals - LCP, INP, CLS with 2026 thresholds.

## Core Web Vitals Thresholds (2026)

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |

> **Note**: INP replaced FID (First Input Delay) in March 2024 as the official responsiveness metric.

### Upcoming 2026 Stricter Thresholds (Q4 2025 rollout)

| Metric | Current Good | 2026 Good |
|--------|--------------|-----------|
| LCP | ≤ 2.5s | ≤ 2.0s |
| INP | ≤ 200ms | ≤ 150ms |
| CLS | ≤ 0.1 | ≤ 0.08 |

Plan for stricter thresholds now to maintain search rankings.

## LCP Optimization

### 1. Identify LCP Element

```javascript
// Find LCP element in DevTools
new PerformanceObserver((entryList) => {
  const entries = entryList.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log('LCP element:', lastEntry.element);
  console.log('LCP time:', lastEntry.startTime);
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

### 2. Optimize LCP Images

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

### 3. Preload Critical Resources

```html
<!-- Preload LCP image -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />

<!-- Preload critical font -->
<link rel="preload" as="font" href="/fonts/inter.woff2" type="font/woff2" crossorigin />

<!-- Preconnect to critical origins -->
<link rel="preconnect" href="https://api.example.com" />
<link rel="dns-prefetch" href="https://analytics.example.com" />
```

### 4. Server-Side Rendering

```typescript
// Next.js - ensure SSR for LCP content
export default async function Page() {
  const data = await fetchCriticalData();
  return <HeroSection data={data} />; // Rendered on server
}

// Avoid client-only LCP content
// BAD: LCP content loaded client-side
const [data, setData] = useState(null);
useEffect(() => { fetchData().then(setData); }, []);
```

## INP Optimization

### 1. Break Up Long Tasks

```typescript
// BAD: Long synchronous task (blocks main thread)
function processLargeArray(items: Item[]) {
  items.forEach(processItem); // Blocks for entire duration
}

// GOOD: Yield to main thread
async function processLargeArray(items: Item[]) {
  for (const item of items) {
    processItem(item);
    // Yield every 50ms to allow paint
    if (performance.now() % 50 < 1) {
      await scheduler.yield?.() ?? new Promise(r => setTimeout(r, 0));
    }
  }
}
```

### 2. Use Transitions for Non-Urgent Updates

```typescript
import { useTransition, useDeferredValue } from 'react';

function SearchResults() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Urgent: Update input immediately
    setQuery(e.target.value);

    // Non-urgent: Defer expensive filter
    startTransition(() => {
      setFilteredResults(filterResults(e.target.value));
    });
  };

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}
      <ResultsList results={filteredResults} />
    </>
  );
}
```

### 3. Optimize Event Handlers

```typescript
// BAD: Heavy computation in click handler
<button onClick={() => {
  const result = heavyComputation(); // Blocks paint
  setResult(result);
}}>Calculate</button>

// GOOD: Defer heavy work
<button onClick={() => {
  setLoading(true);
  requestIdleCallback(() => {
    const result = heavyComputation();
    setResult(result);
    setLoading(false);
  });
}}>Calculate</button>
```

## CLS Optimization

### 1. Reserve Space for Dynamic Content

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

### 2. Explicit Dimensions

```tsx
// Always set width and height
<img src="/photo.jpg" width={800} height={600} alt="Photo" />

// Next.js Image handles this automatically
<Image src="/photo.jpg" width={800} height={600} alt="Photo" />

// For responsive images
<Image src="/photo.jpg" fill sizes="(max-width: 768px) 100vw, 50vw" />
```

### 3. Avoid Layout-Shifting Fonts

```css
/* Use font-display: optional for non-critical fonts */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: optional; /* Prevents flash of unstyled text */
}

/* Or use size-adjust for fallback */
@font-face {
  font-family: 'Fallback';
  src: local('Arial');
  size-adjust: 105%;
  ascent-override: 95%;
}
```

### 4. Animations That Don't Cause Layout Shift

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

## Real User Monitoring (RUM)

```typescript
// web-vitals library
import { onLCP, onINP, onCLS } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  fetch('/api/vitals', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
    }),
    keepalive: true, // Send even if page unloads
  });
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

## Performance Budgets

```json
// lighthouse-budget.json
{
  "resourceSizes": [
    { "resourceType": "script", "budget": 150 },
    { "resourceType": "image", "budget": 300 },
    { "resourceType": "total", "budget": 500 }
  ],
  "timings": [
    { "metric": "largest-contentful-paint", "budget": 2500 },
    { "metric": "cumulative-layout-shift", "budget": 0.1 }
  ]
}
```

```typescript
// webpack-budget.config.js
module.exports = {
  performance: {
    maxAssetSize: 150000, // 150kb
    maxEntrypointSize: 250000, // 250kb
    hints: 'error', // Fail build if exceeded
  },
};
```

## Debugging Tools

| Tool | Use Case |
|------|----------|
| Chrome DevTools Performance | Identify long tasks, layout shifts |
| Lighthouse | Lab data, recommendations |
| PageSpeed Insights | Field data + lab data |
| Web Vitals Extension | Real-time vitals overlay |
| Chrome UX Report | Real user data by origin |

## Quick Reference

```typescript
// ✅ LCP: Preload and prioritize hero image
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />
<Image src="/hero.webp" priority fill sizes="100vw" />

// ✅ INP: Use transitions for expensive updates
const [isPending, startTransition] = useTransition();
const deferredQuery = useDeferredValue(query);

// ✅ CLS: Always set dimensions, reserve space
<img src="/photo.jpg" width={800} height={600} alt="Photo" />
<div className="min-h-[250px]">{/* Reserved space */}</div>

// ✅ RUM: Send metrics reliably
navigator.sendBeacon('/api/vitals', JSON.stringify(metric));

// ✅ Font loading: Prevent FOUT/FOIT
@font-face {
  font-display: optional; // or swap with size-adjust
}

// ❌ NEVER: Client-side fetch for LCP content
useEffect(() => { fetchHeroData().then(setData); }, []);

// ❌ NEVER: Missing dimensions on images
<img src="/photo.jpg" alt="Photo" /> // Causes CLS

// ❌ NEVER: Heavy computation in event handlers
onClick={() => { heavyComputation(); setResult(result); }}
```

## Key Decisions

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| LCP content rendering | Client-side | SSR/SSG | **SSR/SSG** - Critical content must be in initial HTML |
| Image format | JPEG/PNG | WebP/AVIF | **WebP** (AVIF for modern browsers) - 25-50% smaller |
| Font loading | swap | optional | **optional** for non-critical, **swap** with fallback metrics |
| INP optimization | Debounce | useTransition | **useTransition** - React 18+ native, better UX |
| Monitoring | Lab only | Lab + Field | **Lab + Field** - Real user data is ground truth |
| Performance budget | Soft warning | Hard fail | **Hard fail** in CI - Prevents regression |

## Anti-Patterns (FORBIDDEN)

```typescript
// ❌ FORBIDDEN: LCP element rendered client-side
function Hero() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchHeroContent().then(setData);  // LCP waits for JS + fetch!
  }, []);
  return data ? <HeroImage src={data.image} /> : <Skeleton />;
}

// ❌ FORBIDDEN: Images without dimensions
<img src="/photo.jpg" alt="Photo" />  // Browser can't reserve space
// ✅ CORRECT: Always provide width/height
<img src="/photo.jpg" width={800} height={600} alt="Photo" />

// ❌ FORBIDDEN: Lazy loading LCP image
<img src="/hero.webp" loading="lazy" />  // Delays LCP!
// ✅ CORRECT: Eager load with high priority
<img src="/hero.webp" fetchpriority="high" loading="eager" />

// ❌ FORBIDDEN: Blocking main thread in handlers
<button onClick={() => {
  const result = expensiveOperation();  // Blocks INP!
  setResult(result);
}}>Calculate</button>
// ✅ CORRECT: Defer heavy work
<button onClick={() => {
  startTransition(() => {
    const result = expensiveOperation();
    setResult(result);
  });
}}>Calculate</button>

// ❌ FORBIDDEN: Layout-shifting animations
.sidebar {
  width: 0;
  transition: width 0.3s;  // Causes layout shift!
}
// ✅ CORRECT: Use transform
.sidebar {
  transform: translateX(-100%);
  transition: transform 0.3s;
}

// ❌ FORBIDDEN: Inserting content above viewport
function Banner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setTimeout(() => setShow(true), 1000);  // CLS!
  }, []);
  return show ? <div className="fixed top-0">Banner</div> : null;
}

// ❌ FORBIDDEN: Font flash without fallback
@font-face {
  font-family: 'Custom';
  src: url('/custom.woff2');
  font-display: block;  // Shows nothing until font loads
}

// ❌ FORBIDDEN: Only measuring in lab environment
// Lab data != real user experience
// Always combine Lighthouse with RUM (web-vitals library)

// ❌ FORBIDDEN: Third-party scripts blocking render
<script src="https://slow-analytics.com/script.js"></script>
// ✅ CORRECT: Defer or async non-critical scripts
<script src="https://analytics.com/script.js" defer></script>
```

## Related Skills

- `image-optimization` - Comprehensive image optimization strategies
- `observability-monitoring` - Production monitoring and alerting
- `react-server-components-framework` - SSR/RSC for LCP optimization
- `frontend-ui-developer` - Modern frontend patterns
- `accessibility-specialist` - Performance intersects with a11y (skip links, focus management)

## Capability Details

### lcp-optimization
**Keywords**: LCP, largest-contentful-paint, hero, preload, priority, SSR, TTFB
**Solves**: Slow initial render, delayed hero content, poor Time to First Byte

### inp-optimization
**Keywords**: INP, interaction, responsiveness, long-task, transition, yield, scheduler
**Solves**: Slow button responses, janky scrolling, blocked main thread

### cls-prevention
**Keywords**: CLS, layout-shift, dimensions, aspect-ratio, font-display, skeleton
**Solves**: Content jumping, image pop-in, font flash, ad insertion shifts

### rum-monitoring
**Keywords**: RUM, web-vitals, field-data, analytics, sendBeacon, percentile
**Solves**: Understanding real user experience, identifying regressions, alerting

### performance-budgets
**Keywords**: budget, webpack, lighthouse-ci, bundle-size, threshold, regression
**Solves**: Preventing performance degradation, enforcing standards, CI integration

### 2026-thresholds
**Keywords**: 2026, stricter, LCP-2.0s, INP-150ms, CLS-0.08, future-proof
**Solves**: Preparing for Google's stricter thresholds before they become ranking factors

## References

- `references/rum-setup.md` - Complete RUM implementation
- `scripts/performance-monitoring.ts` - Monitoring template
- `checklists/cwv-checklist.md` - Optimization checklist
- `examples/cwv-examples.md` - Real-world optimization examples
