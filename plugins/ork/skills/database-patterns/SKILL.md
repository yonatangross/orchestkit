---
name: database-patterns
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Database design and migration patterns for Alembic migrations, schema design (SQL/NoSQL), and database versioning. Use when creating migrations, designing schemas, normalizing data, managing database versions, or handling schema drift.
tags: [database, migrations, alembic, schema-design, versioning, postgresql, sql, nosql]
context: fork
agent: database-engineer
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# Database Patterns

Comprehensive patterns for database migrations, schema design, and version management. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Alembic Migrations](#alembic-migrations) | 3 | CRITICAL | Autogenerate, data migrations, branch management |
| [Schema Design](#schema-design) | 3 | HIGH | Normalization, indexing strategies, NoSQL patterns |
| [Versioning](#versioning) | 3 | HIGH | Changelogs, rollback plans, schema drift detection |
| [Zero-Downtime Migration](#zero-downtime-migration) | 2 | CRITICAL | Expand-contract, pgroll, rollback monitoring |

| [Database Selection](#database-selection) | 1 | HIGH | Choosing the right database, PostgreSQL vs MongoDB, cost analysis |

**Total: 12 rules across 5 categories**

## Quick Start

```python
# Alembic: Auto-generate migration from model changes
# alembic revision --autogenerate -m "add user preferences"

def upgrade() -> None:
    op.add_column('users', sa.Column('org_id', UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE users SET org_id = 'default-org-uuid' WHERE org_id IS NULL")

def downgrade() -> None:
    op.drop_column('users', 'org_id')
```

```sql
-- Schema: Normalization to 3NF with proper indexing
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

## Alembic Migrations

Migration management with Alembic for SQLAlchemy 2.0 async applications.

| Rule | File | Key Pattern |
|------|------|-------------|
| Autogenerate | `rules/alembic-autogenerate.md` | Auto-generate from models, async env.py, review workflow |
| Data Migration | `rules/alembic-data-migration.md` | Batch backfill, two-phase NOT NULL, zero-downtime |
| Branching | `rules/alembic-branching.md` | Feature branches, merge migrations, conflict resolution |

## Schema Design

SQL and NoSQL schema design with normalization, indexing, and constraint patterns.

| Rule | File | Key Pattern |
|------|------|-------------|
| Normalization | `rules/schema-normalization.md` | 1NF-3NF, when to denormalize, JSON vs normalized |
| Indexing | `rules/schema-indexing.md` | B-tree, GIN, HNSW, partial/covering indexes |
| NoSQL Patterns | `rules/schema-nosql.md` | Embed vs reference, document design, sharding |

## Versioning

Database version control and change management across environments.

| Rule | File | Key Pattern |
|------|------|-------------|
| Changelog | `rules/versioning-changelog.md` | Schema version table, semantic versioning, audit trails |
| Rollback | `rules/versioning-rollback.md` | Rollback testing, destructive rollback docs, CI verification |
| Drift Detection | `rules/versioning-drift.md` | Environment sync, checksum verification, migration locks |

## Database Selection

Decision frameworks for choosing the right database. Default: PostgreSQL.

| Rule | File | Key Pattern |
|------|------|-------------|
| Selection Guide | `rules/db-selection.md` | PostgreSQL-first, tier-based matrix, anti-patterns |

## Key Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Async dialect | `postgresql+asyncpg` | Native async support for SQLAlchemy 2.0 |
| NOT NULL column | Two-phase: nullable first, then alter | Avoids locking, backward compatible |
| Large table index | `CREATE INDEX CONCURRENTLY` | Zero-downtime, no table locks |
| Normalization target | 3NF for OLTP | Reduces redundancy while maintaining query performance |
| Primary key strategy | UUID for distributed, INT for single-DB | Context-appropriate key generation |
| Soft deletes | `deleted_at` timestamp column | Preserves audit trail, enables recovery |
| Migration granularity | One logical change per file | Easier rollback and debugging |
| Production deployment | Generate SQL, review, then apply | Never auto-run in production |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER: Add NOT NULL without default or two-phase approach
op.add_column('users', sa.Column('org_id', UUID, nullable=False))  # LOCKS TABLE!

# NEVER: Use blocking index creation on large tables
op.create_index('idx_large', 'big_table', ['col'])  # Use CONCURRENTLY

# NEVER: Skip downgrade implementation
def downgrade():
    pass  # WRONG - implement proper rollback

# NEVER: Modify migration after deployment - create new migration instead

# NEVER: Run migrations automatically in production
# Use: alembic upgrade head --sql > review.sql

# NEVER: Run CONCURRENTLY inside transaction
op.execute("BEGIN; CREATE INDEX CONCURRENTLY ...; COMMIT;")  # FAILS

# NEVER: Delete migration history
command.stamp(alembic_config, "head")  # Loses history

# NEVER: Skip environments (Always: local -> CI -> staging -> production)
```

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/](references/) | Advanced patterns: Alembic, normalization, migration, audit, environment, versioning |
| [checklists/](checklists/) | Migration deployment and schema design checklists |
| [examples/](examples/) | Complete migration examples, schema examples |
| [scripts/](scripts/) | Migration templates, model change detector |

## Zero-Downtime Migration

Safe database schema changes without downtime using expand-contract pattern and online schema changes.

| Rule | File | Key Pattern |
|------|------|-------------|
| Expand-Contract | `rules/migration-zero-downtime.md` | Expand phase, backfill, contract phase, pgroll automation |
| Rollback & Monitoring | `rules/migration-rollback.md` | pgroll rollback, lock monitoring, replication lag, backfill progress |

## Related Skills

- `sqlalchemy-2-async` - Async SQLAlchemy session patterns
- `testing-patterns` - Comprehensive testing patterns including migration testing
- `caching` - Cache layer design to complement database performance
- `performance` - Performance optimization patterns
