# Caching Implementation Checklist

## Strategy Selection

- [ ] Identify cacheable data:
  - [ ] Frequently accessed (>10 reads per write)
  - [ ] Expensive to compute
  - [ ] Tolerance for staleness defined

- [ ] Choose caching pattern:
  - [ ] **Cache-Aside**: General purpose, manual management
  - [ ] **Write-Through**: Strong consistency needed
  - [ ] **Write-Behind**: Write-heavy, can tolerate loss
  - [ ] **Read-Through**: Transparent caching desired

- [ ] Define TTL strategy:
  - [ ] Static data: Long TTL (hours/days)
  - [ ] User data: Medium TTL (minutes)
  - [ ] Real-time data: Short TTL (seconds)
  - [ ] Session data: Match session timeout

## Redis Setup

### Connection Configuration

- [ ] Use connection pooling
  ```python
  redis.from_url(url, max_connections=20)
  ```
- [ ] Enable connection health checks
- [ ] Configure appropriate timeouts
- [ ] Use async client for FastAPI

### Key Design

- [ ] Use consistent prefix convention: `{service}:{entity}:{id}`
- [ ] Keep keys short but descriptive
- [ ] Use colons as separators
- [ ] Document key patterns

Examples:
```
analysis:detail:abc123     # Single analysis
analysis:list:user:456     # User's analyses
analysis:stats:daily       # Aggregated stats
```

## Cache Operations

### Get/Set

- [ ] Handle cache misses gracefully
- [ ] Set appropriate TTL on all keys
- [ ] Use pipeline for batch operations
- [ ] Handle serialization consistently (JSON/msgpack)

### Invalidation

- [ ] Implement invalidation strategy:
  - [ ] TTL-based (automatic expiry)
  - [ ] Event-based (on data changes)
  - [ ] Version-based (namespace versioning)

- [ ] Invalidate related caches:
  - [ ] Detail cache when entity changes
  - [ ] List caches when entity added/removed
  - [ ] Aggregate caches when data changes

### Stampede Prevention

- [ ] Implement locking for expensive queries
- [ ] Use probabilistic early expiration
- [ ] Consider refresh-ahead for hot data

## Error Handling

- [ ] Cache failures should not break functionality
- [ ] Log cache errors but don't expose to users
- [ ] Implement circuit breaker for Redis
- [ ] Graceful degradation to database

```python
async def get_with_fallback(key: str, fetch_fn):
    try:
        cached = await redis.get(key)
        if cached:
            return deserialize(cached)
    except RedisError:
        logger.warning("Cache read failed", key=key)

    # Fallback to database
    return await fetch_fn()
```

## Performance

### Monitoring

- [ ] Track cache hit rate
- [ ] Monitor cache latency
- [ ] Alert on high miss rate
- [ ] Monitor memory usage

### Optimization

- [ ] Use MGET for batch reads
- [ ] Use pipeline for multiple operations
- [ ] Compress large values
- [ ] Use appropriate serialization (msgpack > JSON)

## Security

- [ ] Don't cache sensitive data (PII, secrets)
- [ ] Use separate Redis instance for sessions
- [ ] Enable Redis AUTH
- [ ] Use TLS for remote connections
- [ ] Set appropriate memory limits

## Testing

- [ ] Unit test cache logic with mocks
- [ ] Integration test with Redis
- [ ] Test cache invalidation
- [ ] Test error handling/fallback
- [ ] Load test cache performance

```python
@pytest.mark.asyncio
async def test_cache_fallback_on_redis_error(mock_redis):
    mock_redis.get.side_effect = RedisError("Connection lost")

    result = await cache_service.get_or_set("key", fetch_fn)

    # Should fallback to fetch_fn
    fetch_fn.assert_called_once()
```

## Common Patterns

### Entity Caching

```python
# Cache individual entities
async def get_analysis(id: str) -> Analysis:
    return await cache.get_or_set(
        f"analysis:{id}",
        lambda: repo.get_by_id(id),
        ttl=300,
    )
```

### List Caching

```python
# Cache lists with shorter TTL
async def list_user_analyses(user_id: str) -> list[Analysis]:
    return await cache.get_or_set(
        f"analysis:list:user:{user_id}",
        lambda: repo.find_by_user(user_id),
        ttl=60,  # Shorter TTL for lists
    )
```

### Aggregation Caching

```python
# Cache computed aggregations
async def get_daily_stats() -> Stats:
    return await cache.get_or_set(
        "stats:daily",
        compute_daily_stats,
        ttl=3600,  # 1 hour for aggregates
    )
```

## Quick Reference

| Data Type | TTL | Invalidation |
|-----------|-----|--------------|
| Static config | 24h | On deploy |
| Entity detail | 5m | On update/delete |
| Entity list | 1m | On add/remove |
| User session | 30m | On logout |
| Aggregations | 1h | On schedule |
| Rate limits | 1m | Automatic |

## Checklist Summary

- [ ] Choose appropriate pattern for use case
- [ ] Design consistent key naming
- [ ] Implement proper invalidation
- [ ] Handle failures gracefully
- [ ] Monitor hit rate and latency
- [ ] Test thoroughly including edge cases
