# PostgreSQL vs MongoDB

Head-to-head comparison for the most common database decision. TL;DR: PostgreSQL wins for almost every use case.

## Feature Comparison

| Feature | PostgreSQL | MongoDB |
|---------|-----------|---------|
| Data model | Relational + JSONB | Document (BSON) |
| Schema | Enforced (with flexible JSONB) | Schema-less (optional validation) |
| Transactions | Full ACID, multi-table | Multi-document (since 4.0, slower) |
| Joins | Native, optimized | $lookup (slow, limited) |
| JSON support | JSONB with GIN indexes | Native BSON |
| Full-text search | Built-in tsvector | Atlas Search (paid) |
| Geospatial | PostGIS (industry standard) | Built-in (basic) |
| Aggregation | SQL (window functions, CTEs) | Aggregation pipeline (verbose) |
| Replication | Streaming replication | Replica sets |
| Sharding | Citus extension / partitioning | Built-in (complex to operate) |
| License | PostgreSQL License (permissive) | SSPL (restrictive) |
| Hosting | Every cloud, many managed options | Atlas (MongoDB Inc.) or self-host |

## PostgreSQL JSONB: The MongoDB Killer

PostgreSQL's JSONB type handles document workloads with full SQL power:

```sql
-- Store JSON documents
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    data JSONB NOT NULL
);

-- Index nested fields
CREATE INDEX idx_products_category ON products USING GIN ((data->'category'));

-- Query JSON with SQL
SELECT data->>'name' AS name, data->'price' AS price
FROM products
WHERE data @> '{"category": "electronics"}'
  AND (data->>'price')::numeric < 500
ORDER BY (data->>'price')::numeric;

-- Combine relational joins WITH JSON queries
SELECT u.email, p.data->>'name'
FROM users u
JOIN products p ON p.data->>'seller_id' = u.id::text
WHERE p.data @> '{"in_stock": true}';
```

Key advantages over MongoDB:
- **ACID transactions** across relational and JSON data in one query
- **JOIN** JSON documents with relational tables
- **GIN indexes** on JSONB are fast and flexible
- **Partial indexes** on JSON fields for targeted performance
- **No vendor lock-in** — SSPL license limits MongoDB hosting options

## When MongoDB Actually Makes Sense

These cases are rare but legitimate:

1. **Rapidly evolving schemas**: Data shape changes multiple times per week, and you never need cross-document joins. Example: IoT with hundreds of device types each sending different telemetry shapes.

2. **Existing MongoDB codebase**: Migration cost exceeds benefit. The team has deep MongoDB operational expertise and the application works well.

3. **Content catalogs with embedded data**: Self-contained documents that are always read/written as a whole, never joined. Example: a product catalog where each product document contains all its variants, reviews, and metadata.

4. **Time-series with variable schemas**: Each data point has different fields. Note: TimescaleDB (PostgreSQL extension) often handles this better.

## Common MongoDB Pitfalls

| Pitfall | What Happens | PostgreSQL Equivalent |
|---------|-------------|----------------------|
| No joins | Denormalize everything, data duplication | Native JOINs |
| Schema drift | Documents with inconsistent fields | Schema enforcement |
| $lookup performance | Cross-collection queries are slow | Optimized JOIN planner |
| Transaction overhead | Multi-doc transactions are 2-5x slower than single-doc | Negligible transaction overhead |
| SSPL license | Cannot offer as managed service | Permissive license |
| ObjectId ordering | Time-based, leaks creation timestamps | UUID v7 or SERIAL |

## Migration: MongoDB to PostgreSQL

See `references/migration-paths.md` for detailed migration strategies.

Quick summary:
1. Map collections to tables (or JSONB columns for truly flexible data)
2. Extract commonly queried fields into typed columns
3. Use `mongodump` + transformation scripts + `COPY` for data migration
4. Rewrite aggregation pipelines as SQL queries (usually simpler)
