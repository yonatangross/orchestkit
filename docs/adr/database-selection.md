# ADR: Database Selection for E-Commerce Platform

**Status**: Accepted
**Date**: 2026-03-14
**Decision**: PostgreSQL

## Context

We need a primary database for our e-commerce platform. The team evaluated PostgreSQL and MongoDB. The platform handles product catalogs, user accounts, orders, payments, and inventory — all with strong consistency requirements.

## Decision Drivers

| Driver | Weight | PostgreSQL | MongoDB |
|--------|--------|------------|---------|
| ACID transactions across tables | Critical | Native multi-table transactions | Multi-document transactions added in 4.0, but with performance overhead and 16MB doc limit |
| Relational integrity (orders → line items → products → inventory) | Critical | Foreign keys, constraints, cascades | Application-level enforcement only |
| Complex queries (reporting, analytics, joins) | High | Native JOINs, window functions, CTEs | $lookup is limited; aggregation pipelines are verbose |
| Schema flexibility (product variants, attributes) | Medium | JSONB columns for semi-structured data | Native document flexibility |
| Full-text search | Medium | Built-in `tsvector`/`tsquery` | Atlas Search (requires Atlas) |
| Ecosystem maturity for e-commerce | High | Battle-tested (Shopify, Stripe) | Common for catalogs, rare for transactions |
| Horizontal scaling | Low (for our scale) | Read replicas, partitioning, Citus | Native sharding |

## Decision

**PostgreSQL**, with JSONB columns for semi-structured data like product attributes and variant metadata.

## Rationale

### Why PostgreSQL wins for e-commerce

1. **Transactions are non-negotiable.** An order placement touches inventory, payment, order records, and possibly promotions — atomically. PostgreSQL handles this natively. MongoDB's multi-document transactions work but carry performance penalties and a 60-second time limit.

2. **Relational data is the core domain.** Users have orders. Orders have line items. Line items reference products. Products have inventory. This is textbook relational data. Fighting the document model to enforce these relationships adds complexity with no upside.

3. **Reporting and analytics.** Business needs complex queries: revenue by category over time, cohort retention, inventory turnover. SQL with JOINs, window functions, and CTEs handles this directly. MongoDB's aggregation pipeline can do it, but at significantly higher development cost.

4. **JSONB gives us document flexibility where we need it.** Product attributes vary by category (clothing has sizes/colors, electronics have specs). A `attributes JSONB` column on the products table gives us schema flexibility exactly where it matters, without sacrificing relational integrity everywhere else.

### Why not MongoDB

MongoDB is a strong choice for event logging, content management, IoT data, and real-time analytics — domains where documents are the natural unit and relationships are shallow. E-commerce is not that domain.

The "MongoDB is flexible" argument doesn't hold when:
- You need enforced foreign keys (order references a real product)
- You need atomic multi-table writes (decrement inventory + create order)
- You need complex cross-entity queries (revenue reports, funnel analysis)

### What we considered but rejected

- **MongoDB for catalog + PostgreSQL for orders** (polyglot persistence): Adds operational complexity (two databases to backup, monitor, migrate) for marginal benefit. JSONB on PostgreSQL covers the catalog flexibility need.
- **MongoDB everywhere**: Would require application-level enforcement of referential integrity, making every developer responsible for consistency that the database should guarantee.

## Consequences

### Positive
- Strong consistency guarantees without application-level workarounds
- Rich SQL ecosystem for reporting and analytics
- Single database to operate, monitor, and back up
- Broad ORM/library support (SQLAlchemy, Prisma, Drizzle, etc.)

### Negative
- Horizontal write scaling requires more effort (partitioning, Citus) if we outgrow a single primary — unlikely at our scale for years
- Schema migrations require more discipline (use Alembic or similar; never raw DDL in production)

### Mitigations
- Use connection pooling from day one (PgBouncer or built-in pool) to avoid connection exhaustion under load
- Use cursor-based pagination, not OFFSET, for any paginated API
- Use read replicas for reporting queries to keep write path fast

## References

- [PostgreSQL JSONB documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [MongoDB multi-document transactions limitations](https://www.mongodb.com/docs/manual/core/transactions/)
- Shopify, Stripe, and GitHub all run on PostgreSQL for transactional workloads
