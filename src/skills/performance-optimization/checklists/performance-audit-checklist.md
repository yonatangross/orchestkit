# Performance Audit Checklist

Comprehensive guide for identifying and fixing performance bottlenecks, based on OrchestKit's real optimization process.

## Prerequisites

- [ ] Access to production metrics (Prometheus, Grafana)
- [ ] Profiling tools installed (py-spy, Chrome DevTools)
- [ ] Baseline performance metrics captured
- [ ] Test environment with production-like data

## Phase 1: Establish Baselines

### Backend Metrics

**Capture current performance:**

```bash
# Database query performance
psql -c "SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY total_time DESC LIMIT 20;"

# API latency
curl 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'

# Cache hit rate
curl 'http://localhost:9090/api/v1/query?query=sum(rate(cache_operations_total{result="hit"}[5m])) / sum(rate(cache_operations_total[5m]))'
```

- [ ] Record p50/p95/p99 latency for all endpoints
- [ ] Document slow queries (>100ms)
- [ ] Measure cache hit rates
- [ ] Capture database connection pool usage
- [ ] Record LLM token usage and costs

### Frontend Metrics

**Run Lighthouse audit:**

```bash
# Lighthouse CLI
lighthouse http://localhost:3000 \
  --output json \
  --output-path lighthouse-report.json

# Or use Chrome DevTools → Lighthouse tab
```

- [ ] Record Core Web Vitals (LCP, INP, CLS, TTFB)
- [ ] Measure bundle size (JS, CSS)
- [ ] Check for render-blocking resources
- [ ] Analyze long tasks (>50ms)
- [ ] Measure First Contentful Paint (FCP)

### Baseline Targets

| Metric | Good | Needs Work | Current |
|--------|------|------------|---------|
| p95 API latency | <500ms | <1s | ___ms |
| p95 DB query | <100ms | <500ms | ___ms |
| Cache hit rate | >70% | >50% | __% |
| LCP | <2.5s | <4s | ___s |
| INP | <200ms | <500ms | ___ms |
| CLS | <0.1 | <0.25 | ___ |
| Bundle size | <300KB | <500KB | ___KB |

## Phase 2: Identify Bottlenecks

### Backend Profiling

**1. Find Slow Endpoints**

```promql
# Top 10 slowest endpoints (p95 latency)
topk(10,
  histogram_quantile(0.95,
    rate(http_request_duration_seconds_bucket[5m])
  ) by (endpoint)
)
```

- [ ] List endpoints with p95 > 500ms
- [ ] Prioritize by traffic volume (high traffic = high impact)
- [ ] Document expected vs actual latency

**2. Identify Slow Database Queries**

```sql
-- Top 10 slowest queries
SELECT
    LEFT(query, 80) as query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) as avg_ms,
    ROUND(total_exec_time::numeric, 2) as total_ms,
    ROUND(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 2) as cache_hit_ratio
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

- [ ] Run EXPLAIN ANALYZE on slow queries
- [ ] Check for sequential scans (should use indexes)
- [ ] Look for low cache hit ratios (<90%)
- [ ] Identify N+1 query patterns

**3. Python Profiling with py-spy**

```bash
# Profile running FastAPI server
py-spy record --pid $(pgrep -f uvicorn) \
  --output profile.svg \
  --duration 60

# Top functions by time
py-spy top --pid $(pgrep -f uvicorn)
```

- [ ] Generate flame graph
- [ ] Identify hot paths (wide bars = time spent)
- [ ] Look for unexpected CPU usage
- [ ] Check for blocking I/O in async code

**4. LLM Cost Analysis**

```sql
-- Cost breakdown by model (Langfuse)
SELECT
    model,
    COUNT(*) as calls,
    SUM(input_tokens) as total_input,
    SUM(output_tokens) as total_output,
    SUM(calculated_total_cost) as total_cost
FROM langfuse.traces
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY model
ORDER BY total_cost DESC;
```

- [ ] Identify most expensive models
- [ ] Calculate cache hit rate potential
- [ ] Find repetitive queries (caching candidates)
- [ ] Measure prompt token waste

### Frontend Profiling

**1. Chrome DevTools Performance Tab**

- [ ] Record 6s of user interaction
- [ ] Identify long tasks (yellow bars >50ms)
- [ ] Check for dropped frames (should be 60fps)
- [ ] Measure main thread blocking time

**2. React DevTools Profiler**

```javascript
// Add Profiler to key components
import { Profiler } from 'react';

