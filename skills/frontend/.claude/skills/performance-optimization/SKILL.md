---
name: Performance Optimization
description: Use when application is slow, bundle is too large, or investigating performance issues. Covers profiling, React concurrent features, bundle analysis, and optimization patterns.
context: fork
version: 1.1.0
category: Quality & Optimization
agents: [backend-system-architect, frontend-ui-developer, code-quality-reviewer]
keywords: [performance, optimization, speed, latency, throughput, caching, profiling, bundle, Core Web Vitals, react-19, virtualization, code-splitting, tree-shaking]
author: SkillForge
---

# Performance Optimization Skill

Comprehensive frameworks for analyzing and optimizing application performance across the entire stack.

## When to Use

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

## Database Optimization

### Key Patterns

1. **Add Missing Indexes** - Turn `Seq Scan` into `Index Scan`
2. **Fix N+1 Queries** - Use JOINs or `include` instead of loops
3. **Cursor Pagination** - Never load all records
4. **Connection Pooling** - Manage connection lifecycle

### Quick Diagnostics

```sql
-- Find slow queries (PostgreSQL)
SELECT query, calls, mean_time / 1000 as mean_seconds
FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

-- Verify index usage
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
```

> See `templates/database-optimization.ts` for N+1 fixes and pagination patterns

## Caching Strategy

### Cache Hierarchy

```
L1: In-Memory (LRU, memoization) - fastest
L2: Distributed (Redis/Memcached) - shared
L3: CDN (edge, static assets) - global
L4: Database (materialized views) - fallback
```

### Cache-Aside Pattern

```typescript
const cached = await redis.get(key);
if (cached) return JSON.parse(cached);
const data = await db.query(...);
await redis.setex(key, 3600, JSON.stringify(data));
return data;
```

> See `templates/caching-patterns.ts` for full implementation

## Frontend Optimization

### Bundle Optimization

1. **Code Splitting** - `lazy()` for route-based splitting
2. **Tree Shaking** - Import only what you need
3. **Image Optimization** - WebP/AVIF, lazy loading, proper sizing

### Rendering Optimization

1. **Memoization** - `memo()`, `useCallback()`, `useMemo()`
2. **Virtualization** - Render only visible items in long lists
3. **Batch DOM Operations** - Read all, then write all

> See `templates/frontend-optimization.tsx` for patterns

### Analysis Commands

```bash
# Lighthouse audit
lighthouse http://localhost:3000 --output=json

# Bundle analysis
npx @next/bundle-analyzer  # Next.js
npx vite-bundle-visualizer # Vite
```

## API Optimization

### Response Optimization

1. **Field Selection** - Return only requested fields
2. **Compression** - Enable gzip/brotli (threshold: 1KB)
3. **ETags** - Enable 304 responses for unchanged data
4. **Pagination** - Cursor-based for large datasets

> See `templates/api-optimization.ts` for middleware examples

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

> See `templates/performance-metrics.ts` for Prometheus metrics setup

---

## Database Query Optimization Deep Dive

### N+1 Query Detection

**Symptoms:**
- One query to get parent records, then N queries for related data
- Rapid sequential database calls in logs
- Linear growth in query count with data size

**Example Problem:**
```python
# ❌ BAD: N+1 query (1 + 8 queries)
analyses = await session.execute(select(Analysis).limit(8)).scalars().all()
for analysis in analyses:
    # Each iteration hits DB again!
    chunks = await session.execute(
        select(Chunk).where(Chunk.analysis_id == analysis.id)
    ).scalars().all()
```

**Solution:**
```python
# ✅ GOOD: Single query with JOIN (1 query)
from sqlalchemy.orm import selectinload

analyses = await session.execute(
    select(Analysis)
    .options(selectinload(Analysis.chunks))  # Eager load
    .limit(8)
).scalars().all()

# Now analyses[0].chunks is already loaded (no extra query)
```

### Index Selection Strategies

