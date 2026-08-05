---
name: distributed-systems
license: MIT
compatibility: "Claude Code 2.1.220+."
description: Distributed systems patterns for locking, resilience, idempotency, and rate limiting. Use when implementing distributed locks, circuit breakers, retry policies, idempotency keys, token bucket rate limiters, or fault tolerance patterns.
tags: [distributed-systems, distributed-locks, resilience, circuit-breaker, idempotency, rate-limiting, retry, fault-tolerance, edge-computing, cloudflare-workers, vercel-edge, event-sourcing, cqrs, saga, outbox, message-queue, kafka]
context: fork
agent: backend-system-architect
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
persuasion-type: reference
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Distributed Systems Patterns

Comprehensive patterns for building reliable distributed systems. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Distributed Locks](#distributed-locks) | 1 | CRITICAL | Fencing tokens, owner validation; Redis/Redlock and Postgres advisory via upstream docs |
| [Resilience](#resilience) | 3 | CRITICAL | Circuit breakers, retry with backoff, bulkhead isolation |
| [Idempotency](#idempotency) | 1 | HIGH | Idempotency keys; dedup and database-backed storage via upstream docs |
| [Rate Limiting](#rate-limiting) | 2 | HIGH | Token bucket, sliding window; SlowAPI integration via upstream docs |
| [Edge Computing](#edge-computing) | 2 | HIGH | Edge workers, V8 isolates, CDN caching, geo-routing |
| [Event-Driven](#event-driven) | 2 | HIGH | Event sourcing, CQRS, transactional outbox, sagas |

**Total: 11 rules across 6 categories.** Removed topics point at first-party sources in [Upstream coverage](#upstream-coverage-do-not-restate); ork-specific scars live in `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/references/ork-delta.md`.

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
| Fencing Tokens | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/locks-fencing-tokens.md` | Owner validation, TTL, heartbeat extension |

Redis single-node locks, Redlock quorum, and PostgreSQL advisory locks are first-party documented; see [Upstream coverage](#upstream-coverage-do-not-restate).

## Resilience

Production-grade fault tolerance for distributed systems.

| Rule | File | Key Pattern |
|------|------|-------------|
| Circuit Breaker | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/resilience-circuit-breaker.md` | CLOSED/OPEN/HALF_OPEN states, sliding window |
| Retry & Backoff | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/resilience-retry-backoff.md` | Exponential backoff, jitter, error classification |
| Bulkhead Isolation | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/resilience-bulkhead.md` | Semaphore tiers, rejection policies, queue depth |

## Idempotency

Ensure operations can be safely retried without unintended side effects.

| Rule | File | Key Pattern |
|------|------|-------------|
| Idempotency Keys | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/idempotency-keys.md` | Deterministic hashing, Stripe-style headers |

Event-consumer dedup and database-backed idempotency storage follow the Stripe pattern; see [Upstream coverage](#upstream-coverage-do-not-restate).

## Rate Limiting

Protect APIs with distributed rate limiting using Redis.

| Rule | File | Key Pattern |
|------|------|-------------|
| Token Bucket | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/ratelimit-token-bucket.md` | Redis Lua scripts, burst capacity, refill rate |
| Sliding Window | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/ratelimit-sliding-window.md` | Sorted sets, precise counting, no boundary spikes |

SlowAPI + Redis wiring and tiered limits are first-party documented; see [Upstream coverage](#upstream-coverage-do-not-restate).

## Edge Computing

Edge runtime patterns for Cloudflare Workers, Vercel Edge, and Deno Deploy.

| Rule | File | Key Pattern |
|------|------|-------------|
| Edge Workers | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/edge-workers.md` | V8 isolate constraints, Web APIs, geo-routing, auth at edge |
| Edge Caching | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/edge-caching.md` | Cache-aside at edge, CDN headers, KV storage, stale-while-revalidate |

## Event-Driven

Event sourcing, CQRS, saga orchestration, and reliable messaging patterns.

| Rule | File | Key Pattern |
|------|------|-------------|
| Event Sourcing | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/event-sourcing.md` | Event-sourced aggregates, CQRS read models, optimistic concurrency |
| Event Messaging | `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/rules/event-messaging.md` | Transactional outbox, saga compensation, idempotent consumers |

## Upstream coverage (do not restate)

These topics were removed from this skill on 2026-07-31 (wrap-plus-delta thinning) because a first-party source maintains them. Consult the source; do not re-add tutorials here. Ork-specific scars for these topics live in `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/references/ork-delta.md`.

| Topic | First-party source |
|-------|--------------------|
| Redis single-node locks, Redlock algorithm and quorum | https://redis.io/docs/latest/develop/use/patterns/distributed-locks/ |
| PostgreSQL advisory locks (session and transaction level) | https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS |
| Circuit breaker pattern, thresholds, setup and rollout guides | https://learn.microsoft.com/azure/architecture/patterns/circuit-breaker |
| Bulkhead pattern deep dive (thread pool, semaphore, tiers) | https://learn.microsoft.com/azure/architecture/patterns/bulkhead |
| Retry strategies, exponential backoff, jitter, retry budgets | https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ and https://tenacity.readthedocs.io |
| HTTP and LLM provider error classification (retryable vs not) | https://docs.claude.com/en/api/errors and https://platform.openai.com/docs/guides/error-codes |
| Idempotency keys, request dedup, database-backed idempotency | https://docs.stripe.com/api/idempotent_requests |
| Token bucket algorithm and Redis rate-limiting patterns | https://redis.io/glossary/rate-limiting/ |
| FastAPI distributed rate limiting (SlowAPI middleware, tiers) | https://slowapi.readthedocs.io/ |
| LLM fallback chains, provider failover, cost tracking | https://vercel.com/docs/ai-gateway; model ids and pricing at https://docs.claude.com/en/docs/about-claude/pricing |

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

No separate event-sourcing/saga/CQRS skills exist; they are rules within distributed-systems. But most projects never need them.

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
| `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/scripts` | Templates: lock implementations, circuit breaker, rate limiter |
| `${CLAUDE_PLUGIN_ROOT}/skills/distributed-systems/references/ork-delta.md` | Ork-specific scars and house decisions kept after the wrap-plus-delta thinning |

## Related Skills

- `caching` - Redis caching patterns, cache as fallback
- `background-jobs` - Job deduplication, async processing with retry
- `observability-monitoring` - Metrics and alerting for circuit breaker state changes
- `error-handling-rfc9457` - Structured error responses for resilience failures
- `auth-patterns` - API key management, authentication integration
