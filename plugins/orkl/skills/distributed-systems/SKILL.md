---
name: distributed-systems
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Distributed systems patterns for locking, resilience, idempotency, and rate limiting. Use when implementing distributed locks, circuit breakers, retry policies, idempotency keys, token bucket rate limiters, or fault tolerance patterns.
tags: [distributed-systems, distributed-locks, resilience, circuit-breaker, idempotency, rate-limiting, retry, fault-tolerance, edge-computing, cloudflare-workers, vercel-edge, event-sourcing, cqrs, saga, outbox, message-queue, kafka]
context: fork
agent: backend-system-architect
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# Distributed Systems Patterns

Comprehensive patterns for building reliable distributed systems. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Distributed Locks](#distributed-locks) | 3 | CRITICAL | Redis/Redlock locks, PostgreSQL advisory locks, fencing tokens |
| [Resilience](#resilience) | 3 | CRITICAL | Circuit breakers, retry with backoff, bulkhead isolation |
| [Idempotency](#idempotency) | 3 | HIGH | Idempotency keys, request dedup, database-backed idempotency |
| [Rate Limiting](#rate-limiting) | 3 | HIGH | Token bucket, sliding window, distributed rate limits |
| [Edge Computing](#edge-computing) | 2 | HIGH | Edge workers, V8 isolates, CDN caching, geo-routing |
| [Event-Driven](#event-driven) | 2 | HIGH | Event sourcing, CQRS, transactional outbox, sagas |

**Total: 16 rules across 6 categories**

## Quick Start

```python
# Redis distributed lock with Lua scripts
async with RedisLock(redis_client, "payment:order-123"):
    await process_payment(order_id)

# Circuit breaker for external APIs
@circuit_breaker(failure_threshold=5, recovery_timeout=30)
@retry(max_attempts=3, base_delay=1.0)
async def call_external_api():
    ...

# Idempotent API endpoint
@router.post("/payments")
async def create_payment(
    data: PaymentCreate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
):
    return await idempotent_execute(db, idempotency_key, "/payments", process)

# Token bucket rate limiting
limiter = TokenBucketLimiter(redis_client, capacity=100, refill_rate=10)
if await limiter.is_allowed(f"user:{user_id}"):
    await handle_request()
```

## Distributed Locks

Coordinate exclusive access to resources across multiple service instances.

| Rule | File | Key Pattern |
|------|------|-------------|
| Redis & Redlock | `rules/locks-redis-redlock.md` | Lua scripts, SET NX, multi-node quorum |
| PostgreSQL Advisory | `rules/locks-postgres-advisory.md` | Session/transaction locks, lock ID strategies |
| Fencing Tokens | `rules/locks-fencing-tokens.md` | Owner validation, TTL, heartbeat extension |

## Resilience

Production-grade fault tolerance for distributed systems.

| Rule | File | Key Pattern |
|------|------|-------------|
| Circuit Breaker | `rules/resilience-circuit-breaker.md` | CLOSED/OPEN/HALF_OPEN states, sliding window |
| Retry & Backoff | `rules/resilience-retry-backoff.md` | Exponential backoff, jitter, error classification |
| Bulkhead Isolation | `rules/resilience-bulkhead.md` | Semaphore tiers, rejection policies, queue depth |

## Idempotency

Ensure operations can be safely retried without unintended side effects.

| Rule | File | Key Pattern |
|------|------|-------------|
| Idempotency Keys | `rules/idempotency-keys.md` | Deterministic hashing, Stripe-style headers |
| Request Dedup | `rules/idempotency-dedup.md` | Event consumer dedup, Redis + DB dual layer |
| Database-Backed | `rules/idempotency-database.md` | Unique constraints, upsert, TTL cleanup |

## Rate Limiting

Protect APIs with distributed rate limiting using Redis.

| Rule | File | Key Pattern |
|------|------|-------------|
| Token Bucket | `rules/ratelimit-token-bucket.md` | Redis Lua scripts, burst capacity, refill rate |
| Sliding Window | `rules/ratelimit-sliding-window.md` | Sorted sets, precise counting, no boundary spikes |
| Distributed Limits | `rules/ratelimit-distributed.md` | SlowAPI + Redis, tiered limits, response headers |

## Edge Computing

Edge runtime patterns for Cloudflare Workers, Vercel Edge, and Deno Deploy.

| Rule | File | Key Pattern |
|------|------|-------------|
| Edge Workers | `rules/edge-workers.md` | V8 isolate constraints, Web APIs, geo-routing, auth at edge |
| Edge Caching | `rules/edge-caching.md` | Cache-aside at edge, CDN headers, KV storage, stale-while-revalidate |

## Event-Driven

Event sourcing, CQRS, saga orchestration, and reliable messaging patterns.

| Rule | File | Key Pattern |
|------|------|-------------|
| Event Sourcing | `rules/event-sourcing.md` | Event-sourced aggregates, CQRS read models, optimistic concurrency |
| Event Messaging | `rules/event-messaging.md` | Transactional outbox, saga compensation, idempotent consumers |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Lock backend | Redis for speed, PostgreSQL if already using it, Redlock for HA |
| Lock TTL | 2-3x expected operation time |
| Circuit breaker recovery | Half-open probe with sliding window |
| Retry algorithm | Exponential backoff + full jitter |
| Bulkhead isolation | Semaphore-based tiers (Critical/Standard/Optional) |
| Idempotency storage | Redis (speed) + DB (durability), 24-72h TTL |
| Rate limit algorithm | Token bucket for most APIs, sliding window for strict quotas |
| Rate limit storage | Redis (distributed, atomic Lua scripts) |

## When NOT to Use

No separate event-sourcing/saga/CQRS skills exist — they are rules within distributed-systems. But most projects never need them.

| Pattern | Interview | Hackathon | MVP | Growth | Enterprise | Simpler Alternative |
|---------|-----------|-----------|-----|--------|------------|---------------------|
| Event sourcing | OVERKILL | OVERKILL | OVERKILL | OVERKILL | WHEN JUSTIFIED | Append-only table with status column |
| Saga orchestration | OVERKILL | OVERKILL | OVERKILL | SELECTIVE | APPROPRIATE | Sequential service calls with manual rollback |
| Circuit breaker | OVERKILL | OVERKILL | BORDERLINE | APPROPRIATE | REQUIRED | Try/except with timeout |
| Distributed locks | OVERKILL | OVERKILL | BORDERLINE | APPROPRIATE | REQUIRED | Database row-level lock (SELECT FOR UPDATE) |
| CQRS | OVERKILL | OVERKILL | OVERKILL | OVERKILL | WHEN JUSTIFIED | Single model for read/write |
| Transactional outbox | OVERKILL | OVERKILL | OVERKILL | SELECTIVE | APPROPRIATE | Direct publish after commit |
| Rate limiting | OVERKILL | OVERKILL | SIMPLE ONLY | APPROPRIATE | REQUIRED | Nginx rate limit or cloud WAF |

**Rule of thumb:** If you have a single server process, you do not need distributed systems patterns. Use in-process alternatives. Add distribution only when you actually have multiple instances.

## Anti-Patterns (FORBIDDEN)

```python
# LOCKS: Never forget TTL (causes deadlocks)
await redis.set(f"lock:{name}", "1")  # WRONG - no expiry!

# LOCKS: Never release without owner check
await redis.delete(f"lock:{name}")  # WRONG - might release others' lock

# RESILIENCE: Never retry non-retryable errors
@retry(max_attempts=5, retryable_exceptions={Exception})  # Retries 401!

# RESILIENCE: Never put retry outside circuit breaker
@retry  # Would retry when circuit is open!
@circuit_breaker
async def call(): ...

# IDEMPOTENCY: Never use non-deterministic keys
key = str(uuid.uuid4())  # Different every time!

# IDEMPOTENCY: Never cache error responses
if response.status_code >= 400:
    await cache_response(key, response)  # Errors should retry!

# RATE LIMITING: Never use in-memory counters in distributed systems
request_counts = {}  # Lost on restart, not shared across instances
```

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [scripts/](scripts/) | Templates: lock implementations, circuit breaker, rate limiter |
| [checklists/](checklists/) | Pre-flight checklists for each pattern category |
| [references/](references/) | Deep dives: Redlock algorithm, bulkhead tiers, token bucket |
| [examples/](examples/) | Complete integration examples |

## Related Skills

- `caching` - Redis caching patterns, cache as fallback
- `background-jobs` - Job deduplication, async processing with retry
- `observability-monitoring` - Metrics and alerting for circuit breaker state changes
- `error-handling-rfc9457` - Structured error responses for resilience failures
- `auth-patterns` - API key management, authentication integration
