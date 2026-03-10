---
name: performance
license: MIT
compatibility: "Claude Code 2.1.72+."
description: Performance optimization patterns covering Core Web Vitals, React render optimization, lazy loading, image optimization, backend profiling, LLM inference, and sustainability UX. Use when improving page speed, debugging slow renders, optimizing bundles, reducing image payload, profiling backend, deploying LLMs efficiently, or reducing digital carbon footprint.
tags: [performance, core-web-vitals, lcp, inp, cls, react-compiler, virtualization, lazy-loading, code-splitting, image-optimization, avif, profiling, vllm, quantization, inference, caching, redis, prompt-caching, tanstack-query, prefetching, optimistic-updates, sustainability, carbon-footprint, page-weight]
context: fork
agent: frontend-ui-developer
version: 2.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: high
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Performance

Comprehensive performance optimization patterns for frontend, backend, and LLM inference.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Core Web Vitals](#core-web-vitals) | 4 | CRITICAL | LCP, INP, CLS optimization with 2026 thresholds |
| [Render Optimization](#render-optimization) | 3 | HIGH | React Compiler, memoization, virtualization |
| [Lazy Loading](#lazy-loading) | 3 | HIGH | Code splitting, route splitting, preloading |
| [Image Optimization](#image-optimization) | 3 | HIGH | Next.js Image, AVIF/WebP, responsive images |
| [Profiling & Backend](#profiling--backend) | 3 | MEDIUM | React DevTools, py-spy, bundle analysis |
| [LLM Inference](#llm-inference) | 3 | MEDIUM | vLLM, quantization, speculative decoding |
| [Caching](#caching) | 2 | HIGH | Redis cache-aside, prompt caching, HTTP cache headers |
| [Query & Data Fetching](#query--data-fetching) | 2 | HIGH | TanStack Query prefetching, optimistic updates, rollback |
| [Sustainability](#sustainability) | 1 | MEDIUM | Page weight budgets, lazy loading, optimized formats, dark mode |

**Total: 24 rules across 9 categories**

## Core Web Vitals

Google's Core Web Vitals with 2026 stricter thresholds.

| Rule | File | Key Pattern |
|------|------|-------------|
| LCP Optimization | `rules/cwv-lcp.md` | Preload hero, SSR, fetchpriority="high" |
| INP Optimization | `rules/cwv-inp.md` | scheduler.yield, useTransition, requestIdleCallback |
| INP Advanced | `rules/cwv-inp-advanced.md` | Layout thrashing, third-party scripts, rAF patterns |
| CLS Prevention | `rules/cwv-cls.md` | Explicit dimensions, aspect-ratio, font-display |

### 2026 Thresholds

| Metric | Current Good | 2026 Good |
|--------|--------------|-----------|
| LCP | <= 2.5s | <= 2.0s |
| INP | <= 200ms | <= 150ms |
| CLS | <= 0.1 | <= 0.08 |

## Render Optimization

React render performance patterns for React 19+.

| Rule | File | Key Pattern |
|------|------|-------------|
| React Compiler | `rules/render-compiler.md` | Auto-memoization, "Memo" badge verification |
| Manual Memoization | `rules/render-memo.md` | useMemo/useCallback escape hatches, state colocation |
| Virtualization | `rules/render-virtual.md` | TanStack Virtual for 100+ item lists |

## Lazy Loading

Code splitting and lazy loading with React.lazy and Suspense.

| Rule | File | Key Pattern |
|------|------|-------------|
| React.lazy + Suspense | `rules/loading-lazy.md` | Component lazy loading, error boundaries |
| Route Splitting | `rules/loading-splitting.md` | React Router 7.x, Vite manual chunks |
| Preloading | `rules/loading-preload.md` | Prefetch on hover, modulepreload hints |

## Image Optimization

Production image optimization for modern web applications.

| Rule | File | Key Pattern |
|------|------|-------------|
| Next.js Image | `rules/images-nextjs.md` | Image component, priority, blur placeholder |
| Format Selection | `rules/images-formats.md` | AVIF/WebP, quality 75-85, picture element |
| Responsive Images | `rules/images-responsive.md` | sizes prop, art direction, CDN loaders |

## Profiling & Backend

Profiling tools and backend optimization patterns.

| Rule | File | Key Pattern |
|------|------|-------------|
| React Profiling | `rules/profiling-react.md` | DevTools Profiler, flamegraph, render counts |
| Backend Profiling | `rules/profiling-backend.md` | py-spy, cProfile, memory_profiler, flame graphs |
| Bundle Analysis | `rules/profiling-bundle.md` | vite-bundle-visualizer, tree shaking, performance budgets |

## LLM Inference

High-performance LLM inference with vLLM, quantization, and speculative decoding.

| Rule | File | Key Pattern |
|------|------|-------------|
| vLLM Deployment | `rules/inference-vllm.md` | PagedAttention, continuous batching, tensor parallelism |
| Quantization | `rules/inference-quantization.md` | AWQ, GPTQ, FP8, INT8 method selection |
| Speculative Decoding | `rules/inference-speculative.md` | N-gram, draft model, 1.5-2.5x throughput |

## Caching

Backend Redis caching and LLM prompt caching for cost savings and performance.

| Rule | File | Key Pattern |
|------|------|-------------|
| Redis & Backend | `rules/caching-redis.md` | Cache-aside, write-through, invalidation, stampede prevention |
| HTTP & Prompt | `rules/caching-http.md` | HTTP cache headers, LLM prompt caching, semantic caching |

## Query & Data Fetching

TanStack Query v5 patterns for prefetching and optimistic updates.

| Rule | File | Key Pattern |
|------|------|-------------|
| Prefetching | `rules/query-prefetching.md` | Hover prefetch, route loaders, queryOptions, Suspense |
| Optimistic Updates | `rules/query-optimistic.md` | Optimistic mutations, rollback, cache invalidation |

## Sustainability

Digital sustainability patterns for reducing carbon footprint and energy usage.

| Rule | File | Key Pattern |
|------|------|-------------|
| Sustainability UX | `rules/sustainability-ux.md` | Page weight budgets, AVIF/WebP, lazy loading, dark mode |

## Quick Start Example

```tsx
// LCP: Priority hero image with SSR
import Image from 'next/image';

export default async function Page() {
  const data = await fetchHeroData();
  return (
    <Image
      src={data.heroImage}
      alt="Hero"
      priority
      placeholder="blur"
      sizes="100vw"
      fill
    />
  );
}
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Memoization | Let React Compiler handle it (2026 default) |
| Lists 100+ items | Use TanStack Virtual |
| Image format | AVIF with WebP fallback (30-50% smaller) |
| LCP content | SSR/SSG, never client-side fetch |
| Code splitting | Per-route for most apps, per-component for heavy widgets |
| Prefetch strategy | On hover for nav links, viewport for content |
| Quantization | AWQ for 4-bit, FP8 for H100/H200 |
| Bundle budget | Hard fail in CI to prevent regression |

## Common Mistakes

1. Client-side fetching LCP content (delays render)
2. Images without explicit dimensions (causes CLS)
3. Lazy loading LCP images (delays largest paint)
4. Heavy computation in event handlers (blocks INP)
5. Layout-shifting animations (use transform instead)
6. Lazy loading tiny components < 5KB (overhead > savings)
7. Missing error boundaries on lazy components
8. Using GPTQ without calibration data
9. Not benchmarking actual workload patterns
10. Only measuring in lab environment (need RUM)

## Related Skills

- `ork:react-server-components-framework` - Server-first rendering
- `ork:vite-advanced` - Build optimization
- `caching` - Cache strategies for responses
- `ork:monitoring-observability` - Production monitoring and alerting
- `ork:database-patterns` - Query and index optimization
- `ork:llm-integration` - Local inference with Ollama

## Capability Details

### lcp-optimization
**Keywords:** LCP, largest-contentful-paint, hero, preload, priority, SSR
**Solves:**
- Optimize hero image loading
- Server-render critical content
- Preload and prioritize LCP resources

### inp-optimization
**Keywords:** INP, interaction, responsiveness, long-task, transition, yield
**Solves:**
- Break up long tasks with scheduler.yield
- Defer non-urgent updates with useTransition
- Optimize event handler performance

### cls-prevention
**Keywords:** CLS, layout-shift, dimensions, aspect-ratio, font-display
**Solves:**
- Reserve space for dynamic content
- Prevent font flash and image pop-in
- Use transform for animations

### react-compiler
**Keywords:** react-compiler, auto-memo, memoization, React 19
**Solves:**
- Enable automatic memoization
- Identify when manual memoization needed
- Verify compiler is working

### virtualization
**Keywords:** virtual, TanStack, large-list, scroll, overscan
**Solves:**
- Render 100+ item lists efficiently
- Dynamic height virtualization
- Window scrolling patterns

### lazy-loading
**Keywords:** React.lazy, Suspense, code-splitting, dynamic-import
**Solves:**
- Route-based code splitting
- Component lazy loading with error boundaries
- Prefetch on hover and viewport

### image-optimization
**Keywords:** next/image, AVIF, WebP, responsive, blur-placeholder
**Solves:**
- Next.js Image component patterns
- Format selection and quality settings
- Responsive sizing and CDN configuration

### profiling
**Keywords:** profiler, flame-graph, py-spy, DevTools, bundle-analyzer
**Solves:**
- Profile React renders and backend code
- Generate and interpret flame graphs
- Analyze and optimize bundle size

### inp-advanced
**Keywords:** INP, scheduler-yield, layout-thrashing, third-party-scripts, requestAnimationFrame
**Solves:**
- Break long tasks with scheduler.yield()
- Audit and defer blocking third-party scripts
- Avoid synchronous layout thrashing in event handlers
- Optimize form submissions, dropdowns, accordions, filters

### sustainability
**Keywords:** sustainability, carbon-footprint, page-weight, green-ux, dark-mode, lazy-loading
**Solves:**
- Enforce page weight budgets (< 1MB)
- Eliminate auto-playing videos and heavy decorative animations
- Serve optimized image formats (AVIF/WebP)
- Implement cursor-based pagination to prevent over-fetching

### llm-inference
**Keywords:** vllm, quantization, speculative-decoding, inference, throughput
**Solves:**
- Deploy LLMs with vLLM for production
- Choose quantization method for hardware
- Accelerate generation with speculative decoding

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:
| File | Content |
|------|---------|
| `rum-setup.md` | Real User Monitoring |
| `react-compiler-migration.md` | Compiler adoption |
| `tanstack-virtual-patterns.md` | Virtualization patterns |
| `vllm-deployment.md` | Production vLLM config |
| `quantization-guide.md` | Method comparison |
| `cdn-setup.md` | Image CDN configuration |
| `cc-prompt-cache-guide.md` | CC 2.1.72 prompt cache optimization, stable-first prompt structure |