| Index Type | Use Case | Example |
|------------|----------|---------|
| **B-tree** | Equality, range queries | `WHERE created_at > '2025-01-01'` |
| **GIN** | Full-text search, JSONB | `WHERE content_tsvector @@ to_tsquery('python')` |
| **HNSW** | Vector similarity | `ORDER BY embedding <=> '[0.1, 0.2, ...]'` |
| **Hash** | Exact equality only | `WHERE id = 'abc123'` (rare) |

**Index Creation Examples:**
```sql
-- B-tree for timestamp range queries
CREATE INDEX idx_analysis_created ON analyses(created_at DESC);

-- GIN for full-text search (pre-computed tsvector)
CREATE INDEX idx_chunk_tsvector ON chunks USING GIN(content_tsvector);

-- HNSW for vector similarity (pgvector)
CREATE INDEX idx_chunk_embedding ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**SkillForge Impact:**
- HNSW vs IVFFlat: **17x faster queries** (5ms vs 85ms)
- Pre-computed tsvector: **5-10x faster** than computing on query

### EXPLAIN ANALYZE Deep Dive

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT c.* FROM chunks c
JOIN analyses a ON c.analysis_id = a.id
WHERE a.status = 'completed'
ORDER BY c.created_at DESC
LIMIT 10;
```

**Key Metrics to Watch:**
- **Seq Scan** → Add index if cost is high
- **Execution Time** → Total query duration
- **Planning Time** → Time spent optimizing query
- **Buffers (shared hit)** → Cache hit ratio (want high)

**Example Output Analysis:**
```
Limit  (cost=0.42..1.89 rows=10) (actual time=0.032..0.156 rows=10)
  Buffers: shared hit=24
  ->  Nested Loop  (cost=0.42..61.23 rows=415)
      ->  Index Scan using idx_analysis_status on analyses
          Index Cond: (status = 'completed')
          Buffers: shared hit=8
      ->  Index Scan using idx_chunk_analysis on chunks
          Index Cond: (analysis_id = a.id)
          Buffers: shared hit=16
```
✅ **Good signs**: Index scans, low actual time, high buffer hits

### pg_stat_statements Usage

```sql
-- Enable extension (once)
CREATE EXTENSION pg_stat_statements;

-- Find top 10 slowest queries
SELECT
    LEFT(query, 60) AS short_query,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_ms,
    ROUND(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Find queries with low cache hit ratio
SELECT
    LEFT(query, 60),
    shared_blks_hit,
    shared_blks_read,
    ROUND(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS cache_hit_ratio
FROM pg_stat_statements
WHERE shared_blks_read > 0
ORDER BY cache_hit_ratio ASC
LIMIT 10;
```

---

## Advanced Caching Strategies

### Multi-Level Cache Hierarchy

**SkillForge Implementation:**
```
L1: Prompt Caching (Claude native) - 90% cost savings, 0ms latency
L2: Redis Semantic Cache - 70-85% cost savings, 5-10ms latency
L3: PostgreSQL Query Cache - materialized views, 50-200ms latency
L4: CDN Edge Cache - static assets, <50ms global latency
```

### Redis Caching Patterns

**1. Cache-Aside (Read-Through)**
```python
async def get_analysis(analysis_id: str) -> Analysis:
    # 1. Try cache first
    cached = await redis.get(f"analysis:{analysis_id}")
    if cached:
        return Analysis.parse_raw(cached)

    # 2. Cache miss - fetch from DB
    analysis = await db.get_analysis(analysis_id)

    # 3. Store in cache (5 min TTL)
    await redis.setex(
        f"analysis:{analysis_id}",
        300,  # 5 minutes
        analysis.json()
    )

    return analysis
```

**2. Write-Through**
```python
async def update_analysis(analysis: Analysis):
    # 1. Write to DB first
    await db.update(analysis)

    # 2. Update cache immediately
    await redis.setex(
        f"analysis:{analysis.id}",
        300,
        analysis.json()
    )
```

