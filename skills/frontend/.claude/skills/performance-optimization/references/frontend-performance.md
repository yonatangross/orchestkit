# Frontend Performance Optimization

Techniques for optimizing bundle size, loading speed, and rendering performance.

## Bundle Optimization

### 1. Code Splitting

Split your bundle into smaller chunks that load on-demand:

```typescript
// Route-based splitting (React 19)
import { lazy, Suspense } from 'react';

const AdminPanel = lazy(() => import('./AdminPanel'));
const Dashboard = lazy(() => import('./Dashboard'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Suspense>
  );
}
```

### 2. Tree Shaking

Import only what you need:

```typescript
// ❌ BAD: Imports entire library
import _ from 'lodash';
_.debounce(fn, 100);

// ✅ GOOD: Import specific function
import debounce from 'lodash/debounce';
debounce(fn, 100);

// ✅ EVEN BETTER: Use native or lightweight alternative
const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};
```

### 3. Image Optimization

```tsx
// Use next/image for automatic optimization
import Image from 'next/image';

<Image
  src="/hero.jpg"
  width={1200}
  height={600}
  alt="Hero"
  loading="lazy"  // Lazy load below fold
  quality={85}    // Balance quality/size
  placeholder="blur"  // Show blur while loading
/>

// Or use modern formats manually
<picture>
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="Hero" loading="lazy" />
</picture>
```

## Rendering Optimization

### 1. Memoization

Prevent unnecessary re-renders:

```typescript
import { memo, useMemo, useCallback } from 'react';

// Memoize expensive component
const ExpensiveChart = memo(({ data }) => {
  return <Chart data={data} />;
});

// Memoize expensive computation
function AnalyticsDashboard({ analyses }) {
  const stats = useMemo(() => {
    return analyses.reduce((acc, a) => ({
      totalCost: acc.totalCost + a.cost,
      avgDuration: acc.avgDuration + a.duration
    }), { totalCost: 0, avgDuration: 0 });
  }, [analyses]);  // Only recompute if analyses change

  return <div>{stats.totalCost}</div>;
}

// Memoize callback to prevent child re-renders
function Parent() {
  const [count, setCount] = useState(0);

  const handleClick = useCallback(() => {
    setCount(c => c + 1);
  }, []);  // Function identity stays same

  return <Child onClick={handleClick} />;
}
```

### 2. Virtualization

Render only visible items in long lists:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function AnalysisList({ analyses }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: analyses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,  // Estimated row height
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <AnalysisCard analysis={analyses[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Batch DOM Operations

Minimize layout thrashing:

```typescript
// ❌ BAD: Read-write-read-write causes layout thrashing
elements.forEach(el => {
  const height = el.offsetHeight;  // Read (triggers layout)
  el.style.height = height + 10 + 'px';  // Write
});

// ✅ GOOD: Batch reads, then writes
const heights = elements.map(el => el.offsetHeight);  // All reads
elements.forEach((el, i) => {
  el.style.height = heights[i] + 10 + 'px';  // All writes
});
```

## Core Web Vitals Optimization

### LCP (Largest Contentful Paint) - Target: < 2.5s

**Causes:**
- Large images not optimized
- Slow server response (TTFB)
- Render-blocking JS/CSS

**Fixes:**
- Preload LCP image: `<link rel="preload" as="image" href="/hero.jpg">`
- Use CDN for assets
- Inline critical CSS
- Server-side rendering (SSR)

### INP (Interaction to Next Paint) - Target: < 200ms

**Causes:**
- Heavy JavaScript execution
- Long-running event handlers
- Main thread blocked

**Fixes:**
- Debounce expensive operations
- Use Web Workers for heavy computation
- Split long tasks with `setTimeout()` or `scheduler.postTask()`

### CLS (Cumulative Layout Shift) - Target: < 0.1

**Causes:**
- Images without dimensions
- Ads/embeds loading late
- Web fonts causing FOIT/FOUT

**Fixes:**
- Always set `width` and `height` on images
- Reserve space for ads: `min-height: 250px`
- Use `font-display: swap` for web fonts
- Preload fonts: `<link rel="preload" as="font">`

## Bundle Analysis

```bash
# Lighthouse audit
lighthouse http://localhost:3000 --output=html

# Bundle analysis (Next.js)
ANALYZE=true npm run build

# Bundle analysis (Vite)
npm run build && npx vite-bundle-visualizer

# Check bundle size
du -sh dist/
```

## Best Practices

1. **Lazy load below-the-fold content**
2. **Use modern image formats** (WebP, AVIF)
3. **Enable compression** (Brotli > gzip)
4. **Minimize third-party scripts**
5. **Use CDN for static assets**
6. **Monitor Core Web Vitals** in production with RUM

## References

- [Core Web Vitals](https://web.dev/vitals/)
- [React Profiler](https://react.dev/reference/react/Profiler)
- See `templates/frontend-optimization.tsx` for complete examples
