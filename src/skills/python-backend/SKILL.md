---
name: python-backend
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Python backend patterns for asyncio, FastAPI, SQLAlchemy 2.0 async, and connection pooling. Use when building async Python services, FastAPI endpoints, database sessions, or connection pool tuning.
tags: [python, asyncio, fastapi, sqlalchemy, connection-pooling, async, postgresql]
context: fork
agent: backend-system-architect
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# Python Backend

Patterns for building production Python backends with asyncio, FastAPI, SQLAlchemy 2.0, and connection pooling. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Asyncio](#asyncio) | 3 | HIGH | TaskGroup, structured concurrency, cancellation handling |
| [FastAPI](#fastapi) | 3 | HIGH | Dependencies, middleware, background tasks |
| [SQLAlchemy](#sqlalchemy) | 3 | HIGH | Async sessions, relationships, migrations |
| [Pooling](#pooling) | 3 | MEDIUM | Database pools, HTTP sessions, tuning |

**Total: 12 rules across 4 categories**

## Quick Start

```python
# FastAPI + SQLAlchemy async session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

@router.get("/users/{user_id}")
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
```

```python
# Asyncio TaskGroup with timeout
async def fetch_all(urls: list[str]) -> list[dict]:
    async with asyncio.timeout(30):
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(fetch_url(url)) for url in urls]
    return [t.result() for t in tasks]
```

## Asyncio

Modern Python asyncio patterns using structured concurrency, TaskGroup, and Python 3.11+ features.

### Key Patterns

- **TaskGroup** replaces `gather()` with structured concurrency and auto-cancellation
- **`asyncio.timeout()`** context manager for composable timeouts
- **Semaphore** for concurrency limiting (rate-limit HTTP requests)
- **`except*`** with ExceptionGroup for handling multiple task failures
- **`asyncio.to_thread()`** for bridging sync code to async

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Task spawning | TaskGroup not gather() |
| Timeouts | asyncio.timeout() context manager |
| Concurrency limit | asyncio.Semaphore |
| Sync bridge | asyncio.to_thread() |
| Cancellation | Always re-raise CancelledError |

## FastAPI

Production-ready FastAPI patterns for lifespan, dependencies, middleware, and settings.

### Key Patterns

- **Lifespan** with `asynccontextmanager` for startup/shutdown resource management
- **Dependency injection** with class-based services and `Depends()`
- **Middleware stack**: CORS -> RequestID -> Timing -> Logging
- **Pydantic Settings** with `.env` and field validation
- **Exception handlers** with RFC 7807 Problem Details

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Lifespan | asynccontextmanager (not events) |
| Dependencies | Class-based services with DI |
| Settings | Pydantic Settings with .env |
| Response | ORJSONResponse for performance |
| Health | Check all critical dependencies |

## SQLAlchemy

Async database patterns with SQLAlchemy 2.0, AsyncSession, and FastAPI integration.

### Key Patterns

- **One AsyncSession per request** with `expire_on_commit=False`
- **`lazy="raise"`** on relationships to prevent accidental N+1 queries
- **`selectinload`** for eager loading collections
- **Repository pattern** with generic async CRUD
- **Bulk inserts** chunked 1000-10000 rows for memory management

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Session scope | One AsyncSession per request |
| Lazy loading | lazy="raise" + explicit loads |
| Eager loading | selectinload for collections |
| expire_on_commit | False (prevents lazy load errors) |
| Pool | pool_pre_ping=True |

## Pooling

Database and HTTP connection pooling for high-performance async Python applications.

### Key Patterns

- **SQLAlchemy pool** with `pool_size`, `max_overflow`, `pool_pre_ping`
- **Direct asyncpg pool** with `min_size`/`max_size` and connection lifecycle
- **aiohttp session** with `TCPConnector` limits and DNS caching
- **FastAPI lifespan** creating and closing pools at startup/shutdown
- **Pool monitoring** with Prometheus metrics

### Pool Sizing Formula

```
pool_size = (concurrent_requests / avg_queries_per_request) * 1.5
```

## Anti-Patterns (FORBIDDEN)

```python
# NEVER use gather() for new code - no structured concurrency
# NEVER swallow CancelledError - breaks TaskGroup and timeout
# NEVER block the event loop with sync calls (time.sleep, requests.get)
# NEVER use global mutable state for db sessions
# NEVER skip dependency injection (create sessions in routes)
# NEVER share AsyncSession across tasks (race condition)
# NEVER use sync Session in async code (blocks event loop)
# NEVER create engine/pool per request
# NEVER forget to close pools on shutdown
```

## Related Skills

- `architecture-patterns` - Clean architecture and layer separation
- `async-jobs` - Celery/ARQ for background processing
- `streaming-api-patterns` - SSE/WebSocket async patterns
- `database-patterns` - Database schema design
