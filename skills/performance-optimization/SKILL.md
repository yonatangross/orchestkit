---
name: Performance Optimization
description: Use when application is slow, bundle is too large, or investigating performance issues. Performance optimization covers profiling, React concurrent features, bundle analysis, and optimization patterns.
tags: [performance, optimization, profiling, caching]
context: fork
version: 1.2.0
category: Quality & Optimization
agents: [backend-system-architect, frontend-ui-developer, code-quality-reviewer]
keywords: [performance, optimization, speed, latency, throughput, caching, profiling, bundle, Core Web Vitals, react-19, virtualization, code-splitting, tree-shaking]
author: OrchestKit
user-invocable: false
---

# Performance Optimization Skill

Comprehensive frameworks for analyzing and optimizing application performance across the entire stack.

## Overview

- Application feels slow or unresponsive
- Database queries taking too long
- Frontend bundle size too large
- API response times exceed targets
- Core Web Vitals need improvement
- Preparing for scale or high traffic

## Performance Targets

### Core Web Vitals (Frontend)

| Metric | Good | Needs Work |
|--------|------|------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | < 4s |
| **INP** (Interaction to Next Paint) | < 200ms | < 500ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 | < 0.25 |
| **TTFB** (Time to First Byte) | < 200ms | < 600ms |

### Backend Targets

| Operation | Target |
|-----------|--------|
| Simple reads | < 100ms |
| Complex queries | < 500ms |
| Write operations | < 200ms |
| Index lookups | < 10ms |

## Bottleneck Categories

| Category | Symptoms | Tools |
|----------|----------|-------|
| **Network** | High TTFB, slow loading | Network tab, WebPageTest |
| **Database** | Slow queries, pool exhaustion | EXPLAIN ANALYZE, pg_stat_statements |
| **CPU** | High usage, slow compute | Profiler, flame graphs |
| **Memory** | Leaks, GC pauses | Heap snapshots |
| **Rendering** | Layout thrashing | React DevTools, Performance tab |

---

## Protocol References

### Database Optimization
**See: `references/database-optimization.md`**

Key topics covered:
- N+1 query detection and fixes with SQLAlchemy `selectinload`
- Index selection strategies (B-tree, GIN, HNSW, Hash)
- EXPLAIN ANALYZE interpretation
- Connection pooling configuration
- Cursor vs offset pagination

### Caching Strategies
**See: `references/caching-strategies.md`**

Key topics covered:
- Multi-level cache hierarchy (L1-L4)
- Cache-aside and write-through patterns
- Cache invalidation strategies (TTL, event-based, tag-based)
- Redis patterns (strings, hashes, lists, sets)
- Cache stampede prevention
- HTTP caching headers and ETags

### Core Web Vitals
**See: `references/core-web-vitals.md`**

Key topics covered:
- LCP optimization (images, SSR, critical CSS)
- INP optimization (debounce, Web Workers, task splitting)
- CLS optimization (image dimensions, font loading)
- Measuring with web-vitals library
- Lighthouse auditing

### Frontend Performance
**See: `references/frontend-performance.md`**

Key topics covered:
- Code splitting with React.lazy()
- Tree shaking and import optimization
- Image optimization (WebP, AVIF, lazy loading)
- Memoization (memo, useMemo, useCallback)
- List virtualization with @tanstack/react-virtual
- Bundle analysis tools

### Profiling Tools
**See: `references/profiling.md`**

Key topics covered:
- Python profiling (cProfile, py-spy, memory_profiler)
- Chrome DevTools Performance and Memory tabs
- React DevTools Profiler
- PostgreSQL query profiling (pg_stat_statements)
- Flame graph interpretation
- Load testing with k6 and Locust

---

## Quick Diagnostics

### Database

```sql
-- Find slow queries (PostgreSQL)
SELECT query, calls, mean_time / 1000 as mean_seconds
FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

-- Verify index usage
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
```

### Frontend

```bash
# Lighthouse audit
lighthouse http://localhost:3000 --output=json

# Bundle analysis
npx vite-bundle-visualizer  # Vite
ANALYZE=true npm run build  # Next.js
```

### Backend

```bash
# Profile running FastAPI server
py-spy record --pid $(pgrep -f uvicorn) --output profile.svg
```

---

## Monitoring Checklist

### Before Launch

- [ ] Lighthouse score > 90
- [ ] Core Web Vitals pass
- [ ] Bundle size within budget
- [ ] Database queries profiled
- [ ] Compression enabled
- [ ] CDN configured

### Ongoing

- [ ] Performance monitoring active
- [ ] Alerting for degradation
- [ ] Lighthouse CI in pipeline
- [ ] Weekly query analysis
- [ ] Real User Monitoring (RUM)

---

## Real-World Examples

### Hybrid Search Optimization

