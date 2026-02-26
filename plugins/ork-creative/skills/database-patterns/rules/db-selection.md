---
title: Select the right database engine based on workload requirements and trade-offs
category: schema
impact: HIGH
impactDescription: Wrong database choice is expensive to reverse — migrations, retraining, and re-architecting cost weeks. Default to PostgreSQL unless you have validated reasons otherwise.
tags: [database, postgresql, mongodb, redis, sqlite, selection, architecture]
---

# Database Selection Guide

## The Default: PostgreSQL

PostgreSQL is the #1 most-loved database for good reason. **Start with PostgreSQL unless you have a specific, validated reason not to.**

```sql
-- PostgreSQL handles "document store" workloads with JSONB
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_products_metadata ON products USING GIN (metadata);
SELECT * FROM products WHERE metadata @> '{"category": "electronics"}';
```

Key strengths: JSONB (90% of MongoDB use cases), full-text search (tsvector), extensions (PostGIS, pgvector, TimescaleDB), ACID transactions, universal ecosystem support.

## Decision Matrix by Project Tier

| Tier | Recommendation | Rationale |
|------|---------------|-----------|
| Interview / Take-home | SQLite or PostgreSQL | Zero config or standard choice |
| Hackathon / Prototype | PostgreSQL | Don't waste time on exotic choices |
| MVP (< 6 months) | PostgreSQL | One database, learn it well |
| Growth (1-5 engineers) | PostgreSQL + Redis (cache) | Add Redis only when measured |
| Enterprise (5+) | PostgreSQL primary + purpose-built secondaries | Specialized stores for validated bottlenecks |

## Decision Matrix by Data Model

| Data Shape | Best Fit | Why |
|------------|----------|-----|
| Relational with joins | PostgreSQL | Built for this |
| JSON documents with queries | PostgreSQL (JSONB) | Indexed JSON with SQL power |
| Truly schema-less, evolving weekly | MongoDB | Only if you never join |
| Key-value lookups | Redis | Sub-ms reads, ephemeral data |
| Time-series metrics | PostgreSQL + TimescaleDB | Or InfluxDB for extreme scale |
| Vector embeddings | PostgreSQL + pgvector | Or Pinecone for 100M+ vectors |

## When to Use Each

- **PostgreSQL**: Everything, unless proven otherwise. Web apps, APIs, SaaS, complex queries, JSON, full-text search, geo, vectors.
- **MongoDB**: Truly document-shaped data with no relational needs. Content where schema changes weekly AND you never join.
- **Redis**: Caching, sessions, ephemeral data. **Never as primary datastore.**
- **SQLite**: Embedded, single-user, dev/testing, edge computing. **Never for concurrent multi-user writes.**

## Anti-Patterns

**Incorrect:**
- Choosing MongoDB because "it's trendy" or "JSON is easier" without evaluating PostgreSQL JSONB
- Premature sharding before exhausting indexing, query optimization, read replicas, connection pooling
- SQLite in production with concurrent writes (causes `SQLITE_BUSY`)
- Redis as primary datastore (data persistence is best-effort)
- Running PostgreSQL + MongoDB + Redis + Elasticsearch when PostgreSQL alone covers it

**Correct:**
- Default to PostgreSQL, add specialized stores only for validated bottlenecks
- Before choosing non-PostgreSQL: benchmark (not assume), verify data model incompatibility, confirm team expertise
- Use Redis only as cache layer in front of PostgreSQL
- Use SQLite only for embedded/single-user/dev

## References

- `references/postgres-vs-mongodb.md` — Head-to-head comparison, JSONB examples
- `references/cost-comparison.md` — Hosting costs, license, operational complexity
- `references/db-migration-paths.md` — MongoDB→PostgreSQL, SQLite→PostgreSQL strategies
- `references/storage-and-cms.md` — CMS backends, file/blob storage decisions
