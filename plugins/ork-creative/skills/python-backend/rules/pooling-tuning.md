---
title: Monitor connection pools to prevent silent exhaustion and stale connection errors
category: pooling
impact: MEDIUM
impactDescription: Pool monitoring prevents silent connection exhaustion and stale connection errors
tags: [pool-monitoring, prometheus, connection-leak, stale-connections, troubleshooting]
---

# Pool Monitoring & Tuning

## Pool Monitoring with Prometheus

```python
from prometheus_client import Gauge

pool_size = Gauge("db_pool_size", "Current pool size")
pool_available = Gauge("db_pool_available", "Available connections")

async def collect_pool_metrics(pool: asyncpg.Pool):
    pool_size.set(pool.get_size())
    pool_available.set(pool.get_idle_size())
```

## Connection Exhaustion Diagnosis

```python
# Symptom: "QueuePool limit reached" or timeouts
from sqlalchemy import event

@event.listens_for(engine.sync_engine, "checkout")
def log_checkout(dbapi_conn, conn_record, conn_proxy):
    print(f"Connection checked out: {id(dbapi_conn)}")

@event.listens_for(engine.sync_engine, "checkin")
def log_checkin(dbapi_conn, conn_record):
    print(f"Connection returned: {id(dbapi_conn)}")

# Fix: Ensure connections are returned
async with session.begin():
    pass  # Connection returned here
```

## Stale Connection Handling

```python
# Fix 1: Enable pool_pre_ping
engine = create_async_engine(url, pool_pre_ping=True)

# Fix 2: Reduce pool_recycle
engine = create_async_engine(url, pool_recycle=900)

# Fix 3: Application-level retry
from sqlalchemy.exc import DBAPIError

async def with_retry(session, operation, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await operation(session)
        except DBAPIError as e:
            if attempt == max_retries - 1:
                raise
            await session.rollback()
```

## Anti-Patterns

```python
# NEVER create engine/pool per request
async def get_data():
    engine = create_async_engine(url)  # WRONG - pool per request!

# NEVER create ClientSession per request
async def fetch():
    async with aiohttp.ClientSession() as session:  # WRONG!
        return await session.get(url)

# NEVER forget to close pools on shutdown
# NEVER set pool_size too high (exhausts DB connections)
```

**Incorrect — No pool monitoring leads to silent connection exhaustion:**
```python
# No visibility into pool state
engine = create_async_engine(url, pool_size=20)
# App runs slow, no idea why (pool exhausted)
```

**Correct — Prometheus metrics reveal pool exhaustion before timeouts occur:**
```python
from prometheus_client import Gauge

pool_size_gauge = Gauge("db_pool_size", "DB pool size")
pool_available_gauge = Gauge("db_pool_available", "Available connections")

async def collect_metrics(pool):
    pool_size_gauge.set(pool.get_size())
    pool_available_gauge.set(pool.get_idle_size())
# Alert when pool_available approaches 0
```