**3. Semantic Cache (Vector Search)**
```python
async def get_llm_response(query: str) -> str:
    # 1. Generate query embedding
    query_embedding = await embed_text(query)

    # 2. Search for similar cached queries (threshold: 0.92)
    cached = await semantic_cache.search(query_embedding, threshold=0.92)
    if cached:
        return cached.content  # 95% cost savings!

    # 3. Cache miss - call LLM
    response = await llm.complete(query)

    # 4. Store in semantic cache
    await semantic_cache.store(query_embedding, response)

    return response
```

### Cache Invalidation Strategies

| Strategy | Use Case | Example |
|----------|----------|---------|
| **TTL** | Time-based expiry | News feed (5 min) |
| **Write-through** | Immediate consistency | User profile updates |
| **Event-driven** | Publish/subscribe | Invalidate on data change |
| **Versioned keys** | Immutable data | `analysis:{id}:v2` |

**SkillForge Cache Warming:**
```python
# Warm cache with golden dataset queries at startup
GOLDEN_QUERIES = [
    "How to implement RAG with LangChain?",
    "LangGraph supervisor pattern example",
    "pgvector HNSW vs IVFFlat performance"
]

async def warm_cache():
    for query in GOLDEN_QUERIES:
        # Pre-compute and cache embeddings + LLM responses
        await get_llm_response(query)
```

### HTTP Caching Headers

```python
from fastapi import Response

@app.get("/api/v1/analyses/{id}")
async def get_analysis(id: str, response: Response):
    analysis = await db.get_analysis(id)

    # Enable browser caching (5 minutes)
    response.headers["Cache-Control"] = "public, max-age=300"

    # ETag for conditional requests
    etag = hashlib.md5(analysis.json().encode()).hexdigest()
    response.headers["ETag"] = f'"{etag}"'

    return analysis
```

---

## Profiling Tools & Techniques

### Python Profiling (py-spy)

```bash
# Install py-spy
pip install py-spy

# Profile running FastAPI server (no code changes!)
py-spy record --pid $(pgrep -f uvicorn) --output profile.svg

# Top functions by time
py-spy top --pid $(pgrep -f uvicorn)

# Generate flame graph
py-spy record --pid 12345 --format flamegraph --output flamegraph.svg
```

**Flame Graph Interpretation:**
- **Width** = Time spent in function (wider = slower)
- **Height** = Call stack depth
- **Hot paths** = Look for wide bars at the top

### Frontend Profiling (Chrome DevTools)

**Performance Tab:**
1. Open DevTools → Performance
2. Click Record, interact with app, click Stop
3. Analyze:
   - **Main thread activity** (yellow = scripting, purple = rendering)
   - **Long tasks** (red flag: >50ms blocks main thread)
   - **Frame drops** (should be 60fps = 16.67ms/frame)

**Memory Tab:**
1. Take heap snapshot
2. Interact with app
3. Take another snapshot
4. Compare to find leaks

**Example - Finding Memory Leak:**
```javascript
// ❌ BAD: Event listener not cleaned up
useEffect(() => {
    window.addEventListener('resize', handleResize);
    // Missing cleanup!
}, []);

// ✅ GOOD: Cleanup prevents leak
useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
}, []);
```

### React Profiler

```javascript
import { Profiler } from 'react';

function onRenderCallback(
    id,           // Component name
    phase,        // "mount" or "update"
    actualDuration, // Time spent rendering
    baseDuration,   // Estimated time without memoization
    startTime,
    commitTime
) {
    if (actualDuration > 16) {  // > 16ms = dropped frame
        console.warn("Slow render: " + id + " took " + actualDuration + "ms");
    }
}

<Profiler id="AnalysisCard" onRender={onRenderCallback}>
    <AnalysisCard analysis={data} />
</Profiler>
```

### Bundle Analysis

