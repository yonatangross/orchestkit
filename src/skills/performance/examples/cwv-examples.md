# Core Web Vitals Examples

Real-world optimization examples for LCP, INP, and CLS.

---

## 1. LCP Optimization: E-Commerce Hero Section

Complete optimization of a hero section with product image and CTA.

### Before: Slow LCP (3.5s+)

```tsx
// ❌ BAD: Multiple LCP issues
function Hero() {
  const [product, setProduct] = useState(null);

  useEffect(() => {
    // Problem 1: LCP content loaded client-side
    fetch('/api/featured-product')
      .then(res => res.json())
      .then(setProduct);
  }, []);

  if (!product) return <div className="h-[600px]" />; // Problem 2: No skeleton

  return (
    <div className="relative">
      {/* Problem 3: No priority, lazy by default */}
      <img src={product.image} alt={product.name} />
      <h1>{product.name}</h1>
      <a href={`/product/${product.id}`}>Shop Now</a>
    </div>
  );
}
```

### After: Optimized LCP (1.2s)

```tsx
// ✅ GOOD: Server-rendered with optimized image
import Image from 'next/image';
import { Suspense } from 'react';

// Server Component - data fetched on server
async function Hero() {
  // Fetched on server, included in initial HTML
  const product = await getFeaturedProduct();

  return (
    <section className="relative h-[600px] overflow-hidden">
      {/* Priority image with explicit dimensions */}
      <Image
        src={product.image}
        alt={product.name}
        fill
        priority // Preloads, eager loading
        sizes="100vw"
        quality={85}
        placeholder="blur"
        blurDataURL={product.blurPlaceholder}
        style={{ objectFit: 'cover' }}
      />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white">
        <h1 className="text-5xl font-bold">{product.name}</h1>
        <p className="mt-4 text-xl">{product.tagline}</p>
        <a
          href={`/product/${product.id}`}
          className="mt-8 px-8 py-4 bg-white text-black rounded-lg font-semibold"
        >
          Shop Now
        </a>
      </div>
    </section>
  );
}

// Loading skeleton for Suspense boundary
function HeroSkeleton() {
  return (
    <section className="relative h-[600px] bg-gray-200 animate-pulse">
      <div className="flex flex-col items-center justify-center h-full">
        <div className="h-12 w-64 bg-gray-300 rounded" />
        <div className="mt-4 h-6 w-48 bg-gray-300 rounded" />
        <div className="mt-8 h-14 w-40 bg-gray-300 rounded-lg" />
      </div>
    </section>
  );
}

// Usage in page
export default function HomePage() {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <Hero />
    </Suspense>
  );
}

// Also add preload in head (layout.tsx or page metadata)
export const metadata = {
  other: {
    'link': [
      {
        rel: 'preload',
        as: 'image',
        href: '/featured-product-hero.webp',
        fetchpriority: 'high',
      },
    ],
  },
};
```

### Document Head Optimizations

```html
<!-- Add to <head> for fastest LCP -->
<head>
  <!-- Preload hero image -->
  <link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />

  <!-- Preload critical font -->
  <link
    rel="preload"
    as="font"
    href="/fonts/inter-bold.woff2"
    type="font/woff2"
    crossorigin
  />

  <!-- Preconnect to image CDN -->
  <link rel="preconnect" href="https://images.example.com" />

  <!-- DNS prefetch for analytics -->
  <link rel="dns-prefetch" href="https://analytics.example.com" />
</head>
```

---

## 2. INP Optimization: Product Search Filter

Optimizing a search filter that was causing 400ms+ INP.

### Before: Blocking INP (400ms+)

```tsx
// ❌ BAD: Blocks main thread on every keystroke
function ProductSearch({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(products);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Problem: Expensive filter runs synchronously
    // Blocks paint until complete
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(value.toLowerCase()) ||
      p.description.toLowerCase().includes(value.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(value.toLowerCase()))
    );
    setResults(filtered);
  };

  return (
    <>
      <input
        value={query}
        onChange={handleChange}
        placeholder="Search products..."
      />
      <ProductGrid products={results} />
    </>
  );
}
```

### After: Responsive INP (50ms)

