# Core Web Vitals Optimization Checklist

Comprehensive checklist for achieving and maintaining good Core Web Vitals scores.

## Thresholds Reference

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |

**2026 Stricter Thresholds (plan ahead!):**
- LCP: ≤ 2.0s
- INP: ≤ 150ms
- CLS: ≤ 0.08

---

## LCP (Largest Contentful Paint) ≤ 2.5s

### Identify the LCP Element
- [ ] Run Lighthouse to identify LCP element
- [ ] Use Performance Observer to confirm in production
- [ ] LCP is typically: hero image, hero heading, or above-the-fold banner

```javascript
// Debug: Find LCP element
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  console.log('LCP element:', entries[entries.length - 1].element);
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

### Server Response Time (TTFB)
- [ ] Server response time (TTFB) < 800ms
- [ ] Use edge/CDN for static content
- [ ] Enable HTTP/2 or HTTP/3
- [ ] Compress responses (gzip/brotli)
- [ ] Database queries optimized
- [ ] Caching strategy implemented (Redis, CDN cache)

### Critical Resource Loading
- [ ] LCP image has `fetchpriority="high"` attribute
- [ ] LCP image has `loading="eager"` (not lazy)
- [ ] LCP image preloaded in `<head>`
- [ ] Critical CSS inlined or preloaded
- [ ] Font preloaded with `crossorigin` attribute
- [ ] Preconnect to critical third-party origins

```html
<!-- Preload critical resources -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />
<link rel="preload" as="font" href="/font.woff2" type="font/woff2" crossorigin />
<link rel="preconnect" href="https://api.example.com" />
```

### Image Optimization
- [ ] LCP image in modern format (WebP/AVIF)
- [ ] Image properly sized (not oversized)
- [ ] Responsive images with `srcset`
- [ ] Image CDN used (Cloudinary, imgix, Vercel)

### Rendering Strategy
- [ ] LCP content rendered server-side (SSR/SSG)
- [ ] LCP content NOT loaded client-side via fetch
- [ ] No render-blocking JavaScript
- [ ] No render-blocking CSS below the fold
- [ ] Third-party scripts deferred

```typescript
// ✅ GOOD: Server-rendered LCP content
export default async function Page() {
  const hero = await getHeroData();
  return <Hero data={hero} />;
}

// ❌ BAD: Client-loaded LCP content
function Page() {
  const [hero, setHero] = useState(null);
  useEffect(() => { fetchHero().then(setHero); }, []); // Delays LCP!
}
```

---

## INP (Interaction to Next Paint) ≤ 200ms

### Identify Long Tasks
- [ ] Chrome DevTools Performance tab analyzed
- [ ] Long tasks (>50ms) identified
- [ ] Main thread blockers removed/optimized

### JavaScript Optimization
- [ ] Heavy computation moved to Web Workers
- [ ] Large arrays processed in chunks with yielding
- [ ] `requestIdleCallback` used for non-critical work
- [ ] Bundle size minimized (code splitting)
- [ ] Tree shaking enabled

```typescript
// ✅ GOOD: Yield to main thread
async function processItems(items: Item[]) {
  for (const item of items) {
    processItem(item);
    // Yield every 4ms to allow paint
    await scheduler.yield?.() ?? new Promise(r => setTimeout(r, 0));
  }
}
```

### React Optimization
- [ ] `useTransition` for non-urgent updates
- [ ] `useDeferredValue` for expensive derivations
- [ ] Memoization where appropriate (`useMemo`, `memo`)
- [ ] Virtualization for long lists (`react-window`, `@tanstack/virtual`)
- [ ] Suspense boundaries for code splitting

```typescript
// ✅ GOOD: Non-blocking state updates
const [isPending, startTransition] = useTransition();

function handleSearch(query: string) {
  setQuery(query); // Urgent: update input
  startTransition(() => {
    setFilteredResults(filter(query)); // Non-urgent: defer
  });
}
```

### Event Handler Optimization
- [ ] No heavy computation in event handlers
- [ ] Handlers don't cause layout thrashing
- [ ] Passive event listeners for scroll/touch
- [ ] Debounced input handlers where appropriate

```typescript
// ✅ GOOD: Defer heavy work
onClick={() => {
  setLoading(true);
  startTransition(() => {
    const result = heavyComputation();
    setResult(result);
    setLoading(false);
  });
}}

// ❌ BAD: Blocking handler
onClick={() => {
  const result = heavyComputation(); // Blocks paint!
  setResult(result);
}}
```

### Animation Performance
- [ ] Animations use `transform` and `opacity` only
- [ ] No animations on layout properties (width, height, top, left)
- [ ] `will-change` used sparingly
- [ ] Animations run at 60fps (checked in DevTools)

---

## CLS (Cumulative Layout Shift) ≤ 0.1

### Image Dimensions
- [ ] ALL images have explicit `width` and `height`
- [ ] Responsive images use `aspect-ratio` container
- [ ] `fill` prop images have sized container
- [ ] No images cause layout shift on load

```tsx
// ✅ GOOD: Explicit dimensions
<img src="/photo.jpg" width={800} height={600} alt="Photo" />

