# Core Web Vitals Optimization

Google's Core Web Vitals are the key metrics for measuring user experience.

## The Three Metrics

| Metric | Target | Measures | Impact |
|--------|--------|----------|--------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Loading performance | First impression |
| **INP** (Interaction to Next Paint) | < 200ms | Responsiveness | User frustration |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability | Accidental clicks |

## LCP (Largest Contentful Paint)

### What It Measures
Time until the largest visible element (hero image, heading, video) renders.

### Common Causes
- Large, unoptimized images
- Slow server response time (TTFB > 600ms)
- Render-blocking JavaScript/CSS
- Client-side rendering

### Fixes

**1. Optimize Images**
```html
<!-- Preload LCP image -->
<link rel="preload" as="image" href="/hero.jpg" />

<!-- Use modern formats -->
<picture>
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="Hero" width="1200" height="600" />
</picture>

<!-- Or use next/image -->
<Image src="/hero.jpg" priority quality={85} />
```

**2. Reduce Server Response Time**
- Use CDN for static assets
- Enable HTTP/2 or HTTP/3
- Optimize database queries
- Implement caching (Redis, CDN)

**3. Eliminate Render-Blocking Resources**
```html
<!-- Defer non-critical CSS -->
<link rel="preload" as="style" href="/styles.css" onload="this.onload=null;this.rel='stylesheet'" />

<!-- Defer JavaScript -->
<script src="/app.js" defer></script>

<!-- Inline critical CSS -->
<style>
  /* Critical above-the-fold styles */
  .hero { ... }
</style>
```

**4. Use Server-Side Rendering (SSR)**
```typescript
// Next.js SSR
export async function getServerSideProps() {
  const data = await fetchData();
  return { props: { data } };
}

// React Server Components
async function Page() {
  const data = await fetchData();  // Runs on server
  return <div>{data}</div>;
}
```

## INP (Interaction to Next Paint)

### What It Measures
Time from user interaction (click, tap, key press) to visual feedback.

### Common Causes
- Heavy JavaScript execution blocking main thread
- Long-running event handlers
- Expensive DOM updates
- Third-party scripts

### Fixes

**1. Debounce/Throttle Expensive Operations**
```typescript
import { debounce } from 'lodash';

// Without debounce: runs on EVERY keystroke
function handleSearch(query: string) {
  const results = expensiveSearch(query);  // Blocks for 100ms
  setResults(results);
}

// With debounce: runs 300ms after user stops typing
const handleSearch = debounce((query: string) => {
  const results = expensiveSearch(query);
  setResults(results);
}, 300);
```

**2. Use Web Workers for Heavy Computation**
```typescript
// worker.ts
self.onmessage = (e) => {
  const result = expensiveComputation(e.data);
  self.postMessage(result);
};

// main.ts
const worker = new Worker('/worker.js');
worker.postMessage(data);
worker.onmessage = (e) => {
  setResult(e.data);
};
```

**3. Split Long Tasks**
```typescript
// Before: Blocks main thread for 500ms
function processItems(items) {
  items.forEach(item => {
    processItem(item);  // 5ms each × 100 items = 500ms
  });
}

// After: Yields to browser between batches
async function processItems(items) {
  for (let i = 0; i < items.length; i += 10) {
    const batch = items.slice(i, i + 10);
    batch.forEach(processItem);

    // Yield to browser
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

// Or use Scheduler API (modern)
async function processItems(items) {
  for (let i = 0; i < items.length; i += 10) {
    const batch = items.slice(i, i + 10);
    batch.forEach(processItem);

    await scheduler.yield();  // Yield to higher priority tasks
  }
}
```

**4. Optimize React Rendering**
```typescript
// Memoize expensive components
const Chart = memo(({ data }) => <ExpensiveChart data={data} />);

// Use startTransition for non-urgent updates
import { useTransition } from 'react';

function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    setQuery(e.target.value);  // Urgent: update input immediately

    startTransition(() => {
      // Non-urgent: can be interrupted
      const filtered = filterResults(e.target.value);
      setResults(filtered);
    });
  }

  return <input value={query} onChange={handleChange} />;
}
```

