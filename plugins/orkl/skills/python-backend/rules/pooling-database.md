---
title: Configure database connection pools correctly to prevent connection exhaustion under load
category: pooling
impact: MEDIUM
impactDescription: Proper pool configuration prevents connection exhaustion under load
tags: [connection-pool, asyncpg, sqlalchemy, pool-size, pool-pre-ping]
---

# Database Connection Pooling

## SQLAlchemy Async Pool Configuration

```python
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/db",
    pool_size=20,           # Steady-state connections
    max_overflow=10,        # Burst capacity (total max = 30)
    pool_pre_ping=True,     # Validate before use
    pool_recycle=3600,      # Recreate connections after 1 hour
    pool_timeout=30,        # Wait for connection from pool
    connect_args={
        "command_timeout": 60,
        "server_settings": {"statement_timeout": "60000"},
    },
)
```

## Direct asyncpg Pool

```python
import asyncpg

pool = await asyncpg.create_pool(
    "postgresql://user:pass@localhost/db",
    min_size=10,
    max_size=20,
    max_inactive_connection_lifetime=300,
    command_timeout=60,
    timeout=30,
    setup=setup_connection,
)

async def setup_connection(conn):
    await conn.execute("SET timezone TO 'UTC'")
    await conn.execute("SET statement_timeout TO '60s'")
```

## Pool Sizing

| Parameter | Small Service | Medium Service | High Load |
|-----------|---------------|----------------|-----------|
| pool_size | 5-10 | 20-50 | 50-100 |
| max_overflow | 5 | 10-20 | 20-50 |
| pool_pre_ping | True | True | Consider False* |
| pool_recycle | 3600 | 1800 | 900 |

```
pool_size = (concurrent_requests / avg_queries_per_request) * 1.5
Example: 100 concurrent / 3 queries = 50
```

**Incorrect — Creating engine per request exhausts database connections:**
```python
@app.get("/users")
async def get_users():
    engine = create_async_engine(DATABASE_URL)  # New pool every request!
    async with AsyncSession(engine) as session:
        return await session.execute(select(User))
```

**Correct — Reuse single engine from lifespan for all requests:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = create_async_engine(DATABASE_URL, pool_size=20)
    yield
    await app.state.engine.dispose()

@app.get("/users")
async def get_users(request: Request):
    async with AsyncSession(request.app.state.engine) as session:
        return await session.execute(select(User))
```
