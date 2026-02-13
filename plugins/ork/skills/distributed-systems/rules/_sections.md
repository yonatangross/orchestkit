---
title: Distributed Systems Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Distributed Locks (locks) -- CRITICAL -- 3 rules

Coordinate exclusive access to resources across multiple service instances.

- `locks-redis-redlock.md` -- Redis single-node locks with Lua scripts, Redlock multi-node quorum
- `locks-postgres-advisory.md` -- PostgreSQL session-level and transaction-level advisory locks
- `locks-fencing-tokens.md` -- Owner validation, TTL management, heartbeat extension patterns

## 2. Resilience (resilience) -- CRITICAL -- 3 rules

Production-grade fault tolerance for distributed systems and LLM workflows.

- `resilience-circuit-breaker.md` -- CLOSED/OPEN/HALF_OPEN state machine, sliding window, fallbacks
- `resilience-retry-backoff.md` -- Exponential backoff with jitter, error classification, retry budget
- `resilience-bulkhead.md` -- Semaphore-based tier isolation, rejection policies, queue depth monitoring

## 3. Idempotency (idempotency) -- HIGH -- 3 rules

Ensure operations can be safely retried without unintended side effects.

- `idempotency-keys.md` -- Deterministic key generation, Stripe-style Idempotency-Key header, middleware
- `idempotency-dedup.md` -- Event consumer deduplication, Redis + DB dual-layer lookup, exactly-once processing
- `idempotency-database.md` -- Database-backed storage, unique constraints, TTL cleanup jobs

## 4. Rate Limiting (ratelimit) -- HIGH -- 3 rules

Protect APIs with distributed rate limiting using Redis and modern algorithms.

- `ratelimit-token-bucket.md` -- Token bucket with Redis Lua scripts, burst capacity, refill rate
- `ratelimit-sliding-window.md` -- Sorted set counters, precise windowing, no boundary spikes
- `ratelimit-distributed.md` -- SlowAPI + Redis, tiered user limits, RFC 6585 response headers

## 5. Edge Computing (edge) -- HIGH -- 2 rules

Edge runtime patterns for Cloudflare Workers, Vercel Edge, and Deno Deploy.

- `edge-workers.md` -- V8 isolate constraints, Web APIs, geo-routing, auth at edge
- `edge-caching.md` -- Cache-aside at edge, CDN headers, KV storage, stale-while-revalidate

## 6. Event-Driven (events) -- HIGH -- 2 rules

Event sourcing, CQRS, saga orchestration, and reliable messaging patterns.

- `event-sourcing.md` -- Event-sourced aggregates, CQRS read models, optimistic concurrency
- `event-messaging.md` -- Transactional outbox, saga compensation, idempotent consumers