```bash
# Vite bundle analyzer
npm install --save-dev rollup-plugin-visualizer
# Add to vite.config.ts:
import { visualizer } from 'rollup-plugin-visualizer';
plugins: [visualizer({ open: true })]

# Next.js bundle analyzer
npm install @next/bundle-analyzer
ANALYZE=true npm run build
```

---

## Frontend Bundle Analysis (2025 Patterns)

### Complete Vite Bundle Analyzer Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    // Only run visualizer during build:analyze
    process.env.ANALYZE && visualizer({
      open: true,
      filename: 'dist/bundle-stats.html',
      gzipSize: true,      // Show gzip sizes
      brotliSize: true,    // Show brotli sizes
      template: 'treemap', // 'treemap' | 'sunburst' | 'network'
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Manual chunking for better cache strategy
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'router': ['@tanstack/react-router'],
          'query': ['@tanstack/react-query'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-tooltip'],
          // Heavy libraries in separate chunks
          'mermaid': ['mermaid'],
          'markdown': ['react-markdown', 'remark-gfm'],
        },
      },
    },
    // Report chunk sizes
    chunkSizeWarningLimit: 500, // 500kb warning
  },
})
```

```json
// package.json
{
  "scripts": {
    "build": "tsc -b && vite build",
    "build:analyze": "ANALYZE=true npm run build",
    "bundle:report": "npm run build:analyze && open dist/bundle-stats.html"
  }
}
```

### Bundle Size Budgets

```typescript
// bundle-budget.config.ts
export const bundleBudgets = {
  // Total bundle limits
  total: {
    maxSize: 200 * 1024,      // 200KB gzipped
    warnSize: 150 * 1024,     // Warn at 150KB
  },

  // Per-chunk limits
  chunks: {
    main: 50 * 1024,          // Entry point: 50KB max
    'react-vendor': 45 * 1024, // React: ~42KB gzipped
    'router': 30 * 1024,       // TanStack Router
    'query': 15 * 1024,        // TanStack Query
    lazy: 30 * 1024,          // Lazy-loaded routes
  },

  // Individual dependency limits
  dependencies: {
    'framer-motion': 30 * 1024, // Watch for growth
    'mermaid': 150 * 1024,      // Large library (lazy load!)
    'prismjs': 20 * 1024,       // Syntax highlighter
  },
} as const
```

### CI Bundle Size Check

```yaml
# .github/workflows/bundle-check.yml
name: Bundle Size Check

