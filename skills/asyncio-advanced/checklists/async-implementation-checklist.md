# Async Implementation Checklist

## Before Starting

- [ ] Python version >= 3.11 (for TaskGroup, ExceptionGroup)
- [ ] Using async-compatible libraries (aiohttp, asyncpg, aiofiles)
- [ ] No blocking sync calls in async code paths

## TaskGroup Usage

- [ ] Using `async with asyncio.TaskGroup()` instead of `asyncio.gather()`
- [ ] All tasks created with `tg.create_task()`
- [ ] Handling `ExceptionGroup` with `except*` syntax
- [ ] No fire-and-forget `create_task()` outside TaskGroup

## Timeout Handling

- [ ] Using `async with asyncio.timeout(seconds)` for deadlines
- [ ] Timeout values are reasonable for the operation
- [ ] Timeout exceptions are caught and handled appropriately

## Cancellation Safety

- [ ] Never swallowing `asyncio.CancelledError`
- [ ] Always re-raising `CancelledError` after cleanup
- [ ] Resources cleaned up in `finally` blocks
- [ ] No `yield` inside `async with` timeout/taskgroup contexts

## Concurrency Limiting

- [ ] Using `asyncio.Semaphore` for rate limiting
- [ ] Semaphore created once, not per-call
- [ ] Semaphore combined with timeout to prevent deadlock
- [ ] Max concurrency matches resource limits (connections, API rate)

## Sync-to-Async Bridge

- [ ] Using `asyncio.to_thread()` for blocking sync code
- [ ] Not calling `asyncio.run()` inside async context
- [ ] Thread pool sized appropriately for workload
- [ ] CPU-bound work offloaded to process pool or worker

## Testing

- [ ] Using `pytest-asyncio` for async tests
- [ ] Tests use `@pytest.mark.asyncio` decorator
- [ ] Mock async functions return coroutines or use `AsyncMock`
- [ ] Timeouts added to prevent hanging tests

## Performance

- [ ] Connection pools are shared (not created per-request)
- [ ] HTTP sessions reused across requests
- [ ] Batch operations where possible
- [ ] Monitoring for event loop blocking (> 100ms)