```tsx
// ✅ GOOD: Non-blocking with useDeferredValue
import {
  useState,
  useDeferredValue,
  useMemo,
  useTransition,
  memo
} from 'react';

function ProductSearch({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  // Deferred value for expensive computation
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  // Memoized filter only runs when deferredQuery changes
  const results = useMemo(() => {
    if (!deferredQuery) return products;

    const searchLower = deferredQuery.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower) ||
      p.tags.some(t => t.toLowerCase().includes(searchLower))
    );
  }, [products, deferredQuery]);

  return (
    <div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
          className="w-full px-4 py-2 border rounded-lg"
        />
        {/* Loading indicator during filter */}
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
      </div>

      {/* Fade during pending state */}
      <div
        className="mt-4 transition-opacity"
        style={{ opacity: isStale ? 0.7 : 1 }}
      >
        <ProductGrid products={results} />
      </div>
    </div>
  );
}

// Memoized grid to prevent unnecessary re-renders
const ProductGrid = memo(function ProductGrid({
  products
}: {
  products: Product[]
}) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
});
```

### For Very Large Lists: Virtual Scrolling

```tsx
// ✅ BEST: Virtualization for huge lists
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedProductList({ products }: { products: Product[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated row height
    overscan: 5, // Render 5 extra items above/below
  });

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ProductCard product={products[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 3. CLS Optimization: News Article Page

Fixing layout shifts from images, ads, and fonts.

### Before: High CLS (0.35)

```tsx
// ❌ BAD: Multiple CLS issues
function Article({ article }: { article: Article }) {
  const [ad, setAd] = useState(null);

  useEffect(() => {
    loadAd().then(setAd);
  }, []);

  return (
    <article>
      <h1>{article.title}</h1>

      {/* Problem 1: Image without dimensions */}
      <img src={article.heroImage} alt="" />

      {/* Problem 2: Ad appears after load, shifts content */}
      {ad && <div className="ad-banner"><img src={ad.image} /></div>}

      <div dangerouslySetInnerHTML={{ __html: article.content }} />

      {/* Problem 3: Related articles load and shift */}
      <RelatedArticles />
    </article>
  );
}

// Problem 4: Font causes layout shift
// CSS
/* No font-display, no fallback sizing */
@font-face {
  font-family: 'CustomFont';
  src: url('/font.woff2');
}
```

### After: Zero CLS (0.0)

```tsx
// ✅ GOOD: All layout shifts prevented
import Image from 'next/image';

function Article({ article }: { article: Article }) {
  return (
    <article className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold">{article.title}</h1>

      {/* Fixed dimensions prevent shift */}
      <div className="relative aspect-[16/9] my-6">
        <Image
          src={article.heroImage}
          alt={article.heroAlt}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          priority
          style={{ objectFit: 'cover' }}
        />
      </div>

      {/* Reserved space for ad */}
      <AdSlot
        slot="article-top"
        className="my-6"
        minHeight={250}
      />

      <div
        className="prose prose-lg"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Reserved space for related */}
      <RelatedArticles articleId={article.id} />
    </article>
  );
}

// Ad component with reserved space
function AdSlot({
  slot,
  className,
  minHeight
}: {
  slot: string;
  className?: string;
  minHeight: number;
}) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadAd(slot).then(ad => {
      setAd(ad);
      setLoaded(true);
    });
  }, [slot]);

  return (
    <div
      className={className}
      style={{ minHeight: `${minHeight}px` }} // Reserved space
    >
      {loaded ? (
        ad ? (
          <Image
            src={ad.image}
            alt={ad.alt}
            width={ad.width}
            height={ad.height}
          />
        ) : null // No ad, space collapses gracefully
      ) : (
        <Skeleton height={minHeight} /> // Placeholder during load
      )}
    </div>
  );
}

// Related articles with skeleton
function RelatedArticles({ articleId }: { articleId: string }) {
  const [articles, setArticles] = useState<Article[] | null>(null);

  useEffect(() => {
    fetchRelated(articleId).then(setArticles);
  }, [articleId]);

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-6">Related Articles</h2>

      {/* Fixed grid prevents shift */}
      <div className="grid grid-cols-3 gap-6">
        {articles ? (
          articles.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))
        ) : (
          // Skeleton matches final layout exactly
          <>
            <ArticleCardSkeleton />
            <ArticleCardSkeleton />
            <ArticleCardSkeleton />
          </>
        )}
      </div>
    </section>
  );
}

// Skeleton that matches card dimensions exactly
function ArticleCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[16/9] bg-gray-200 rounded-lg" />
      <div className="mt-3 h-5 bg-gray-200 rounded w-3/4" />
      <div className="mt-2 h-4 bg-gray-200 rounded w-1/2" />
    </div>
  );
}
```

### Font Loading Without CLS

```css
/* ✅ Optimized font loading */

/* Main font with swap and metrics */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-display: swap;
  font-weight: 100 900;
}

/* Fallback font with matched metrics */
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107.64%;
  ascent-override: 90%;
  descent-override: 22.43%;
  line-gap-override: 0%;
}

body {
  font-family: 'Inter', 'Inter Fallback', system-ui, sans-serif;
}

