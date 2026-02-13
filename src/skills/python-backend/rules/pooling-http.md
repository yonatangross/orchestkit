---
title: "Pooling: HTTP Sessions"
category: pooling
impact: MEDIUM
impactDescription: Reusing HTTP sessions prevents connection churn and improves throughput
tags: [aiohttp, tcp-connector, http-pool, session, connection-limit]
---

# HTTP Connection Pooling

## aiohttp Session Pool

```python
import aiohttp
from aiohttp import TCPConnector

connector = TCPConnector(
    limit=100,              # Total connections
    limit_per_host=20,      # Per-host limit
    keepalive_timeout=30,   # Keep-alive duration
    ssl=False,              # Or ssl.SSLContext for HTTPS
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

## FastAPI Lifespan Integration

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db_pool = await asyncpg.create_pool(DATABASE_URL)
    app.state.http_session = aiohttp.ClientSession(
        connector=TCPConnector(limit=100)
    )
    yield
    await app.state.db_pool.close()
    await app.state.http_session.close()

app = FastAPI(lifespan=lifespan)
```

## Key Principles

- **Never** create ClientSession per request (connection churn)
- Create session at startup, close at shutdown
- Set `limit_per_host` to prevent overwhelming a single service
- Configure DNS caching for high-throughput scenarios
