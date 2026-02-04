---
name: connection-pooling
description: Database and HTTP connection pooling patterns for Python async applications. Use when configuring asyncpg pools, aiohttp sessions, or optimizing connection lifecycle in high-concurrency services.
context: fork
agent: backend-system-architect
version: 1.0.0
tags: [connection-pool, asyncpg, aiohttp, database, http, performance, 2026]
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
author: OrchestKit
user-invocable: false
---

# Connection Pooling Patterns (2026)

Database and HTTP connection pooling for high-performance async Python applications.

## Overview

- Configuring asyncpg/SQLAlchemy connection pools
- Setting up aiohttp ClientSession for HTTP requests
- Diagnosing connection exhaustion or leaks
- Optimizing pool sizes for workload
- Implementing health checks and connection validation

## Quick Reference

### SQLAlchemy Async Pool Configuration

```python
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/db",

    # Pool sizing
    pool_size=20,           # Steady-state connections
    max_overflow=10,        # Burst capacity (total max = 30)

    # Connection health
    pool_pre_ping=True,     # Validate before use (adds ~1ms latency)
    pool_recycle=3600,      # Recreate connections after 1 hour

    # Timeouts
    pool_timeout=30,        # Wait for connection from pool
    connect_args={
        "command_timeout": 60,      # Query timeout
        "server_settings": {
            "statement_timeout": "60000",  # 60s query timeout
        },
    },
)
```

### Direct asyncpg Pool

```python
import asyncpg

pool = await asyncpg.create_pool(
    "postgresql://user:pass@localhost/db",

    # Pool sizing
    min_size=10,            # Minimum connections kept open
    max_size=20,            # Maximum connections

    # Connection lifecycle
    max_inactive_connection_lifetime=300,  # Close idle after 5 min

    # Timeouts
    command_timeout=60,     # Query timeout
    timeout=30,             # Connection timeout

    # Setup for each connection
    setup=setup_connection,
)

async def setup_connection(conn):
    """Run on each new connection."""
    await conn.execute("SET timezone TO 'UTC'")
    await conn.execute("SET statement_timeout TO '60s'")
```

### aiohttp Session Pool

```python
import aiohttp
from aiohttp import TCPConnector

connector = TCPConnector(
    # Connection limits
    limit=100,              # Total connections
    limit_per_host=20,      # Per-host limit

    # Timeouts
    keepalive_timeout=30,   # Keep-alive duration

    # SSL
    ssl=False,              # Or ssl.SSLContext for HTTPS

    # DNS
    ttl_dns_cache=300,      # DNS cache TTL
)

session = aiohttp.ClientSession(
    connector=connector,
    timeout=aiohttp.ClientTimeout(
        total=30,           # Total request timeout
        connect=10,         # Connection timeout
        sock_read=20,       # Read timeout
    ),
)

# IMPORTANT: Reuse session across requests
# Create once at startup, close at shutdown
```

### FastAPI Lifespan with Pools

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create pools
    app.state.db_pool = await asyncpg.create_pool(DATABASE_URL)
    app.state.http_session = aiohttp.ClientSession(
        connector=TCPConnector(limit=100)
    )

    yield

    # Shutdown: close pools
    await app.state.db_pool.close()
    await app.state.http_session.close()

app = FastAPI(lifespan=lifespan)
```

### Pool Monitoring

```python
from prometheus_client import Gauge

# Metrics
pool_size = Gauge("db_pool_size", "Current pool size")
pool_available = Gauge("db_pool_available", "Available connections")
pool_waiting = Gauge("db_pool_waiting", "Requests waiting for connection")

async def collect_pool_metrics(pool: asyncpg.Pool):
    """Collect pool metrics periodically."""
    pool_size.set(pool.get_size())
    pool_available.set(pool.get_idle_size())
    # For waiting, need custom tracking
```

## Key Decisions

| Parameter | Small Service | Medium Service | High Load |
|-----------|---------------|----------------|-----------|
| pool_size | 5-10 | 20-50 | 50-100 |
| max_overflow | 5 | 10-20 | 20-50 |
| pool_pre_ping | True | True | Consider False* |
| pool_recycle | 3600 | 1800 | 900 |
| pool_timeout | 30 | 15 | 5 |

*For very high load, pre_ping adds latency; use shorter recycle instead.

### Sizing Formula

```
pool_size = (concurrent_requests / avg_queries_per_request) * 1.5

Example:
- 100 concurrent requests
- 3 queries per request average
- pool_size = (100 / 3) * 1.5 = 50
```

## Anti-Patterns (FORBIDDEN)

```python
# NEVER create engine/pool per request
async def get_data():
    engine = create_async_engine(url)  # WRONG - pool per request!
    async with engine.connect() as conn:
        return await conn.execute(...)

# NEVER create ClientSession per request
async def fetch():
    async with aiohttp.ClientSession() as session:  # WRONG!
        return await session.get(url)

# NEVER forget to close pools on shutdown
app = FastAPI()
engine = create_async_engine(url)
# WRONG - engine never closed!

# NEVER use pool_pre_ping=False without short pool_recycle
engine = create_async_engine(url, pool_pre_ping=False)  # Stale connections!

# NEVER set pool_size too high
engine = create_async_engine(url, pool_size=500)  # Exhausts DB connections!
```

## Troubleshooting

### Connection Exhaustion

```python
# Symptom: "QueuePool limit reached" or timeouts

# Diagnosis
from sqlalchemy import event

@event.listens_for(engine.sync_engine, "checkout")
def log_checkout(dbapi_conn, conn_record, conn_proxy):
    print(f"Connection checked out: {id(dbapi_conn)}")

@event.listens_for(engine.sync_engine, "checkin")
def log_checkin(dbapi_conn, conn_record):
    print(f"Connection returned: {id(dbapi_conn)}")

# Fix: Ensure connections are returned
async with session.begin():
    # ... work ...
    pass  # Connection returned here
```

### Stale Connections

```python
# Symptom: "connection closed" errors

# Fix 1: Enable pool_pre_ping
engine = create_async_engine(url, pool_pre_ping=True)

# Fix 2: Reduce pool_recycle
engine = create_async_engine(url, pool_recycle=900)

# Fix 3: Handle in application
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

## Related Skills

- `sqlalchemy-2-async` - SQLAlchemy async session patterns
- `asyncio-advanced` - Async concurrency patterns
- `observability-monitoring` - Metrics and alerting
- `caching-strategies` - Redis connection pooling

## Capability Details

### database-pool
**Keywords:** pool_size, max_overflow, asyncpg, pool_pre_ping, connection pool
**Solves:**
- How do I size database connection pool?
- Configure asyncpg/SQLAlchemy pool
- Prevent connection exhaustion

### http-session
**Keywords:** aiohttp, ClientSession, TCPConnector, http pool, connection limit
**Solves:**
- How do I configure aiohttp session?
- Reuse HTTP connections properly
- Set timeouts for HTTP requests

### pool-monitoring
**Keywords:** pool metrics, connection leak, pool exhaustion, monitoring
**Solves:**
- How do I monitor connection pool health?
- Detect connection leaks
- Troubleshoot pool exhaustion