**Problem:** Retrieval pass rate was 87.2%, needed >90%

**Solution:** Increased RRF fetch multiplier from 2x to 3x, added metadata boosting

**Results:**
- Pass rate: 87.2% -> **91.6%** (+5.1%)
- MRR: 0.723 -> **0.777** (+7.4%)
- Query time: 85ms -> **5ms** (HNSW index)

### LLM Response Caching

**Problem:** LLM costs projected at $35k/year

**Solution:** Multi-level cache hierarchy (Claude prompt cache + Redis semantic cache)

**Results:**
- Baseline: **$35k/year** -> With caching: **$2-5k/year**
- Cost reduction: **85-95%**
- Latency: 2000ms -> 5-10ms (semantic cache hit)

### Vector Index Selection

**Problem:** Vector searches taking 85ms, needed <10ms

**Solution:** Switched from IVFFlat to HNSW index

**Results:**
- Query time: 85ms -> **5ms** (17x faster)
- Trade-off: Slower indexing (8s vs 2s) for faster queries

---

## Templates Reference

| Template | Purpose |
|----------|---------|
| `database-optimization.ts` | N+1 fixes, pagination, pooling |
| `caching-patterns.ts` | Redis cache-aside, memoization |
| `frontend-optimization.tsx` | React memo, virtualization, code splitting |
| `api-optimization.ts` | Compression, ETags, field selection |
| `performance-metrics.ts` | Prometheus metrics, performance budget |

---

## Extended Thinking Triggers

Use Opus 4.5 extended thinking for:
- **Complex debugging** - Multiple potential causes
- **Architecture decisions** - Caching strategy selection
- **Trade-off analysis** - Memory vs CPU vs latency
- **Root cause analysis** - Performance regression investigation

---

## Related Skills

- `caching-strategies` - Detailed Redis caching patterns and cache invalidation
- `database-schema-designer` - Indexing strategies and query optimization fundamentals
- `observability-monitoring` - Performance monitoring and alerting integration
- `devops-deployment` - CDN configuration and infrastructure optimization

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pagination strategy | Cursor-based for large datasets | Stable performance regardless of offset, handles concurrent inserts |
| Vector index type | HNSW over IVFFlat | 17x faster queries, worth slower indexing for read-heavy workloads |
| Cache hierarchy | Multi-level (L1-L4) | Optimizes hit rates, reduces load on expensive operations |
| Bundle splitting | Route-based code splitting | Reduces initial load, enables parallel downloads |

---

**Skill Version**: 1.2.0
**Last Updated**: 2026-01-15
**Maintained by**: AI Agent Hub Team

## Changelog

### v1.2.0 (2026-01-15)
- Refactored to reference-based structure
- Moved detailed content to references/ directory
- Reduced SKILL.md from 1079 to ~290 lines

### v1.1.0 (2025-12-25)
- Added comprehensive Frontend Bundle Analysis section
- Added React 19 performance patterns
- Added TanStack Virtual list virtualization

### v1.0.0 (2025-12-14)
- Initial skill with database optimization, caching, and profiling

---

## Capability Details

### database-optimization
**Keywords:** slow query, n+1, query optimization, explain analyze, index, postgres performance
**Solves:**
- How do I optimize slow database queries?
- Fix N+1 query problems with eager loading
- Use EXPLAIN ANALYZE to diagnose queries
- Add missing indexes for performance

### caching-strategies
**Keywords:** cache, redis, cdn, cache-aside, write-through, semantic cache
**Solves:**
- How do I implement multi-level caching?
- Cache-aside vs write-through patterns
- Semantic cache for LLM responses
- Cache invalidation strategies

### frontend-performance
**Keywords:** bundle size, lazy load, code splitting, tree shaking, lighthouse, web vitals
**Solves:**
- How do I reduce frontend bundle size?
- Implement code splitting with React.lazy()
- Optimize Lighthouse scores
- Fix Core Web Vitals issues

### core-web-vitals
**Keywords:** lcp, inp, cls, core web vitals, ttfb, fid
**Solves:**
- How do I improve Core Web Vitals?
- Optimize LCP (Largest Contentful Paint)
- Fix CLS (Cumulative Layout Shift)
- Improve INP (Interaction to Next Paint)

### profiling
**Keywords:** profile, flame graph, py-spy, chrome devtools, memory leak, cpu bottleneck
**Solves:**
- How do I profile my Python backend?
- Generate flame graphs with py-spy
- Profile React components with DevTools
- Find memory leaks in frontend

### bundle-analysis
**Keywords:** bundle analyzer, vite visualizer, webpack bundle, tree shaking
**Solves:**
- How do I analyze bundle size?
- Use Vite bundle visualizer
- Identify large dependencies
- Optimize bundle with tree shaking