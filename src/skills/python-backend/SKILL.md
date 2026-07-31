---
name: python-backend
license: MIT
compatibility: "Claude Code 2.1.220+."
description: "Production Python async patterns including asyncio TaskGroup, FastAPI dependency injection and middleware, SQLAlchemy 2.0 async sessions, and database connection pool tuning. Python 3.11+ runtime concerns such as ExceptionGroup, cancellation semantics, and session rollback. Use when building async services, wiring FastAPI dependencies, or tuning database connection pools. Runtime implementation layer, not the API wire contract."
tags: [python, asyncio, fastapi, sqlalchemy, connection-pooling, async, postgresql]
context: fork
agent: backend-system-architect
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: reference
targets:
  - library: fastapi
    version: ">=0.100.0"
  - library: sqlalchemy
    version: ">=2.0.0"
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
path_patterns: ["*.py", "**/requirements*.txt", "**/pyproject.toml", "**/Pipfile"]
---

<!-- directive-density: intentional (teaches asyncio/SQLAlchemy anti-patterns; NEVER markers describe real event-loop/race-condition bugs, not aspirational guidance) -->

# Python Backend

Patterns for building production Python backends with asyncio, FastAPI, SQLAlchemy 2.0, and connection pooling. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Asyncio](#asyncio) | 3 | HIGH | TaskGroup, structured concurrency, cancellation handling |
| [FastAPI](#fastapi) | 3 | HIGH | Dependencies, middleware, background tasks |
| [SQLAlchemy](#sqlalchemy) | 3 | HIGH | Async sessions, relationships, migrations |
| [Pooling](#pooling) | 3 | MEDIUM | Database pools, HTTP sessions, tuning |

**Total: 12 rules across 4 categories.** House decisions rescued from thinned files live in `references/ork-delta.md`; vendor material is linked, not restated (see [Upstream coverage](#upstream-coverage-do-not-restate)).

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

# Reusable dependency alias (FastAPI's recommended Annotated form)
SessionDep = Annotated[AsyncSession, Depends(get_db)]

@router.get("/users/{user_id}")
async def get_user(user_id: UUID, db: SessionDep):
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
- **Exception handlers** wired to RFC 9457 Problem Details bodies (the body format itself is `ork:api-design`)

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

That formula sizes one process. The fleet-level cap against the server's
`max_connections`, and the pool alert thresholds, are in `references/ork-delta.md`.

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

## Upstream coverage (do not restate)

Topics removed in the 2026-07-31 wrap-plus-delta thinning. Consult the first-party source; only the ork delta (house policy, scars, working config) belongs in this skill. Where a row says a house subset stays in a `rules/` file, that file is still the authority for the OrchestKit position and the link only covers the vendor surface around it.

| Topic | First-party source |
|-------|--------------------|
| asyncio task API reference: TaskGroup vs `gather()`, `asyncio.timeout()`, `ExceptionGroup` and `except*`, `to_thread()`. House subset stays in `rules/asyncio-taskgroup.md` and `rules/asyncio-cancellation.md`. | https://docs.python.org/3/library/asyncio-task.html |
| `asyncio.Semaphore`, `Lock`, `Event`, `Queue` semantics. House subset stays in `rules/asyncio-structured.md`; the create-once-plus-timeout rule is in `references/ork-delta.md`. | https://docs.python.org/3/library/asyncio-sync.html |
| Event-loop debug mode, `slow_callback_duration`, detecting blocking calls (the house 100 ms threshold is in `references/ork-delta.md`) | https://docs.python.org/3/library/asyncio-dev.html |
| FastAPI project scaffolding: app layout, `APIRouter` composition, Pydantic Settings wiring, uvicorn entry point | https://fastapi.tiangolo.com/tutorial/bigger-applications/ |
| FastAPI lifespan API and startup/shutdown mechanics. House subset stays in `rules/fastapi-background.md`; the reverse-order teardown rule is in `references/ork-delta.md`. | https://fastapi.tiangolo.com/advanced/events/ |
| Starlette/FastAPI middleware API, `BaseHTTPMiddleware`, `call_next`, CORS options. House subset stays in `rules/fastapi-middleware.md` and `references/fastapi-app-boilerplate.md`; the middleware-vs-dependency split is in `references/ork-delta.md`. | https://fastapi.tiangolo.com/tutorial/middleware/ |
| SQLAlchemy 2.0 asyncio API: `create_async_engine`, `async_sessionmaker`, `expire_on_commit`, `Mapped`/`mapped_column`, `with_for_update`, bulk insert and update. House subset stays in `rules/sqlalchemy-sessions.md`, `rules/sqlalchemy-relationships.md`, `rules/sqlalchemy-migrations.md`, and `references/eager-loading.md`. | https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html |
| SQLAlchemy pool implementations and options (`pool_size`, `max_overflow`, `pool_pre_ping`, `pool_recycle`, `pool_timeout`). House subset stays in `rules/pooling-database.md`. | https://docs.sqlalchemy.org/en/20/core/pooling.html |
| SQLAlchemy pool events (`checkout`, `checkin`, `connect`) for instrumentation. House subset stays in `rules/pooling-tuning.md`; the alert thresholds are in `references/ork-delta.md`. | https://docs.sqlalchemy.org/en/20/core/events.html |
| asyncpg pool API: `create_pool`, `min_size`/`max_size`, `max_inactive_connection_lifetime`, `setup` hook, type codecs | https://magicstack.github.io/asyncpg/current/api/index.html |
| aiohttp client reference: `ClientSession`, `TCPConnector` limits, keep-alive, DNS caching, `ClientTimeout`. House subset stays in `rules/pooling-http.md`. | https://docs.aiohttp.org/en/stable/client_reference.html |
| PostgreSQL server-side connection limits (`max_connections`, `superuser_reserved_connections`) | https://www.postgresql.org/docs/current/runtime-config-connection.html |
| pytest-asyncio fixtures and async test setup | https://pytest-asyncio.readthedocs.io/en/stable/reference/fixtures/index.html |
| Container and Kubernetes packaging, readiness/liveness probes, resource limits | https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/ |
| Auth flows, password hashing, token expiry policy, security headers | Owned by `ork:security-patterns` (`src/skills/security-patterns/`); the FastAPI `Depends()` auth chain stays in `rules/fastapi-dependencies.md` |
| RFC 9457 problem-details body format, API versioning, SSE and WebSocket wire contracts | Owned by `ork:api-design` (`src/skills/api-design/`); the FastAPI exception-handler wiring stays in `rules/fastapi-background.md` and `references/fastapi-app-boilerplate.md` |
| Production checklists for FastAPI, asyncio, SQLAlchemy, and pooling | Derivable from the sources above; no checklist restatement kept |

## Related Skills

- `ork:architecture-patterns` - Clean architecture and layer separation
- `ork:async-jobs` - Celery/ARQ for background processing
- `ork:api-design` - Wire contract, RFC 9457 errors, SSE/WebSocket streaming
- `ork:database-patterns` - Database schema design
- `ork:security-patterns` - Auth, password hashing, token policy
- `ork:testing-integration` - pytest-asyncio and httpx ASGI test setup
- `ork:devops-deployment` - Docker and Kubernetes packaging
