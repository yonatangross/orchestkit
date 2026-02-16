---
title: Prefetch Strategies
impact: HIGH
impactDescription: "Prefetching loads resources before the user needs them, making navigation feel instant"
tags: prefetch, preload, modulepreload, hover, intersection, link-hints
---

# Prefetch Strategies

Proactively load resources before the user navigates to reduce perceived latency.

## Module Preload Hints

```html
<!-- Preload critical JS modules -->
<link rel="modulepreload" href="/assets/dashboard-abc123.js" />
<link rel="modulepreload" href="/assets/shared-chunk-def456.js" />

<!-- Prefetch likely next pages (low priority) -->
<link rel="prefetch" href="/assets/settings-ghi789.js" />
```

## Prefetch on Hover

```tsx
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const prefetchRef = useRef(false);

  const handlePointerEnter = () => {
    if (prefetchRef.current) return;
    prefetchRef.current = true;
    import(`./pages/${to}.tsx`); // Triggers prefetch
  };

  return (
    <a href={`/${to}`} onPointerEnter={handlePointerEnter}>
      {children}
    </a>
  );
}
```

## Prefetch on Viewport Intersection

```tsx
function usePrefetchOnVisible(importFn: () => Promise<unknown>) {
  const ref = useRef<HTMLElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loaded.current) {
        loaded.current = true;
        importFn();
        observer.disconnect();
      }
    }, { rootMargin: '200px' });

    observer.observe(el);
    return () => observer.disconnect();
  }, [importFn]);

  return ref;
}

// Usage
const ref = usePrefetchOnVisible(() => import('./HeavySection'));
<div ref={ref}><Suspense fallback={null}><HeavySection /></Suspense></div>
```

## Import on Interaction

```tsx
// Load a heavy module only when the user clicks
async function handleExport() {
  const { exportToPDF } = await import('./exportUtils');
  await exportToPDF(data);
}

<button onClick={handleExport}>Export PDF</button>
```

**Incorrect — No prefetching causes delayed navigation:**
```tsx
<a href="/dashboard">Dashboard</a>
```

**Correct — Hover prefetch gives 200-400ms head start:**
```tsx
function NavLink({ to, children }) {
  const prefetchRef = useRef(false);

  const handlePointerEnter = () => {
    if (prefetchRef.current) return;
    prefetchRef.current = true;
    import(`./pages/${to}.tsx`);
  };

  return (
    <a href={`/${to}`} onPointerEnter={handlePointerEnter}>
      {children}
    </a>
  );
}
```

**Key rules:**
- **Use** `modulepreload` for critical JS the current page needs
- **Use** `prefetch` for resources the user will likely need next
- **Prefetch on hover** for navigation links (200-400ms head start)
- **Prefetch on intersection** for below-the-fold heavy sections
- **Import on interaction** for rarely-used heavy features