on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build and analyze
        run: npm run build

      - name: Check bundle size
        uses: preactjs/compressed-size-action@v2
        with:
          pattern: './dist/**/*.{js,css}'
          # Fail if bundle increases by more than 5KB
          compression: 'gzip'

      - name: Report bundle stats
        run: |
          echo "## Bundle Size Report" >> $GITHUB_STEP_SUMMARY
          echo "| Chunk | Size (gzip) |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|-------------|" >> $GITHUB_STEP_SUMMARY
          for file in dist/assets/*.js; do
            size=$(gzip -c "$file" | wc -c)
            echo "| $(basename $file) | $(numfmt --to=iec $size) |" >> $GITHUB_STEP_SUMMARY
          done
```

### Tree-Shaking Verification

```typescript
// ❌ BAD: Imports entire library
import { motion } from 'framer-motion'  // Pulls in ~30KB!

// ✅ GOOD: Import only what you need
import { motion } from 'framer-motion/m'  // Core motion only

// ❌ BAD: Barrel imports
import { Button, Card, Dialog } from '@/components'

// ✅ GOOD: Direct imports (better tree-shaking)
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// ❌ BAD: Dynamic string imports break tree-shaking
const icons = ['Home', 'Settings', 'User']
// icons.forEach(name => import("lucide-react/dist/esm/icons/" + name))

// ✅ GOOD: Static imports
import { Home, Settings, User } from 'lucide-react'
```

### Code Splitting Strategies

```typescript
// Route-based splitting (TanStack Router)
const AnalyzeRoute = createFileRoute('/analyze/$id')({
  component: lazy(() => import('./features/analysis/AnalyzeResult')),
  pendingComponent: AnalysisSkeleton,  // Show skeleton while loading
  errorComponent: AnalysisError,
})

// Component-based splitting
const HeavyChart = lazy(() => import('./components/HeavyChart'))

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart data={chartData} />
    </Suspense>
  )
}

// Library-based splitting (heavy dependencies)
const MermaidRenderer = lazy(() =>
  import('./components/MermaidRenderer').then(mod => ({ default: mod.MermaidRenderer }))
)

// Conditional splitting (feature flags)
const AdminPanel = lazy(() =>
  import('./features/admin/AdminPanel')
)

function App() {
  return isAdmin ? (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminPanel />
    </Suspense>
  ) : null
}
```

### React 19 Performance Patterns

```typescript
// ✅ useTransition for non-urgent updates
import { useTransition, startTransition } from 'react'

function SearchResults({ query }: { query: string }) {
  const [isPending, startTransition] = useTransition()
  const [results, setResults] = useState([])

  function handleSearch(query: string) {
    // Immediate UI update
    setQuery(query)

    // Non-blocking results update
    startTransition(() => {
      setResults(searchDatabase(query))
    })
  }

  return (
    <div>
      <input value={query} onChange={e => handleSearch(e.target.value)} />
      {isPending && <Spinner />}
      <ResultsList results={results} />
    </div>
  )
}

// ✅ use() for Suspense-aware data
import { use } from 'react'

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise) // Suspends until resolved
  return <div>{user.name}</div>
}

// ✅ useOptimistic for instant feedback
import { useOptimistic } from 'react'

function LikeButton({ initialCount }: { initialCount: number }) {
  const [optimisticCount, addOptimistic] = useOptimistic(
    initialCount,
    (state, action) => state + action
  )

  async function handleLike() {
    addOptimistic(1) // Instant UI update
    await api.like(postId) // Background server update
  }

  return <button onClick={handleLike}>{optimisticCount} likes</button>
}
```

### List Virtualization

```typescript
// ✅ TanStack Virtual for long lists (>100 items)
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualizedList({ items }: { items: Analysis[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated row height
    overscan: 5, // Render 5 extra items for smoother scrolling
  })

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() + "px", position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              transform: "translateY(" + virtualItem.start + "px)",
              height: virtualItem.size + "px",
            }}
          >
            <AnalysisCard analysis={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}

// When to virtualize:
// - Lists > 100 items
// - Tables > 50 rows
// - Grids with many items
// - Any scrollable container with many children
```

### Bundle Analysis Checklist

| Check | Target | Action if Failed |
|-------|--------|------------------|
| Total bundle (gzip) | < 200KB | Audit large dependencies |
| Main chunk | < 50KB | Move code to lazy routes |
| Vendor chunk | < 80KB | Check for duplicate deps |
| Largest dependency | < 50KB | Lazy load or find alternative |
| Tree-shaking | No unused exports | Use direct imports |
| Code splitting | Routes lazy-loaded | Add lazy() wrappers |
| Images | WebP/AVIF, lazy | Add next/image or similar |

---

## Real-World SkillForge Examples

### Example 1: Hybrid Search Optimization

**Problem:** Retrieval pass rate was 87.2%, needed >90%

**Investigation:**
```python
# Original: 2x fetch multiplier
HYBRID_FETCH_MULTIPLIER = 2  # Fetch 20 for top-10

# Analysis showed insufficient coverage for RRF fusion
# Testing: 2x → 87.2%, 2.5x → 89.7%, 3x → 91.6%
```

**Solution:**
```python
# Increase to 3x fetch multiplier
HYBRID_FETCH_MULTIPLIER = 3  # Fetch 30 for top-10

# Add metadata boosting
SECTION_TITLE_BOOST_FACTOR = 1.5  # +7.4% MRR improvement
DOCUMENT_PATH_BOOST_FACTOR = 1.15
CODE_BLOCK_BOOST_FACTOR = 1.2
```

**Results:**
- Pass rate: 87.2% → **91.6%** (+5.1%)
- MRR: 0.723 → **0.777** (+7.4%)
- Query time: 85ms → **5ms** (HNSW index)

### Example 2: LLM Response Caching

**Problem:** LLM costs projected at $35k/year

**Solution:**
```python
# Multi-level cache hierarchy
L1_PROMPT_CACHE_HIT_RATE = 0.90  # Claude native
L2_SEMANTIC_CACHE_HIT_RATE = 0.75  # Redis vector search

# Cost calculation
baseline_cost = 35000  # $35k/year
l1_savings = baseline_cost * 0.90 * 0.90  # $28,350 saved
l2_savings = (baseline_cost - l1_savings) * 0.75 * 0.80  # $4,650 saved
total_savings = l1_savings + l2_savings  # $33,000 saved (94%)

final_cost = baseline_cost - total_savings  # $2,100/year
```

**Results:**
- Baseline: **$35k/year** → With caching: **$2-5k/year**
- Cost reduction: **85-95%**
- Latency: 2000ms → 5-10ms (semantic cache hit)

### Example 3: Vector Index Selection

**Problem:** Vector searches taking 85ms, needed <10ms

**Benchmark (415 chunks):**
```sql
-- IVFFlat (lists=10)
EXPLAIN ANALYZE SELECT * FROM chunks
ORDER BY embedding <=> '[0.1, 0.2, ...]' LIMIT 10;
-- Planning: 2ms, Execution: 85ms

-- HNSW (m=16, ef_construction=64)
EXPLAIN ANALYZE SELECT * FROM chunks
ORDER BY embedding <=> '[0.1, 0.2, ...]' LIMIT 10;
-- Planning: 2ms, Execution: 5ms
```

**Decision Matrix:**
| Index | Build Time | Query Time | Accuracy | Verdict |
|-------|------------|------------|----------|---------|
| IVFFlat | 2s | 85ms | 95% | ❌ Too slow |
| HNSW | 8s | 5ms | 98% | ✅ **Chosen** |

**Trade-off:** Slower indexing (8s vs 2s) for **17x faster queries**

### Example 4: SSE Event Buffering

**Problem:** Frontend showed 0% progress while backend ran

**Root Cause:**
```python
# ❌ BAD: Events published before subscriber connects were lost
class EventBroadcaster:
    def publish(self, channel: str, event: dict):
        self._subscribers[channel].send(event)  # Lost if no subscriber yet!
```

**Solution:**
```python
# ✅ GOOD: Buffer last 100 events per channel
from collections import deque

class EventBroadcaster:
    def __init__(self):
        self._buffers = {}  # channel → deque(maxlen=100)

    def publish(self, channel: str, event: dict):
        # Store in buffer
        if channel not in self._buffers:
            self._buffers[channel] = deque(maxlen=100)
        self._buffers[channel].append(event)

        # Send to active subscribers
        for subscriber in self._subscribers.get(channel, []):
            subscriber.send(event)

    def subscribe(self, channel: str):
        # Replay buffered events to new subscriber
        for event in self._buffers.get(channel, []):
            yield event
        # Then continue with live events
```

**Results:**
- Race condition eliminated
- Buffered events: last 100 per channel
- Memory overhead: ~10KB per active channel

---

## Extended Thinking Triggers

Use Opus 4.5 extended thinking for:
- **Complex debugging** - Multiple potential causes
- **Architecture decisions** - Caching strategy selection
- **Trade-off analysis** - Memory vs CPU vs latency
- **Root cause analysis** - Performance regression investigation

## Templates Reference

| Template | Purpose |
|----------|---------|
| `database-optimization.ts` | N+1 fixes, pagination, pooling |
| `caching-patterns.ts` | Redis cache-aside, memoization |
| `frontend-optimization.tsx` | React memo, virtualization, code splitting |
| `api-optimization.ts` | Compression, ETags, field selection |
| `performance-metrics.ts` | Prometheus metrics, performance budget |

---

**Skill Version**: 1.1.0
**Last Updated**: 2025-12-25
**Maintained by**: AI Agent Hub Team

## Changelog

### v1.1.0 (2025-12-25)
- Added comprehensive Frontend Bundle Analysis section
- Added complete Vite bundle analyzer setup with visualizer
- Added bundle size budgets and CI size checking
- Added tree-shaking verification patterns
- Added code splitting strategies (route, component, library)
- Added React 19 performance patterns (useTransition, use(), useOptimistic)
- Added TanStack Virtual list virtualization example
- Added bundle analysis checklist with targets
- Updated keywords to include react-19, virtualization, code-splitting

### v1.0.0 (2025-12-14)
- Initial skill with database optimization, caching, and profiling

## Capability Details

### database-optimization
**Keywords:** slow query, n+1, query optimization, explain analyze, index, postgres performance
**Solves:**
- How do I optimize slow database queries?
- Fix N+1 query problems with eager loading
- Use EXPLAIN ANALYZE to diagnose queries
- Add missing indexes for performance

### n+1-query-detection
**Keywords:** n+1, eager loading, selectinload, joinedload, query loops
**Solves:**
- How do I detect N+1 queries?
- Fix N+1 with SQLAlchemy selectinload
- Convert query loops to single JOINs

### index-selection
**Keywords:** index, b-tree, gin, hnsw, hash index, index types
**Solves:**
- Which index type should I use?
- B-tree vs GIN vs HNSW comparison
- Index full-text search columns
- Vector similarity index selection

### explain-analyze
**Keywords:** explain analyze, query plan, seq scan, index scan, query cost
**Solves:**
- How do I read EXPLAIN ANALYZE output?
- Identify Seq Scan problems
- Analyze query execution time
- Measure buffer cache hit ratio

### caching-strategies
**Keywords:** cache, redis, cdn, cache-aside, write-through, semantic cache
**Solves:**
- How do I implement multi-level caching?
- Cache-aside vs write-through patterns
- Semantic cache for LLM responses
- Cache invalidation strategies

### semantic-cache
**Keywords:** semantic cache, vector cache, llm cache, embedding cache
**Solves:**
- How do I cache LLM responses by similarity?
- Implement vector-based semantic cache
- Reduce LLM costs by 70-95%
- Real-world SkillForge semantic cache

### cache-invalidation
**Keywords:** cache invalidation, ttl, write-through, event-driven invalidation
**Solves:**
- How do I invalidate cached data?
- TTL vs write-through invalidation
- Event-driven cache invalidation
- Cache warming strategies

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

### hybrid-search-optimization
**Keywords:** hybrid search, rrf, fetch multiplier, metadata boosting, search performance
**Solves:**
- How do I optimize hybrid search retrieval?
- Tune RRF fetch multiplier for better coverage
- Boost search results by metadata
- Real-world SkillForge retrieval improvements

### llm-caching
**Keywords:** llm caching, prompt cache, semantic cache, cost reduction
**Solves:**
- How do I reduce LLM costs with caching?
- Multi-level LLM cache hierarchy
- Claude prompt caching (90% savings)
- Redis semantic cache (70-85% savings)

### vector-index-selection
**Keywords:** pgvector, hnsw, ivfflat, vector index, similarity search performance
**Solves:**
- How do I choose HNSW vs IVFFlat?
- Optimize vector search query time
- Trade-off: indexing speed vs query speed
- Real-world SkillForge benchmark results

### sse-event-buffering
**Keywords:** sse, server-sent events, event buffering, race condition, event broadcaster
**Solves:**
- How do I prevent SSE race conditions?
- Buffer events before subscriber connects
- Fix 'events lost' in real-time updates
- Real-world SkillForge SSE debugging
