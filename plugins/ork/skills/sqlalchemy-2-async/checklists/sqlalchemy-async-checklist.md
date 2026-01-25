# SQLAlchemy 2.0 Async Checklist

## Engine Configuration

- [ ] Using `create_async_engine` (not `create_engine`)
- [ ] Connection string uses async driver: `postgresql+asyncpg://`
- [ ] `pool_pre_ping=True` enabled for connection validation
- [ ] `pool_size` and `max_overflow` set appropriately
- [ ] `pool_recycle` set to prevent stale connections (e.g., 3600)

## Session Factory

- [ ] Using `async_sessionmaker` (not `sessionmaker`)
- [ ] `expire_on_commit=False` to prevent lazy load issues
- [ ] `autoflush=False` for explicit control (optional)
- [ ] Single factory instance shared across application

## FastAPI Integration

- [ ] Database dependency uses `async with` context manager
- [ ] Session yielded to routes, not returned
- [ ] Commit on success, rollback on exception
- [ ] Session properly closed after request

## Model Definition

- [ ] Using `Mapped[]` type hints (SQLAlchemy 2.0 style)
- [ ] `mapped_column()` instead of `Column()`
- [ ] Relationships have explicit `lazy=` parameter
- [ ] `lazy="raise"` to prevent accidental lazy loads

## Eager Loading

- [ ] Using `selectinload()` for collections
- [ ] Using `joinedload()` for single relationships
- [ ] All needed relationships loaded in query
- [ ] No N+1 queries in response serialization

## Bulk Operations

- [ ] Using `add_all()` for multiple inserts
- [ ] Chunking large inserts (1000-10000 per batch)
- [ ] Using `flush()` between chunks for memory
- [ ] Batch size tuned for performance

## Concurrency

- [ ] One `AsyncSession` per task/request (never shared)
- [ ] Not using `scoped_session` with async
- [ ] Concurrent queries use separate sessions
- [ ] Connection pool sized for concurrent load

## Error Handling

- [ ] Proper exception handling around DB operations
- [ ] Rollback on errors before re-raising
- [ ] Connection errors handled gracefully
- [ ] Retry logic for transient failures

## Testing

- [ ] Using test database (not production)
- [ ] Transactions rolled back after each test
- [ ] Async test fixtures with `pytest-asyncio`
- [ ] Database state isolated between tests

## Performance

- [ ] Indexes on frequently queried columns
- [ ] `EXPLAIN ANALYZE` run on slow queries
- [ ] Connection pool metrics monitored
- [ ] Query execution time logged
