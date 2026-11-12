---
title: Distributed Systems Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Distributed Locks (locks) -- CRITICAL -- 1 rule

Coordinate exclusive access to resources across multiple service instances.
Redis/Redlock and PostgreSQL advisory lock tutorials moved upstream (see SKILL.md, "Upstream coverage").

- `locks-fencing-tokens.md` -- Owner validation, TTL management, heartbeat extension patterns

## 2. Resilience (resilience) -- CRITICAL -- 3 rules

Production-grade fault tolerance for distributed systems and LLM workflows.

- `resilience-circuit-breaker.md` -- CLOSED/OPEN/HALF_OPEN state machine, sliding window, fallbacks
- `resilience-retry-backoff.md` -- Exponential backoff with jitter, error classification, retry budget
- `resilience-bulkhead.md` -- Semaphore-based tier isolation, rejection policies, queue depth monitoring

## 3. Idempotency (idempotency) -- HIGH -- 1 rule

Ensure operations can be safely retried without unintended side effects.
Event-consumer dedup and database-backed storage tutorials moved upstream (see SKILL.md, "Upstream coverage").

- `idempotency-keys.md` -- Deterministic key generation, Stripe-style Idempotency-Key header, middleware

## 4. Rate Limiting (ratelimit) -- HIGH -- 2 rules

Protect APIs with distributed rate limiting using Redis and modern algorithms.
SlowAPI integration and tiered-limit tutorials moved upstream (see SKILL.md, "Upstream coverage").

- `ratelimit-token-bucket.md` -- Token bucket with Redis Lua scripts, burst capacity, refill rate
- `ratelimit-sliding-window.md` -- Sorted set counters, precise windowing, no boundary spikes

## 5. Edge Computing (edge) -- HIGH -- 2 rules

Edge runtime patterns for Cloudflare Workers, Vercel Edge, and Deno Deploy.

- `edge-workers.md` -- V8 isolate constraints, Web APIs, geo-routing, auth at edge
- `edge-caching.md` -- Cache-aside at edge, CDN headers, KV storage, stale-while-revalidate

## 6. Event-Driven (events) -- HIGH -- 2 rules

Event sourcing, CQRS, saga orchestration, and reliable messaging patterns.

- `event-sourcing.md` -- Event-sourced aggregates, CQRS read models, optimistic concurrency
- `event-messaging.md` -- Transactional outbox, saga compensation, idempotent consumers
