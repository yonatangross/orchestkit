# React Performance Audit Checklist

Pre-deployment performance verification.

## React Compiler Check

- [ ] React Compiler enabled in build config
- [ ] Components show "Memo ✨" badge in DevTools
- [ ] Code follows Rules of React:
  - [ ] Components are idempotent
  - [ ] Props/state treated as immutable
  - [ ] Side effects in useEffect only
  - [ ] Hooks at top level

## Render Performance

- [ ] No unnecessary re-renders (verified with Profiler)
- [ ] State colocated close to usage
- [ ] Context split to prevent cascading updates
- [ ] Expensive computations have escape hatch memoization
- [ ] Lists > 100 items are virtualized

## Large Lists / Data

- [ ] TanStack Virtual for lists > 100 items
- [ ] Pagination or infinite scroll for API data
- [ ] Table virtualization for grids > 50 rows
- [ ] Images lazy loaded below fold

## Code Splitting

- [ ] Route-based code splitting (lazy routes)
- [ ] Heavy components lazy loaded
- [ ] Dynamic imports for large libraries
- [ ] Bundle analyzer run, no unexpected large chunks

## Network Performance

- [ ] API calls deduplicated (React Query, SWR)
- [ ] Data prefetched on hover/intent
- [ ] Optimistic updates for mutations
- [ ] Appropriate cache headers set

## Images & Media

- [ ] Images optimized (WebP, AVIF)
- [ ] Responsive images with srcset
- [ ] Lazy loading for below-fold images
- [ ] Placeholder/skeleton during load

## Third-Party Scripts

- [ ] Analytics loaded async/deferred
- [ ] Third-party widgets lazy loaded
- [ ] Font loading optimized (preload critical)
- [ ] No render-blocking resources

## Profiling Verification

### Before Optimization
1. [ ] Record baseline interaction times
2. [ ] Document slowest components
3. [ ] Note current bundle size

### After Optimization
1. [ ] Re-profile all interactions
2. [ ] Verify improvements in numbers
3. [ ] Check bundle size delta

## Key Metrics to Track

| Metric | Target | Current |
|--------|--------|---------|
| LCP (Largest Contentful Paint) | < 2.5s | ___ |
| FID (First Input Delay) | < 100ms | ___ |
| CLS (Cumulative Layout Shift) | < 0.1 | ___ |
| Time to Interactive | < 3s | ___ |
| Main thread blocking | < 200ms | ___ |

## Quick Profiler Commands

```bash
# React DevTools Profiler
# 1. Open DevTools → Profiler tab
# 2. Click Record
# 3. Perform interaction
# 4. Click Stop
# 5. Analyze flamegraph

# Lighthouse
npx lighthouse http://localhost:3000 --view

# Bundle Analyzer (Next.js)
ANALYZE=true npm run build

# Bundle Analyzer (Vite)
npx vite-bundle-visualizer
```

## Common Issues Checklist

- [ ] No anonymous functions as props in hot paths
- [ ] No object/array literals as props in hot paths
- [ ] Context providers near consumers
- [ ] useEffect dependencies correct
- [ ] No state updates in render

## Sign-Off

- [ ] All critical interactions < 100ms
- [ ] No visible jank during scroll
- [ ] Page load acceptable on 3G
- [ ] Bundle size within budget
- [ ] Performance regression tests in CI
