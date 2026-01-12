# Performance Profiling

Tools and techniques for identifying performance bottlenecks.

## Profiling Workflow

1. **Measure** - Establish baseline metrics
2. **Profile** - Identify bottlenecks
3. **Optimize** - Fix the slowest operations first
4. **Verify** - Measure improvement
5. **Repeat** - Iterate until targets met

## Backend Profiling (Python)

### 1. cProfile (Built-in)

```bash
# Profile entire script
python -m cProfile -s cumulative backend/app/main.py

# Save profile for analysis
python -m cProfile -o profile.prof backend/app/main.py

# Analyze with snakeviz
pip install snakeviz
snakeviz profile.prof  # Opens interactive flame graph
```

### 2. py-spy (Sampling Profiler)

```bash
# Install
pip install py-spy

# Profile running process
sudo py-spy top --pid 12345

# Generate flame graph
sudo py-spy record -o profile.svg --pid 12345 --duration 60

# Profile from start
py-spy record -o profile.svg -- python app.py
```

### 3. memory_profiler

```bash
# Install
pip install memory_profiler

# Decorate functions to profile
from memory_profiler import profile

@profile
def expensive_function():
    data = [0] * (10 ** 6)  # 1M integers
    return sum(data)

# Run with profiling
python -m memory_profiler script.py
```

### 4. Line Profiler

```python
# Install
pip install line_profiler

# Add decorator
from line_profiler import profile

@profile
def slow_function():
    result = 0
    for i in range(1000000):
        result += i
    return result

# Run with kernprof
kernprof -l -v script.py
```

## Frontend Profiling

### 1. Chrome DevTools Performance Tab

**Steps:**
1. Open DevTools (F12)
2. Go to Performance tab
3. Click Record (Cmd+E)
4. Interact with page
5. Stop recording
6. Analyze flame graph

**What to Look For:**
- Long tasks (> 50ms) - shows as red in timeline
- Layout/reflow - indicates DOM thrashing
- Scripting time - JavaScript execution
- Rendering time - paint and composite

### 2. React DevTools Profiler

```typescript
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}

<Profiler id="AnalysisList" onRender={onRenderCallback}>
  <AnalysisList analyses={analyses} />
</Profiler>
```

**In DevTools:**
1. Open React DevTools
2. Go to Profiler tab
3. Click Record
4. Interact with app
5. Stop and analyze

**What to Look For:**
- Components that render frequently but haven't changed
- Components with long render times
- Unnecessary re-renders (use `memo()`)

### 3. Lighthouse Performance Audit

```bash
# CLI
npm install -g lighthouse
lighthouse https://localhost:3000 --view

# Or use Chrome DevTools → Lighthouse tab
```

**Metrics Analyzed:**
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Speed Index
- Time to Interactive (TTI)
- Total Blocking Time (TBT)
- Cumulative Layout Shift (CLS)

### 4. Bundle Analyzer

```bash
# Next.js
npm install @next/bundle-analyzer
ANALYZE=true npm run build

# Vite
npm install -D rollup-plugin-visualizer
npx vite-bundle-visualizer

# Webpack
npm install -D webpack-bundle-analyzer
webpack --profile --json > stats.json
webpack-bundle-analyzer stats.json
```

## Database Profiling

### PostgreSQL

**1. Enable Query Logging**
```sql
-- Enable slow query log
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries > 100ms
SELECT pg_reload_conf();
```

**2. pg_stat_statements**
```sql
-- Enable extension
CREATE EXTENSION pg_stat_statements;

-- Find slowest queries
SELECT
  query,
  calls,
  total_time / 1000 as total_seconds,
  mean_time / 1000 as mean_seconds,
  max_time / 1000 as max_seconds
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_time DESC
LIMIT 10;

-- Reset stats
SELECT pg_stat_statements_reset();
```

**3. EXPLAIN ANALYZE**
```sql
-- Analyze query execution
EXPLAIN ANALYZE
SELECT a.*, COUNT(c.id) as chunk_count
FROM analyses a
LEFT JOIN chunks c ON c.analysis_id = a.id
WHERE a.user_id = 'user_123'
GROUP BY a.id
ORDER BY a.created_at DESC
LIMIT 20;

-- Look for:
-- - Seq Scan (bad for large tables)
-- - High actual time
-- - High actual rows vs estimated rows
```

## Memory Profiling

### Python (memory_profiler)

```python
from memory_profiler import profile

@profile
def load_analyses():
    # Shows line-by-line memory usage
    analyses = []
    for i in range(10000):
        analyses.append({
            'id': i,
            'content': 'x' * 1000,  # Memory spike here!
        })
    return analyses
```

### Chrome DevTools (Heap Snapshot)

**Steps:**
1. Open DevTools → Memory tab
2. Take Heap Snapshot
3. Interact with app
4. Take another snapshot
5. Compare snapshots

**What to Look For:**
- Detached DOM nodes (memory leaks)
- Large arrays/objects
- Unreleased event listeners

### Memory Leak Detection

```typescript
// ❌ BAD: Memory leak (event listener never removed)
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// ✅ GOOD: Cleanup on unmount
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

## Flame Graphs

Visual representation of call stacks showing where time is spent.

**Reading Flame Graphs:**
- **Width** = Time spent (wider = slower)
- **Height** = Call stack depth
- **Color** = Usually just for differentiation
- **Top** = Leaf functions (where actual work happens)

**Generate Flame Graph (Python):**
```bash
# With py-spy
sudo py-spy record -o flamegraph.svg --pid 12345

# Open in browser
open flamegraph.svg
```

## Load Testing

### k6 (HTTP Load Testing)

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
  },
};

export default function () {
  const res = http.get('http://localhost:8500/api/v1/analyses');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

```bash
# Run load test
k6 run load-test.js
```

### Locust (Python Load Testing)

```python
# locustfile.py
from locust import HttpUser, task, between

class ApiUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def get_analyses(self):
        self.client.get("/api/v1/analyses")

    @task(3)  # 3x more frequent
    def get_analysis(self):
        self.client.get("/api/v1/analyses/abc123")
```

```bash
# Run with web UI
locust -f locustfile.py --host=http://localhost:8500

# Or headless
locust -f locustfile.py --host=http://localhost:8500 --users 100 --spawn-rate 10 --run-time 5m --headless
```

## Profiling Best Practices

1. **Profile in production-like environments** - Dev may not show real bottlenecks
2. **Profile with realistic data volumes** - Empty databases hide performance issues
3. **Focus on the slowest operations first** - 80/20 rule applies
4. **Measure before and after** - Verify optimizations actually help
5. **Profile regularly** - Catch regressions early
6. **Use sampling profilers for production** - Low overhead (py-spy, not cProfile)

## Quick Profiling Commands

```bash
# Python CPU profiling
python -m cProfile -s cumulative script.py | head -20

# Python memory profiling
python -m memory_profiler script.py

# Node.js profiling
node --prof app.js
node --prof-process isolate-*.log > processed.txt

# PostgreSQL slow queries
psql -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10"

# Chrome DevTools (programmatic)
node --inspect app.js
# Then open chrome://inspect
```

## References

- [py-spy Documentation](https://github.com/benfred/py-spy)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [React Profiler](https://react.dev/reference/react/Profiler)
- [k6 Load Testing](https://k6.io/docs/)
- See `templates/performance-metrics.ts` for Prometheus metrics setup