// ✅ GOOD: Aspect ratio container
<div className="aspect-[16/9]">
  <Image src="/photo.jpg" fill alt="Photo" />
</div>
```

### Dynamic Content
- [ ] Space reserved for dynamic content (ads, embeds)
- [ ] Skeleton loaders match final content size
- [ ] No content inserted above existing content
- [ ] Lazy-loaded content has reserved space

```tsx
// ✅ GOOD: Reserved space
<div className="min-h-[250px]">
  {ad ? <Ad data={ad} /> : <Skeleton height={250} />}
</div>
```

### Font Loading
- [ ] `font-display: optional` or `swap` used
- [ ] Fallback font has `size-adjust` to match
- [ ] Critical font preloaded
- [ ] System font stack as fallback

```css
/* Fallback with size adjustment */
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107%;
  ascent-override: 90%;
}

body {
  font-family: 'Inter', 'Inter Fallback', sans-serif;
}
```

### Animation Stability
- [ ] Animations use `transform`, not layout properties
- [ ] Expanding/collapsing uses `scaleY`, not `height`
- [ ] Modals/overlays don't shift page content
- [ ] Toast notifications positioned fixed/absolute

```css
/* ✅ GOOD: Transform-based animation */
.drawer {
  transform: translateX(-100%);
  transition: transform 0.3s;
}
.drawer.open {
  transform: translateX(0);
}

/* ❌ BAD: Layout-shifting animation */
.drawer {
  width: 0;
  transition: width 0.3s;
}
```

### Iframes and Embeds
- [ ] Iframes have explicit dimensions
- [ ] Third-party embeds wrapped with sized container
- [ ] Lazy iframes have placeholder

---

## Measurement & Monitoring

### Lab Testing
- [ ] Lighthouse CI in build pipeline
- [ ] Performance budgets enforced
- [ ] Regular manual Lighthouse audits
- [ ] Testing on throttled CPU/network

### Field Data (RUM)
- [ ] `web-vitals` library installed
- [ ] Metrics sent to analytics endpoint
- [ ] p75 percentile tracked (Google's standard)
- [ ] Alerts configured for regressions

```typescript
// Essential RUM setup
import { onLCP, onINP, onCLS } from 'web-vitals';

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

### Data Analysis
- [ ] Dashboard showing daily/weekly trends
- [ ] Segmentation by page, device, connection
- [ ] Comparison of lab vs field data
- [ ] Week-over-week regression detection

### Alerting
- [ ] Alert when p75 exceeds threshold
- [ ] Alert when good rate drops below 75%
- [ ] Alert on significant week-over-week regression
- [ ] Escalation path defined

---

## Build & Deploy

### Performance Budgets
- [ ] Bundle size limits configured
- [ ] Build fails on budget exceeded
- [ ] Per-route budgets for large apps

```javascript
// webpack.config.js
module.exports = {
  performance: {
    maxAssetSize: 150000, // 150KB
    maxEntrypointSize: 250000, // 250KB
    hints: 'error', // Fail build
  },
};
```

### CI/CD Integration
- [ ] Lighthouse CI runs on PRs
- [ ] Performance regression blocks merge
- [ ] Bundle analyzer report generated
- [ ] Preview deployments for testing

### CDN & Caching
- [ ] Static assets on CDN
- [ ] Immutable caching for hashed assets
- [ ] Stale-while-revalidate for HTML
- [ ] Edge caching where appropriate

---

## Debugging Checklist

### Slow LCP
- [ ] Check TTFB (server response time)
- [ ] Verify LCP element has `fetchpriority="high"`
- [ ] Confirm LCP content is server-rendered
- [ ] Check for render-blocking resources
- [ ] Verify image is optimized and properly sized

### High INP
- [ ] Run Performance recording during interaction
- [ ] Look for long tasks in flame chart
- [ ] Check for forced synchronous layouts
- [ ] Verify heavy work is deferred
- [ ] Check for excessive re-renders

### High CLS
- [ ] Run Lighthouse with "Layout Shift Regions" enabled
- [ ] Check images for missing dimensions
- [ ] Look for late-loading content
- [ ] Verify fonts have fallbacks
- [ ] Check for content inserted above viewport

---

## Testing Protocol

### Before Deployment
- [ ] Lighthouse score ≥ 90 on Performance
- [ ] All Core Web Vitals in "good" range
- [ ] No performance budget violations
- [ ] Tested on throttled 4G + slow CPU

### After Deployment
- [ ] Monitor RUM for 24-48 hours
- [ ] Compare p75 to pre-deployment baseline
- [ ] Check for unexpected regressions
- [ ] Verify alerting is working

### Weekly Review
- [ ] Review p75 trends
- [ ] Identify worst-performing pages
- [ ] Check for new issues in CrUX
- [ ] Plan optimizations for next sprint