function onRenderCallback(
    id, phase, actualDuration, baseDuration
) {
    if (actualDuration > 16) {
        console.warn(`Slow render: ${id} took ${actualDuration}ms`);
    }
}

<Profiler id="AnalysisCard" onRender={onRenderCallback}>
    <AnalysisCard />
</Profiler>
```

- [ ] Find components with >16ms render time
- [ ] Identify unnecessary re-renders
- [ ] Check for missing memoization

**3. Bundle Analysis**

```bash
# Vite
npm run build
npx vite-bundle-visualizer

# Next.js
ANALYZE=true npm run build
```

- [ ] Identify largest chunks
- [ ] Find duplicate dependencies
- [ ] Check for tree-shaking failures
- [ ] Measure code splitting effectiveness

## Phase 3: Database Optimization

### Add Missing Indexes

**1. Identify Missing Indexes**

```sql
-- Find sequential scans that should use indexes
SELECT
    schemaname,
    tablename,
    seq_scan,
    idx_scan,
    seq_scan - idx_scan as too_much_seq
FROM pg_stat_user_tables
WHERE seq_scan - idx_scan > 0
ORDER BY too_much_seq DESC
LIMIT 10;
```

- [ ] Run EXPLAIN ANALYZE on slow queries
- [ ] Look for "Seq Scan" in query plans
- [ ] Identify columns in WHERE/JOIN clauses
- [ ] Create indexes for high-cardinality columns

**2. Create Indexes**

```sql
-- B-tree for exact matches and ranges
CREATE INDEX idx_analysis_status ON analyses(status);
CREATE INDEX idx_analysis_created ON analyses(created_at DESC);

-- GIN for full-text search
CREATE INDEX idx_chunk_tsvector ON chunks USING GIN(content_tsvector);

-- HNSW for vector similarity (pgvector)
CREATE INDEX idx_chunk_embedding ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Composite index for common filter combinations
CREATE INDEX idx_chunk_analysis_created ON chunks(analysis_id, created_at DESC);
```

- [ ] Create indexes for WHERE clause columns
- [ ] Use composite indexes for multi-column filters
- [ ] Add indexes for JOIN columns
- [ ] Use CONCURRENTLY for production
- [ ] Verify indexes are used (EXPLAIN ANALYZE)

**Index Selection Guide:**
| Query Pattern | Index Type | Example |
|---------------|------------|---------|
| Exact match | B-tree | `WHERE status = 'completed'` |
| Range query | B-tree | `WHERE created_at > '2025-01-01'` |
| Full-text search | GIN | `WHERE content_tsvector @@ query` |
| Vector similarity | HNSW | `ORDER BY embedding <=> query_vec` |
| JSONB queries | GIN | `WHERE metadata @> '{"key": "value"}'` |

### Fix N+1 Queries

**1. Detect N+1 Patterns**

```python
# ❌ BAD: N+1 query (1 query + N queries in loop)
analyses = await session.execute(select(Analysis).limit(10))
for analysis in analyses.scalars():
    # Each iteration = 1 query!
    chunks = await session.execute(
        select(Chunk).where(Chunk.analysis_id == analysis.id)
    )
```

- [ ] Review logs for rapid sequential queries
- [ ] Check for queries inside loops
- [ ] Use query count logging in tests

**2. Fix with Eager Loading**

```python
# ✅ GOOD: Single query with JOIN
from sqlalchemy.orm import selectinload

analyses = await session.execute(
    select(Analysis)
    .options(selectinload(Analysis.chunks))  # Eager load
    .limit(10)
).scalars().all()

# Now analyses[0].chunks is preloaded (no extra query)
```

- [ ] Replace lazy loading with eager loading
- [ ] Use `selectinload()` for one-to-many
- [ ] Use `joinedload()` for one-to-one
- [ ] Verify query count reduced (N+1 → 1-2 queries)

### Optimize Connection Pooling

**1. Check Current Pool Usage**

```promql
# Connection pool saturation
db_connections_active / db_connections_max
```

- [ ] Measure active vs max connections
- [ ] Check for pool exhaustion (ratio >0.8)
- [ ] Monitor connection wait times

**2. Configure Pool**

```python
# backend/app/core/config.py
from sqlalchemy import create_engine

