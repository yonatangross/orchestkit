# GraphQL Performance Checklist

Query optimization and performance tuning for Strawberry GraphQL APIs.

## Query Analysis

### Identify Bottlenecks

- [ ] Enable query logging in development
- [ ] Monitor resolver execution times
- [ ] Track database query count per request
- [ ] Profile slow queries (>100ms)
- [ ] Use APM tools (Langfuse, DataDog, New Relic)

### Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Query latency p50 | <50ms | >100ms |
| Query latency p95 | <200ms | >500ms |
| Queries per request | <10 | >20 |
| Resolver errors | <0.1% | >1% |
| DataLoader hit rate | >80% | <50% |

## N+1 Query Prevention

### DataLoader Implementation

- [ ] Use DataLoader for ALL nested resolvers
- [ ] Batch by parent entity IDs
- [ ] Return results in same order as input keys
- [ ] Handle missing items (return None for missing keys)

```python
# BAD: N+1 queries
@strawberry.field
async def author(self, info: Info) -> User:
    return await db.get_user(self.author_id)  # 1 query per post!

# GOOD: Batched with DataLoader
@strawberry.field
async def author(self, info: Info) -> User:
    return await info.context.user_loader.load(self.author_id)
```

### DataLoader Checklist

- [ ] Create loaders per request (not singleton)
- [ ] Implement batch_load returning Sequence
- [ ] Map results to maintain key order
- [ ] Handle compound keys for filtered/limited queries
- [ ] Add loaders for counts and aggregates

### Monitoring N+1

- [ ] Enable SQLAlchemy query logging
- [ ] Count queries per resolver
- [ ] Alert when single request exceeds query threshold
- [ ] Review query patterns in slow endpoint logs

## Query Complexity Limits

### Depth Limiting

- [ ] Set max query depth (recommended: 10)
- [ ] Reject queries exceeding depth
- [ ] Document depth limit for clients

```python
from strawberry.extensions import QueryDepthLimiter

schema = strawberry.Schema(
    query=Query,
    extensions=[QueryDepthLimiter(max_depth=10)],
)
```

### Complexity Analysis

- [ ] Assign cost to fields (default: 1)
- [ ] Increase cost for expensive fields
- [ ] Set maximum total complexity
- [ ] Return complexity in response extensions

```python
from strawberry.extensions import MaxComplexity

schema = strawberry.Schema(
    query=Query,
    extensions=[MaxComplexity(max_complexity=100)],
)
```

### Field Cost Guidelines

| Field Type | Cost |
|------------|------|
| Scalar field | 1 |
| Simple nested object | 2 |
| List (paginated) | 5 |
| Computed field (no DB) | 1 |
| Computed field (with DB) | 5 |
| Aggregation | 10 |
| Full-text search | 20 |

## Pagination Optimization

### Cursor-Based Pagination

- [ ] Use cursor pagination (not offset) for large datasets
- [ ] Cursor encodes position, not page number
- [ ] Index database columns used in cursor ordering
- [ ] Limit maximum page size (e.g., 100)

```sql
-- BAD: Offset pagination (slow for large offsets)
SELECT * FROM posts LIMIT 20 OFFSET 10000;

-- GOOD: Cursor pagination (consistent performance)
SELECT * FROM posts WHERE id > 'cursor_id' LIMIT 20;
```

### Pagination Limits

- [ ] Enforce `first` argument maximum (e.g., 100)
- [ ] Default to reasonable page size (e.g., 20)
- [ ] Validate pagination arguments early
- [ ] Return error for invalid pagination

### Count Optimization

- [ ] Cache total counts when expensive
- [ ] Use estimated counts for large tables
- [ ] Make totalCount optional (separate query)
- [ ] Consider removing totalCount for huge datasets

## Caching Strategies

### HTTP Caching

- [ ] Set Cache-Control headers for public queries
- [ ] Use ETags for conditional requests
- [ ] Configure CDN caching for static queries

### Application-Level Caching

- [ ] Cache expensive computed fields
- [ ] Use Redis for shared cache across instances
- [ ] Implement cache invalidation on mutations
- [ ] Set appropriate TTLs

### DataLoader Caching

- [ ] DataLoader caches within single request (default)
- [ ] Clear loader cache between requests
- [ ] Consider request-scoped Redis cache for hot data

### Field-Level Caching

