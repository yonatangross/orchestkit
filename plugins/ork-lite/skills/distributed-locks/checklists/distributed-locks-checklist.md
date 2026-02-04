# Distributed Locks Checklist

## Lock Selection

- [ ] Chose appropriate lock backend
  - Redis: Fast, TTL-based, requires Redis infrastructure
  - PostgreSQL: No extra infra, integrates with transactions
  - Redlock: Multi-node Redis for high availability
- [ ] Determined lock scope (session vs transaction)
- [ ] Set appropriate TTL (not too short, not too long)

## Implementation

### Acquire
- [ ] Non-blocking option available (`try_lock`)
- [ ] Timeout support for blocking acquire
- [ ] Retry logic with exponential backoff
- [ ] Jitter added to prevent thundering herd
- [ ] Unique owner ID generated (UUIDv7)

### Release
- [ ] Owner validation (only owner can release)
- [ ] Atomic release (Lua script for Redis)
- [ ] Idempotent release (safe to call twice)
- [ ] Finally block ensures release on exception

### Extension
- [ ] Heartbeat/extend for long operations
- [ ] Auto-extend background task option
- [ ] Extension validates ownership

## Safety

### Mutual Exclusion
- [ ] Atomic acquire (SET NX for Redis)
- [ ] Fencing token or owner ID validated
- [ ] No race conditions in acquire/release

### Deadlock Prevention
- [ ] TTL prevents permanent deadlocks
- [ ] Lock ordering for multiple locks
- [ ] Timeout on acquire attempts

### Split-Brain Protection
- [ ] Redlock for multi-node Redis
- [ ] Clock drift factored into validity
- [ ] Quorum required for lock acquisition

## Error Handling

- [ ] Lock acquisition failures handled gracefully
- [ ] Release failures logged and handled
- [ ] Network partition scenarios considered
- [ ] Retry logic for transient failures

## Testing

- [ ] Unit tests for lock logic
- [ ] Integration tests with real backend
- [ ] Concurrent access tests
- [ ] Failure scenario tests (network, timeout)
- [ ] Lock expiration tests

## Monitoring

- [ ] Lock acquisition metrics
- [ ] Lock hold duration metrics
- [ ] Failed acquisition alerts
- [ ] Long-held lock alerts
- [ ] Deadlock detection

## PostgreSQL Advisory Locks

- [ ] Correct lock function used (session vs xact)
- [ ] Lock ID strategy documented
- [ ] Namespace collisions prevented
- [ ] `pg_locks` monitoring query available

## Redis Locks

- [ ] Lua scripts used for atomicity
- [ ] TTL always set (no deadlocks)
- [ ] Owner ID stored with lock
- [ ] Release validates owner

## Redlock (Multi-Node)

- [ ] Minimum 3 Redis instances (recommend 5)
- [ ] Quorum calculated correctly (N/2 + 1)
- [ ] Clock drift factored in
- [ ] Failed nodes don't block acquire
- [ ] Release attempted on all nodes

## Production Readiness

- [ ] Lock names are descriptive and namespaced
- [ ] TTL tuned for operation duration
- [ ] Metrics and alerting configured
- [ ] Runbook for lock-related incidents
- [ ] Graceful degradation strategy