## CLS (Cumulative Layout Shift)

### What It Measures
Visual stability - how much elements unexpectedly shift during load.

### Common Causes
- Images without dimensions
- Ads/embeds injected after layout
- Web fonts causing FOIT/FOUT
- Dynamically injected content

### Fixes

**1. Always Set Image Dimensions**
```html
<!-- ❌ BAD: No dimensions, causes layout shift -->
<img src="/photo.jpg" alt="Photo" />

<!-- ✅ GOOD: Reserves space -->
<img src="/photo.jpg" alt="Photo" width="800" height="600" />

<!-- Or with aspect ratio (CSS) -->
<img src="/photo.jpg" alt="Photo" style="aspect-ratio: 4/3; width: 100%;" />
```

**2. Reserve Space for Ads/Embeds**
```css
.ad-container {
  min-height: 250px;  /* Reserve space before ad loads */
  background: #f0f0f0;
}
```

**3. Optimize Web Font Loading**
```css
/* Prevent FOIT (flash of invisible text) */
@font-face {
  font-family: 'CustomFont';
  src: url('/font.woff2') format('woff2');
  font-display: swap;  /* Show fallback immediately, swap when ready */
}
```

```html
<!-- Preload critical fonts -->
<link rel="preload" as="font" href="/font.woff2" type="font/woff2" crossorigin />
```

**4. Avoid Inserting Content Above Existing Content**
```typescript
// ❌ BAD: Inserts notification at top, shifts everything down
function addNotification(message) {
  container.insertAdjacentHTML('afterbegin', `<div>${message}</div>`);
}

// ✅ GOOD: Append to bottom or use fixed positioning
function addNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification-fixed';  // position: fixed
  notification.textContent = message;
  document.body.appendChild(notification);
}
```

## Measuring Core Web Vitals

### In Development
```typescript
// Use web-vitals library
import { onCLS, onINP, onLCP } from 'web-vitals';

onLCP(console.log);  // Log LCP
onINP(console.log);  // Log INP
onCLS(console.log);  // Log CLS
```

### In Production (RUM - Real User Monitoring)
```typescript
import { onCLS, onINP, onLCP } from 'web-vitals';

function sendToAnalytics(metric) {
  fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify(metric),
  });
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

### Lighthouse (Lab Testing)
```bash
# Run Lighthouse audit
lighthouse https://your-site.com --output=html

# Or use Chrome DevTools
# Open DevTools → Lighthouse tab → Generate report
```

## Targets by Percentile

Google measures at the **75th percentile** of all page loads:

| Grade | LCP | INP | CLS |
|-------|-----|-----|-----|
| **Good** (Green) | < 2.5s | < 200ms | < 0.1 |
| **Needs Improvement** (Orange) | 2.5-4s | 200-500ms | 0.1-0.25 |
| **Poor** (Red) | > 4s | > 500ms | > 0.25 |

**Goal:** 75% of page loads should be "Good" for all three metrics.

## Quick Wins Checklist

- [ ] Add `width` and `height` to all images
- [ ] Preload LCP image
- [ ] Use `font-display: swap` for web fonts
- [ ] Defer non-critical JavaScript
- [ ] Enable HTTP/2 and compression
- [ ] Use CDN for static assets
- [ ] Implement lazy loading for below-fold images
- [ ] Memoize expensive React components
- [ ] Debounce search inputs and expensive handlers

## References

- [Web Vitals](https://web.dev/vitals/)
- [Optimize LCP](https://web.dev/optimize-lcp/)
- [Optimize INP](https://web.dev/optimize-inp/)
- [Optimize CLS](https://web.dev/optimize-cls/)
- [web-vitals library](https://github.com/GoogleChrome/web-vitals)