/* Alternative: font-display: optional for non-critical fonts */
@font-face {
  font-family: 'DisplayFont';
  src: url('/fonts/display.woff2') format('woff2');
  font-display: optional; /* Won't cause FOUT - uses fallback if not cached */
}
```

---

## 4. Complete RUM Implementation

Full Real User Monitoring setup with Next.js.

```typescript
// lib/performance.ts
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';

const ENDPOINT = '/api/vitals';

interface EnrichedMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
  connection?: string;
  deviceMemory?: number;
  viewport: { width: number; height: number };
}

function getConnectionInfo() {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
    deviceMemory?: number;
  };

  return {
    connection: nav.connection?.effectiveType,
    deviceMemory: nav.deviceMemory,
  };
}

function sendMetric(metric: Metric) {
  const enriched: EnrichedMetric = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    timestamp: Date.now(),
    ...getConnectionInfo(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };

  // Use sendBeacon for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, JSON.stringify(enriched));
  } else {
    fetch(ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(enriched),
      keepalive: true,
    });
  }

  // Debug in development
  if (process.env.NODE_ENV === 'development') {
    const color = {
      good: 'green',
      'needs-improvement': 'orange',
      poor: 'red',
    }[metric.rating];

    console.log(
      `%c[${metric.name}] ${metric.value.toFixed(1)}${metric.name === 'CLS' ? '' : 'ms'}`,
      `color: ${color}; font-weight: bold`
    );
  }
}

export function initWebVitals() {
  onCLS(sendMetric);
  onINP(sendMetric);
  onLCP(sendMetric);
  onFCP(sendMetric);
  onTTFB(sendMetric);
}
```

```typescript
// app/components/web-vitals.tsx
'use client';

import { useEffect } from 'react';
import { initWebVitals } from '@/lib/performance';

export function WebVitals() {
  useEffect(() => {
    initWebVitals();
  }, []);

  return null;
}
```

```typescript
// app/api/vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface VitalMetric {
  name: string;
  value: number;
  rating: string;
  url: string;
  timestamp: number;
}

export async function POST(request: NextRequest) {
  const metric: VitalMetric = await request.json();

  // Log for debugging
  console.log('[Vital]', metric.name, metric.value, metric.rating);

  // Store in database (example with Drizzle)
  // await db.insert(webVitals).values({
  //   name: metric.name,
  //   value: metric.value,
  //   rating: metric.rating,
  //   url: metric.url,
  //   timestamp: new Date(metric.timestamp),
  // });

  // Alert on poor metrics
  if (metric.rating === 'poor') {
    // await alertService.send({
    //   severity: 'warning',
    //   message: `Poor ${metric.name}: ${metric.value} on ${metric.url}`,
    // });
  }

  return NextResponse.json({ ok: true });
}
```

---

## 5. Performance Budget Enforcement

CI/CD integration with Lighthouse CI.

### lighthouserc.js

```javascript
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/products',
        'http://localhost:3000/checkout',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        // Throttle to simulate 4G
        // throttling: { ... }
      },
    },
    assert: {
      assertions: {
        // Core Web Vitals
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }], // Proxy for INP

        // Other performance metrics
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'speed-index': ['warn', { maxNumericValue: 3400 }],

        // Resource budgets
        'resource-summary:script:size': ['error', { maxNumericValue: 150000 }],
        'resource-summary:image:size': ['error', { maxNumericValue: 300000 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 500000 }],

        // Scores
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

### GitHub Actions Workflow

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Start server
        run: npm start &

      - name: Wait for server
        run: npx wait-on http://localhost:3000

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: lighthouse-results
          path: .lighthouseci/
```

---

## Quick Reference

```typescript
// ✅ LCP: Server-render, preload, priority
export default async function Page() {
  const data = await getData(); // Server-side
  return <Image src={data.hero} priority fill />;
}

// ✅ INP: useTransition for expensive updates
const [isPending, startTransition] = useTransition();
onChange={(e) => {
  setQuery(e.target.value);
  startTransition(() => setResults(filter(e.target.value)));
}}

// ✅ CLS: Always set dimensions
<Image src="/photo.jpg" width={800} height={600} />
<div className="aspect-[16/9]"><Image fill /></div>
<div className="min-h-[250px]">{content}</div>

// ✅ RUM: Send metrics reliably
navigator.sendBeacon('/api/vitals', JSON.stringify(metric));

// ✅ Debug: Find LCP element
new PerformanceObserver((list) => {
  console.log('LCP:', list.getEntries().at(-1)?.element);
}).observe({ type: 'largest-contentful-paint', buffered: true });
```
