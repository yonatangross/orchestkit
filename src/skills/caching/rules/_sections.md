---
title: Caching Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Backend Caching (backend) — HIGH — 3 rules

Redis-based caching patterns for high-performance backends.

- `backend-cache-aside.md` — Cache-aside/lazy loading with Redis get_or_set
- `backend-write-through.md` — Write-through and write-behind patterns
- `backend-invalidation.md` — TTL, event-based, version-based invalidation + stampede prevention

## 2. Prompt Caching (prompt) — HIGH — 3 rules

Provider-native prompt caching for 90% token savings.

- `prompt-claude.md` — Claude cache_control with ephemeral TTL (5m/1h)
- `prompt-openai.md` — OpenAI automatic prefix caching
- `prompt-breakpoints.md` — Cache processing order, pricing, and breakpoint strategies

## 3. Semantic Caching (semantic) — MEDIUM — 3 rules

Cache LLM responses by semantic similarity with Redis vector search.

- `semantic-vector.md` — Redis vector similarity cache with configurable thresholds
- `semantic-multi-level.md` — L1 exact -> L2 semantic -> L3 prompt -> L4 LLM hierarchy
- `semantic-redis.md` — Redis 8.4 FT.HYBRID for metadata + vector queries

## 4. Cost Tracking (cost) — MEDIUM — 3 rules

Monitor cache effectiveness and LLM costs with Langfuse.

- `cost-langfuse.md` — Langfuse automatic cost tracking with @observe
- `cost-attribution.md` — Per-agent cost attribution and hierarchical rollup
- `cost-effectiveness.md` — Cache hit rate calculation and ROI metrics