```python
from functools import lru_cache

@strawberry.type
class ExpensiveType:
    @strawberry.field
    @lru_cache(maxsize=100)
    def expensive_computation(self) -> str:
        return compute_expensive_value()
```

## Database Optimization

### Query Optimization

- [ ] Use indexes on filtered/sorted columns
- [ ] Use `selectinload` for eager loading in SQLAlchemy
- [ ] Avoid SELECT * (select only needed columns)
- [ ] Use database-level pagination (LIMIT/OFFSET or cursor)

### Connection Pooling

- [ ] Configure connection pool size (default often too small)
- [ ] Set pool overflow limit
- [ ] Enable connection recycling
- [ ] Monitor pool exhaustion

```python
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)
```

### Batch Operations

- [ ] Batch inserts for bulk mutations
- [ ] Use database transactions appropriately
- [ ] Avoid multiple round trips to database

## Resolver Optimization

### Async Resolvers

- [ ] Use `async def` for all I/O-bound resolvers
- [ ] Parallelize independent database calls
- [ ] Don't block event loop with sync code

```python
# BAD: Sequential calls
async def resolve_data(self, info):
    users = await fetch_users()
    posts = await fetch_posts()  # Waits for users
    return {"users": users, "posts": posts}

# GOOD: Parallel calls
async def resolve_data(self, info):
    users, posts = await asyncio.gather(
        fetch_users(),
        fetch_posts(),
    )
    return {"users": users, "posts": posts}
```

### Lazy Loading

- [ ] Compute fields only when requested
- [ ] Use `@strawberry.field` for computed properties
- [ ] Don't fetch data in type constructors

### Early Returns

- [ ] Validate permissions before expensive operations
- [ ] Return early for empty inputs
- [ ] Check cache before database queries

## Subscription Performance

### Connection Management

- [ ] Limit concurrent WebSocket connections
- [ ] Implement connection timeout
- [ ] Monitor connection count per user

### Message Batching

- [ ] Batch rapid updates (e.g., 100ms window)
- [ ] Implement client-side debouncing
- [ ] Use Redis PubSub for horizontal scaling

### Heartbeat

- [ ] Implement server heartbeat
- [ ] Detect and clean up dead connections
- [ ] Client ping/pong support

## Monitoring and Alerting

### Key Metrics

- [ ] Request latency (p50, p95, p99)
- [ ] Error rate by operation
- [ ] Database query count per request
- [ ] DataLoader efficiency
- [ ] Cache hit rate
- [ ] WebSocket connection count

### Logging

- [ ] Log slow queries (>500ms)
- [ ] Log query complexity
- [ ] Log resolver errors with context
- [ ] Include request ID for tracing

### Tracing

- [ ] Implement OpenTelemetry tracing
- [ ] Trace resolver execution
- [ ] Trace database queries
- [ ] Correlate logs with traces

## Load Testing

### Test Scenarios

- [ ] Normal load (expected traffic)
- [ ] Peak load (2-3x normal)
- [ ] Stress test (find breaking point)
- [ ] Soak test (sustained load over time)

### Tools

- [ ] k6 for load testing GraphQL
- [ ] Artillery for scenario-based tests
- [ ] Locust for Python-based tests

### Example k6 Test

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '5m',
};

export default function () {
  const res = http.post('http://localhost:8000/graphql', JSON.stringify({
    query: `
      query {
        users(first: 20) {
          edges {
            node {
              id
              name
              posts(first: 5) {
                id
                title
              }
            }
          }
        }
      }
    `,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'latency < 200ms': (r) => r.timings.duration < 200,
  });
}
```

## Optimization Priority

### Quick Wins (Implement First)

1. Add DataLoaders to all nested resolvers
2. Set query depth limit
3. Enable pagination limits
4. Add database indexes for common queries

### Medium Effort

1. Implement caching strategy
2. Add query complexity limits
3. Optimize database queries
4. Set up monitoring

### Advanced

1. Implement persisted queries
2. Add automatic query analysis
3. Set up distributed tracing
4. Implement query allowlisting

## Pre-Production Checklist

- [ ] DataLoaders implemented for all nested resolvers
- [ ] Query depth limit configured
- [ ] Pagination limits enforced
- [ ] Database indexes verified
- [ ] Connection pooling configured
- [ ] Error logging enabled
- [ ] Performance monitoring in place
- [ ] Load testing completed
- [ ] Cache strategy implemented
- [ ] Documentation updated
