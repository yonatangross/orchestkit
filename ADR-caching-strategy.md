# ADR-001: Caching Strategy for High-Concurrency Reads

**Status**: Proposed
**Date**: 2026-03-14
**Deciders**: [Team]

---

## Context

The system must serve **1M+ concurrent users** with **sub-50ms p99 read latency**. Without a caching layer, upstream databases and services will be overwhelmed, latency will spike, and infrastructure costs will be unsustainable at this scale.

Three strategies are viable:

1. **Redis** — distributed, in-memory, feature-rich key-value store
2. **Memcached** — distributed, lightweight, purely key-value cache
3. **Application-level cache** — in-process memory (e.g., LRU via `node-lru-cache`, Python `cachetools`, Guava)

---

## Decision Drivers

| Driver | Weight |
|--------|--------|
| p99 read latency < 50ms | Critical |
| Consistent cache state across nodes | High |
| Operational complexity | Medium |
| Cost at scale | Medium |
| Data structure richness (sorted sets, pub/sub) | Low–High (workload-dependent) |

---

## Options

### Option A: Redis (Recommended for most workloads)

**How it works**: All app nodes share a Redis cluster (Redis Cluster or managed: ElastiCache, Upstash). Cache reads add ~0.5–2ms network RTT.

| Pros | Cons |
|------|------|
| Shared state — no cold-start per instance | Network RTT adds ~1–3ms vs in-process |
| Rich data types (sorted sets, streams, pub/sub) | Cluster failover adds complexity |
| Atomic operations, Lua scripting | More expensive than Memcached at same memory |
| TTL, eviction policies, persistence options | Single-threaded command execution (mitigated by pipelining) |
| First-class support in every language | |
| Works for session store, rate limiter, leaderboards simultaneously | |

**Latency profile**: 0.5–3ms per get/set within same region. Easily meets 50ms budget with headroom.

---

### Option B: Memcached

**How it works**: Same topology as Redis but a simpler, multithreaded, strings-only cache.

| Pros | Cons |
|------|------|
| Marginally faster than Redis for simple get/set (multithreaded) | No data structures beyond strings/blobs |
| Lower memory overhead per key | No persistence, no pub/sub, no Lua |
| Battle-tested at massive scale (Facebook, Wikipedia) | No atomic operations beyond CAS |
| | Smaller ecosystem, fewer managed options |
| | You'll likely add Redis anyway for sessions/rate-limiting |

**Latency profile**: Comparable to Redis (< 1ms within AZ). Advantage is negligible at 50ms budget.

**Verdict**: Only choose Memcached if your workload is literally just `get(key) → blob` with zero need for anything else. In practice, you'll add Redis for rate limiting and end up running both — a net complexity increase.

---

### Option C: Application-Level Cache (In-Process)

**How it works**: Each app instance holds an LRU/TTL cache in heap memory. Zero network round-trips.

| Pros | Cons |
|------|------|
| Sub-millisecond latency (memory read) | **Cache inconsistency** across instances — user A on node 1 sees stale data that user B on node 2 just invalidated |
| Zero infrastructure | Memory pressure per pod — limits horizontal scale |
| No network dependency | Cache is lost on pod restart / deploy |
| Works offline / in edge functions | Cache size constrained by instance RAM |

**Latency profile**: < 0.1ms. Massively over-engineers the latency problem — your bottleneck at 1M users will be consistency, not those saved 2ms.

**Verdict**: Use as an **L1 cache in front of Redis** (see hybrid below), not as a standalone solution. Standalone app-level cache at 1M concurrent users is an operational disaster waiting to happen.

---

## Decision

**Use Redis as the primary distributed cache**, with an optional short-TTL in-process L1 cache for read-heavy hot keys.

### Rationale

- At 1M concurrent users, cache **consistency** across horizontally-scaled instances is non-negotiable. Redis gives you that; app-level alone does not.
- Redis latency (0.5–3ms) leaves 47ms of budget for application logic — more than sufficient.
- Redis's additional primitives (sorted sets for leaderboards, pub/sub for invalidation, streams for audit logs) eliminate the need for separate infrastructure components.
- Memcached's marginal performance advantage is irrelevant at the 50ms target and introduces long-term capability debt.

### Hybrid Pattern (Recommended for Hot Keys)

```
Request → L1 (in-process, 5s TTL, max 1000 keys) → L2 (Redis, 60s TTL) → Database
```

- L1 absorbs thundering-herd on the ~20 hottest keys (e.g., global config, feature flags)
- L2 handles the long tail
- Keep L1 TTL short (5–10s) to bound inconsistency window
- Do **not** put user-specific data in L1 (leaks between request contexts)

---

## Consequences

### Positive
- Consistent sub-50ms p99 reads at 1M+ concurrency
- Single cache infrastructure serves multiple use cases (session, rate-limiting, data cache)
- Linear horizontal scaling via Redis Cluster sharding

### Negative / Risks
- Redis cluster adds operational overhead (monitoring, failover, eviction tuning)
- Network partition between app and Redis = full cache miss → database load spike; requires circuit breaker
- Memory capacity planning required — set `maxmemory-policy allkeys-lru` to avoid OOM

### Mitigations
| Risk | Mitigation |
|------|------------|
| Redis failover during traffic spike | Multi-AZ replica + auto-failover; L1 buys 5–10s grace |
| Cache stampede on cold start | Probabilistic early expiration or [XFetch algorithm](https://cseweb.ucsd.edu/~avishay/pub/papers/redis-recompute.pdf) |
| Stale reads after write | Use `GETDEL` + write-through or publish invalidation event via Redis pub/sub |
| Cost at scale | Profile hit rate; >95% hit rate = right-sized. Tune `maxmemory` and eviction per environment. |

---

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|----------------|
| Memcached only | No data structures, no persistence, you'll add Redis anyway |
| App-level only | Cache inconsistency across nodes at 1M users is unacceptable |
| CDN-only caching | Only applicable to public, non-personalized content |
| Database read replicas | Reduces DB load but doesn't hit < 50ms without a cache layer in front |

---

## Implementation Notes

- **Key design**: `{service}:{entity}:{id}:{version}` — namespaced, avoids collisions across services
- **TTL discipline**: Every key must have a TTL. No infinite-lived keys.
- **Serialization**: MessagePack over JSON for memory efficiency at scale (30–40% smaller payloads)
- **Connection pooling**: Use a shared Redis client with connection pool per service; do not create per-request connections
- **Observability**: Instrument `cache.hit`, `cache.miss`, `cache.latency_ms` as metrics; alert on hit rate < 90%

---

## References

- Redis Cluster spec: https://redis.io/docs/management/scaling/
- Facebook Memcache paper (2013): https://research.facebook.com/publications/scaling-memcache-at-facebook/
- XFetch cache stampede algorithm: Vattani et al., 2015
