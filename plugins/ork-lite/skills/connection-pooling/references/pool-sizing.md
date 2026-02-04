# Connection Pool Sizing Guide

## Database Pool Sizing

### Formula

```
pool_size = (requests_per_second * avg_query_duration_seconds) * safety_factor

Where:
- requests_per_second: Peak RPS to handle
- avg_query_duration_seconds: Average time a connection is held
- safety_factor: 1.5 - 2.0 for headroom
```

### Examples

| Scenario | RPS | Query Duration | Pool Size |
|----------|-----|----------------|-----------|
| Low traffic API | 10 | 50ms | 5 |
| Medium service | 100 | 50ms | 10 |
| High traffic API | 500 | 50ms | 50 |
| Slow queries | 100 | 200ms | 40 |
| Batch processing | 50 | 500ms | 50 |

### PostgreSQL Connection Limits

```sql
-- Check max connections
SHOW max_connections;  -- Default: 100

-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Check per-database limit
SELECT datname, numbackends FROM pg_stat_database;
```

**Important**: Total connections across all app instances must not exceed `max_connections`.

```
Total pool size = pool_size * num_instances

Example:
- max_connections = 100
- Reserve 10 for admin
- 90 available for apps
- 3 app instances
- pool_size per instance = 30
```

## max_overflow Setting

`max_overflow` allows temporary connections above `pool_size`.

```python
engine = create_async_engine(
    url,
    pool_size=20,       # Normal capacity
    max_overflow=10,    # Burst capacity (total max = 30)
)
```

### Guidelines

| Traffic Pattern | max_overflow |
|-----------------|--------------|
| Steady load | 0-25% of pool_size |
| Bursty traffic | 50-100% of pool_size |
| Unpredictable | 100% of pool_size |

## HTTP Connection Pool Sizing

### aiohttp TCPConnector

```python
connector = TCPConnector(
    limit=100,          # Total connections
    limit_per_host=20,  # Per-host limit
)
```

### Guidelines

```
limit = num_external_services * connections_per_service * safety_factor

limit_per_host = concurrent_requests_to_host * 1.5
```

### Example

| External Service | Concurrent Calls | Connections |
|------------------|------------------|-------------|
| Payment API | 10 | 15 |
| Email service | 5 | 8 |
| Analytics | 20 | 30 |
| Total | 35 | 53 |

Set `limit=60` (with headroom).

## Monitoring Pool Health

### Key Metrics

```python
# SQLAlchemy
pool = engine.pool
print(f"Size: {pool.size()}")
print(f"Checked out: {pool.checkedout()}")
print(f"Overflow: {pool.overflow()}")

# asyncpg
pool = await asyncpg.create_pool(...)
print(f"Size: {pool.get_size()}")
print(f"Free: {pool.get_idle_size()}")
print(f"Min: {pool.get_min_size()}")
print(f"Max: {pool.get_max_size()}")
```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Utilization | > 70% | > 90% |
| Wait time | > 100ms | > 1s |
| Overflow usage | > 50% | > 80% |
| Failed checkouts | > 1/min | > 10/min |
