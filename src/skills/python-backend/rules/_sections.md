---
title: Python Backend Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Asyncio (asyncio) — HIGH — 3 rules

Modern Python asyncio patterns using structured concurrency, TaskGroup, and Python 3.11+ features.

- `asyncio-taskgroup.md` — TaskGroup replaces gather(), timeout context manager, ExceptionGroup handling
- `asyncio-structured.md` — Semaphore concurrency limiting, sync-to-async bridge, asyncio.to_thread
- `asyncio-cancellation.md` — CancelledError handling, resource cleanup, cancellation propagation

## 2. FastAPI (fastapi) — HIGH — 3 rules

Production-ready FastAPI patterns for lifespan, dependencies, middleware, and configuration.

- `fastapi-dependencies.md` — Dependency injection, database sessions, service deps, authentication chain
- `fastapi-middleware.md` — RequestID, Timing, Logging middleware, CORS configuration, middleware ordering
- `fastapi-background.md` — Lifespan management, health checks, Pydantic settings, exception handlers

## 3. SQLAlchemy (sqlalchemy) — HIGH — 3 rules

Async database patterns with SQLAlchemy 2.0, AsyncSession, and FastAPI integration.

- `sqlalchemy-sessions.md` — Engine/session factory, FastAPI DI, model definitions, expire_on_commit
- `sqlalchemy-relationships.md` — Eager loading (selectinload), lazy="raise", N+1 prevention
- `sqlalchemy-migrations.md` — Repository pattern, bulk operations, chunked inserts, concurrent queries

## 4. Pooling (pooling) — MEDIUM — 3 rules

Database and HTTP connection pooling for high-performance async Python applications.

- `pooling-database.md` — SQLAlchemy pool config, asyncpg pool, pool sizing formula
- `pooling-http.md` — aiohttp TCPConnector, session lifecycle, FastAPI lifespan integration
- `pooling-tuning.md` — Pool monitoring, connection exhaustion diagnosis, stale connection handling