engine = create_engine(
    database_url,
    pool_size=5,           # Connections to maintain
    max_overflow=10,       # Extra connections allowed
    pool_recycle=3600,     # Recycle after 1 hour
    pool_pre_ping=True     # Validate before checkout
)
```

- [ ] Set pool_size based on traffic (5-20 typical)
- [ ] Allow overflow for spikes
- [ ] Enable pool_pre_ping for stale detection
- [ ] Set pool_recycle to avoid timeouts

## Phase 4: Caching Strategy

### Identify Caching Opportunities

**1. Find Repetitive Queries**

```sql
-- Most frequently called queries
SELECT
    LEFT(query, 80),
    calls,
    ROUND(mean_exec_time::numeric, 2) as avg_ms
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;
```

- [ ] Identify high-frequency queries
- [ ] Check if data changes frequently
- [ ] Calculate potential savings (calls × avg_time)

**2. Find Repetitive LLM Calls**

```sql
-- Similar prompts (Langfuse)
SELECT
    LEFT(input::text, 100) as prompt_preview,
    COUNT(*) as occurrences,
    SUM(calculated_total_cost) as total_cost
FROM langfuse.generations
GROUP BY LEFT(input::text, 100)
HAVING COUNT(*) > 5
ORDER BY total_cost DESC;
```

- [ ] Identify repetitive prompts
- [ ] Calculate cost savings potential
- [ ] Determine appropriate cache TTL

### Implement Multi-Level Cache

**L1: In-Memory Cache (Application)**

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def get_agent_system_prompt(agent_type: str) -> str:
    """Cache agent prompts in memory."""
    return load_prompt_from_file(f"prompts/{agent_type}.txt")
```

- [ ] Cache static data (prompts, configs)
- [ ] Use LRU cache for bounded memory
- [ ] Set appropriate maxsize (128-1024)

**L2: Redis Cache (Distributed)**

```python
async def get_analysis(analysis_id: str) -> Analysis:
    """Cache analysis results in Redis."""

    # Try cache first
    cached = await redis.get(f"analysis:{analysis_id}")
    if cached:
        return Analysis.parse_raw(cached)

    # Cache miss - fetch from DB
    analysis = await db.get_analysis(analysis_id)

    # Store in cache (5 min TTL)
    await redis.setex(
        f"analysis:{analysis_id}",
        300,
        analysis.json()
    )

    return analysis
```

- [ ] Cache query results
- [ ] Set appropriate TTL (seconds to hours)
- [ ] Invalidate on writes
- [ ] Track cache hit rate

**L3: Semantic Cache (Vector Search)**

```python
async def get_llm_response(query: str) -> str:
    """Check semantic cache before calling LLM."""

    # Generate query embedding
    embedding = await embed_text(query)

    # Search for similar cached queries
    cached = await semantic_cache.search(embedding, threshold=0.92)
    if cached:
        return cached.response

    # Call LLM
    response = await llm.complete(query)

    # Store in cache
    await semantic_cache.store(embedding, response)

    return response
```

- [ ] Cache LLM responses by semantic similarity
- [ ] Set similarity threshold (0.90-0.95)
- [ ] Measure cost savings
- [ ] Monitor false positive rate

### Cache Invalidation

**Write-Through Pattern:**
```python
async def update_analysis(analysis: Analysis):
    """Update DB and cache atomically."""

    # 1. Write to DB
    await db.update(analysis)

    # 2. Update cache
    await redis.setex(
        f"analysis:{analysis.id}",
        300,
        analysis.json()
    )
```

- [ ] Invalidate cache on writes
- [ ] Use TTL for time-sensitive data
- [ ] Add cache versioning for schema changes

## Phase 5: Frontend Optimization

### Code Splitting

**1. Route-Based Splitting**

```typescript
// Before: All routes in one bundle
import AnalysisPage from './pages/AnalysisPage';
import DashboardPage from './pages/DashboardPage';

// After: Lazy load routes
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

<Suspense fallback={<Loading />}>
    <Routes>
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
</Suspense>
```

- [ ] Lazy load routes
- [ ] Add loading states
- [ ] Measure bundle size reduction

