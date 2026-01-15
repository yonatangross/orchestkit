# Caching Strategies

Multi-level caching patterns for performance optimization.

## Cache Hierarchy

```
L1: In-Memory (LRU, memoization) - fastest, per-process
L2: Distributed (Redis/Memcached) - shared across instances
L3: CDN (edge, static assets) - global, closest to user
L4: Database (materialized views) - fallback, queryable
```

## Cache-Aside Pattern (Read-Through)

Most common caching pattern:

```typescript
async function getAnalysis(id: string): Promise<Analysis> {
  const cacheKey = `analysis:${id}`;

  // Try cache first (L2)
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Cache miss - fetch from database (L4)
  const analysis = await db.query('SELECT * FROM analyses WHERE id = $1', [id]);

  // Store in cache for future requests
  await redis.setex(cacheKey, 3600, JSON.stringify(analysis));  // 1 hour TTL

  return analysis;
}
```

## Write-Through Pattern

Update cache when writing to database:

```typescript
async function updateAnalysis(id: string, updates: Partial<Analysis>) {
  // Update database
  const updated = await db.query(
    'UPDATE analyses SET ... WHERE id = $1 RETURNING *',
    [id]
  );

  // Update cache immediately
  const cacheKey = `analysis:${id}`;
  await redis.setex(cacheKey, 3600, JSON.stringify(updated));

  return updated;
}
```

## Cache Invalidation Strategies

### 1. Time-Based (TTL)
```typescript
// Short TTL for frequently changing data
await redis.setex('trending:articles', 300, data);  // 5 min

// Long TTL for static data
await redis.setex('user:profile:123', 86400, data);  // 24 hours
```

### 2. Event-Based
```typescript
// Invalidate when data changes
async function deleteAnalysis(id: string) {
  await db.query('DELETE FROM analyses WHERE id = $1', [id]);

  // Invalidate all related cache keys
  await redis.del(`analysis:${id}`);
  await redis.del(`analysis:${id}:chunks`);
  await redis.del('analysis:list:recent');  // List cache
}
```

### 3. Tag-Based
```typescript
// Tag related cache entries
await redis.set('analysis:123', data);
await redis.sadd('tag:user:456', 'analysis:123');

// Invalidate all entries with tag
async function invalidateUserData(userId: string) {
  const keys = await redis.smembers(`tag:user:${userId}`);
  if (keys.length > 0) {
    await redis.del(...keys);
    await redis.del(`tag:user:${userId}`);
  }
}
```

## Redis Patterns

### 1. String Cache (Most Common)
```typescript
// Get/set
await redis.set('key', 'value');
const value = await redis.get('key');

// With TTL
await redis.setex('key', 3600, 'value');

// Atomic increment
await redis.incr('page:views:123');
```

### 2. Hash Cache (Objects)
```typescript
// Store object fields separately
await redis.hset('user:123', 'name', 'Alice');
await redis.hset('user:123', 'email', 'alice@example.com');

// Get specific field
const name = await redis.hget('user:123', 'name');

// Get all fields
const user = await redis.hgetall('user:123');
```

### 3. List Cache (Queues, Recent Items)
```typescript
// Recent analyses (FIFO)
await redis.lpush('analyses:recent', analysisId);
await redis.ltrim('analyses:recent', 0, 99);  // Keep only 100 most recent

// Get recent
const recent = await redis.lrange('analyses:recent', 0, 9);  // First 10
```

### 4. Set Cache (Unique Items, Tags)
```typescript
// Track unique visitors
await redis.sadd('article:123:visitors', userId);

// Check membership
const hasVisited = await redis.sismember('article:123:visitors', userId);

// Count unique
const uniqueCount = await redis.scard('article:123:visitors');
```

## In-Memory Cache (L1)

For per-process caching:

```typescript
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, Analysis>({
  max: 500,  // Maximum items
  ttl: 1000 * 60 * 5,  // 5 minutes
  updateAgeOnGet: true,  // Refresh on access
});

function getAnalysis(id: string): Analysis {
  // Check L1 first
  if (cache.has(id)) {
    return cache.get(id)!;
  }

  // Fetch from L2 or database
  const analysis = await fetchAnalysis(id);
  cache.set(id, analysis);

  return analysis;
}
```

## HTTP Caching (Browser/CDN)

```typescript
// Express.js example
app.get('/api/analyses/:id', async (req, res) => {
  const analysis = await getAnalysis(req.params.id);

  // Cache in browser and CDN for 1 hour
  res.set('Cache-Control', 'public, max-age=3600');

  // ETag for conditional requests
  const etag = generateETag(analysis);
  res.set('ETag', etag);

  // Return 304 if unchanged
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  res.json(analysis);
});
```

## Cache Warming

Preload cache before traffic arrives:

```typescript
async function warmCache() {
  // Load hot data
  const recentAnalyses = await db.query(
    'SELECT * FROM analyses ORDER BY created_at DESC LIMIT 100'
  );

  // Populate cache
  for (const analysis of recentAnalyses) {
    await redis.setex(
      `analysis:${analysis.id}`,
      3600,
      JSON.stringify(analysis)
    );
  }

  console.log(`Warmed cache with ${recentAnalyses.length} analyses`);
}

// Run on server startup
await warmCache();
```

## Cache Stampede Prevention

Prevent multiple requests from hitting database simultaneously:

```typescript
const locks = new Map<string, Promise<Analysis>>();

async function getAnalysis(id: string): Promise<Analysis> {
  const cacheKey = `analysis:${id}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Check if fetch is already in progress
  if (locks.has(cacheKey)) {
    return locks.get(cacheKey)!;
  }

  // Start fetch
  const fetchPromise = (async () => {
    const analysis = await db.query('SELECT * FROM analyses WHERE id = $1', [id]);
    await redis.setex(cacheKey, 3600, JSON.stringify(analysis));
    locks.delete(cacheKey);  // Clean up
    return analysis;
  })();

  locks.set(cacheKey, fetchPromise);
  return fetchPromise;
}
```

## Best Practices

1. **Cache frequently accessed, slow-to-compute data**
2. **Use appropriate TTL** - shorter for dynamic data
3. **Monitor cache hit rate** - aim for > 80%
4. **Handle cache failures gracefully** - always fall back to database
5. **Invalidate proactively** when data changes
6. **Monitor memory usage** - set max memory and eviction policy
7. **Use compression** for large cached values

## References

- [Redis Best Practices](https://redis.io/docs/management/optimization/)
- [HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- See `templates/caching-patterns.ts` for complete implementation