**2. Component-Level Splitting**

```typescript
// Lazy load heavy components
const ChartComponent = lazy(() => import('./ChartComponent'));

{showChart && (
    <Suspense fallback={<Skeleton />}>
        <ChartComponent data={data} />
    </Suspense>
)}
```

- [ ] Split large dependencies (charts, editors)
- [ ] Use dynamic imports for modals
- [ ] Prefetch on user intent (hover, focus)

### Memoization

**React.memo for Components:**

```typescript
// Prevent re-renders when props unchanged
const AnalysisCard = memo(({ analysis }: Props) => {
    return <div>{analysis.title}</div>;
});
```

- [ ] Wrap expensive components with memo()
- [ ] Verify props don't change unnecessarily
- [ ] Use React DevTools Profiler to confirm

**useMemo for Expensive Calculations:**

```typescript
const expensiveValue = useMemo(() => {
    return processLargeDataset(data);
}, [data]);  // Only recompute if data changes
```

- [ ] Memoize expensive calculations
- [ ] Memoize filtered/sorted arrays
- [ ] Don't over-memoize (profiling first!)

**useCallback for Event Handlers:**

```typescript
const handleClick = useCallback(() => {
    doSomething(id);
}, [id]);  // Only recreate if id changes

<ChildComponent onClick={handleClick} />
```

- [ ] Wrap callbacks passed to memoized children
- [ ] Avoid inline functions in props
- [ ] Include all dependencies

### Image Optimization

```typescript
// Use next/image or similar for optimization
<Image
    src="/photo.jpg"
    alt="Description"
    width={800}
    height={600}
    loading="lazy"  // Lazy load images
    placeholder="blur"  // Show blur while loading
/>
```

- [ ] Use WebP/AVIF formats
- [ ] Lazy load images below the fold
- [ ] Set explicit width/height (prevent CLS)
- [ ] Use responsive images (srcset)

## Phase 6: Measure Impact

### Re-Run Benchmarks

**Backend:**
```bash
# Query performance
psql -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# API latency
curl 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'
```

**Frontend:**
```bash
lighthouse http://localhost:3000 --output json
```

- [ ] Compare p95 latency (before vs after)
- [ ] Verify query performance improved
- [ ] Check cache hit rates increased
- [ ] Measure Core Web Vitals improvement

### Calculate Savings

**Cost Savings:**
```python
# LLM cost reduction
baseline_cost = 35000  # Annual
cache_hit_rate = 0.90
savings = baseline_cost * cache_hit_rate * 0.90  # 90% discount on cache hits
final_cost = baseline_cost - savings
```

**Performance Gains:**
```python
# Query speedup
before_latency = 85  # ms
after_latency = 5    # ms
speedup = before_latency / after_latency  # 17x
```

- [ ] Document cost savings
- [ ] Calculate ROI (savings vs implementation time)
- [ ] Measure user experience improvement

### Create Performance Budget

**Set ongoing targets:**
- [ ] p95 API latency < 500ms
- [ ] p95 DB query < 100ms
- [ ] Cache hit rate > 70%
- [ ] LCP < 2.5s
- [ ] Bundle size < 300KB

**Monitor continuously:**
- [ ] Add Lighthouse CI to pipeline
- [ ] Alert on budget violations
- [ ] Review metrics weekly

## Phase 7: Ongoing Optimization

### Weekly Reviews

- [ ] Review top 10 slowest endpoints
- [ ] Check for new slow queries
- [ ] Monitor cache hit rates
- [ ] Review LLM cost trends
- [ ] Check Core Web Vitals in RUM

### Monthly Audits

- [ ] Run full Lighthouse audit
- [ ] Profile with py-spy/Chrome DevTools
- [ ] Review database index usage
- [ ] Check for unused dependencies
- [ ] Update performance budget

### Continuous Monitoring

- [ ] Set up alerts for degradation
- [ ] Track performance in CI/CD
- [ ] Monitor real user metrics (RUM)
- [ ] A/B test optimizations

## References

- Example: `../examples/orchestkit-performance-wins.md`
- Template: `../scripts/caching-patterns.ts`
- Template: `../scripts/database-optimization.ts`
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Lighthouse Documentation](https://developer.chrome.com/docs/lighthouse/)
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
