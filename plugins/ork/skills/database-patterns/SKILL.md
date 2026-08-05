---
name: database-patterns
license: MIT
compatibility: "Claude Code 2.1.220+."
description: Database design and migration patterns for Alembic migrations, schema design (SQL/NoSQL), and database versioning. Use when creating migrations, designing schemas, normalizing data, managing database versions, or handling schema drift.
tags: [database, migrations, alembic, schema-design, versioning, postgresql, sql, nosql]
context: fork
agent: database-engineer
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: reference
targets:
  - library: sqlalchemy
    version: ">=2.0.0"
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
paths: ["**/migrations/**", "**/models/**", "alembic.ini", "**/schema*"]
path_patterns: ["*.sql", "**/migrations/**", "**/alembic/**", "**/prisma/**"]
---

<!-- directive-density: intentional (teaches migration anti-patterns; NEVER markers describe real production-break conditions, not aspirational guidance) -->

# Database Patterns

Comprehensive patterns for database migrations, schema design, and version management. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Alembic Migrations](#alembic-migrations) | 2 | CRITICAL | Data migrations, branch management |
| [Schema Design](#schema-design) | 3 | HIGH | Normalization, indexing strategies, NoSQL patterns |
| [Versioning](#versioning) | 2 | HIGH | Changelogs, schema drift detection |
| [Zero-Downtime Migration](#zero-downtime-migration) | 2 | CRITICAL | Expand-contract, pgroll, rollback monitoring |

| [Database Selection](#database-selection) | 1 | HIGH | Choosing the right database, PostgreSQL vs MongoDB, cost analysis |

**Total: 10 rules across 5 categories**

This skill is a wrap around Alembic and PostgreSQL, not a replacement for their
docs. Read `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/ork-delta.md` first: it holds the
version floors, corrections and house conventions that upstream does not carry.
Everything in the table below was removed on purpose.

## Upstream coverage (do not restate)

These topics are vendor documentation. Fetch them from the source instead of
re-teaching them here.

| Topic | First-party source |
|-------|--------------------|
| Alembic autogenerate, async `env.py` template, `revision`/`upgrade`/`downgrade`/`history` CLI | https://alembic.sqlalchemy.org/en/latest/autogenerate.html (our one correction to the async template is in `references/ork-delta.md`) |
| Migration branches, merge revisions, tuple `down_revision`, branch labels | https://alembic.sqlalchemy.org/en/latest/branches.html |
| Multi-database `env.py`, batched backfill recipes, migration hooks, environment-conditional migrations | https://alembic.sqlalchemy.org/en/latest/cookbook.html |
| Rollback and data-integrity test harnesses | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/migration-testing.md` |
| JSONB operators, indexing and storage tradeoffs | https://www.postgresql.org/docs/current/datatype-json.html (normal forms and the house denormalization call stay in `rules/schema-normalization.md`) |
| Full index-type reference and syntax (B-tree, GIN, partial, covering, `CREATE INDEX CONCURRENTLY`, `REINDEX`) | https://www.postgresql.org/docs/current/sql-createindex.html (the house subset we actually apply stays in `rules/schema-indexing.md`) |
| `lock_timeout`, `statement_timeout`, advisory locks during migration | https://www.postgresql.org/docs/current/runtime-config-client.html and `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/versioning-drift.md` |
| Enum type changes | https://www.postgresql.org/docs/current/datatype-enum.html |
| Table partitioning | https://www.postgresql.org/docs/current/ddl-partitioning.html |
| Trigger functions | https://www.postgresql.org/docs/current/plpgsql-trigger.html |
| Foreign-key cascade semantics | https://www.postgresql.org/docs/current/ddl-constraints.html |
| Temporal and audit-trail tables, CDC change logs, stored-procedure and view versioning | https://www.postgresql.org/docs/18/sql-createtable.html (read `references/ork-delta.md` before assuming these give row history) |
| HNSW and vector index tuning (`m`, `ef_construction`, `hnsw.ef_search`) | https://github.com/pgvector/pgvector |
| Generic pre-deployment, backup and schema-review checklists | https://alembic.sqlalchemy.org/en/latest/tutorial.html |
| Async SQLAlchemy sessions, FastAPI wiring, connection pool tuning | `ork:python-backend` skill |

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
-- PG18: prefer uuidv7() (time-ordered, better B-tree locality) over gen_random_uuid() (random v4)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

## Alembic Migrations

Migration management with Alembic for SQLAlchemy 2.0 async applications.

| Rule | File | Key Pattern |
|------|------|-------------|
| Data Migration | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/alembic-data-migration.md` | Batch backfill, two-phase NOT NULL, zero-downtime |
| Branching | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/alembic-branching.md` | Feature branches, merge migrations, conflict resolution |

Autogenerate setup is upstream. Our one deviation from Alembic's async `env.py`
template (the `in_greenlet()` guard) is in `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/ork-delta.md`.

## Schema Design

SQL and NoSQL schema design with normalization, indexing, and constraint patterns.

| Rule | File | Key Pattern |
|------|------|-------------|
| Normalization | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/schema-normalization.md` | 1NF-3NF, when to denormalize, JSON vs normalized |
| Indexing | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/schema-indexing.md` | B-tree, GIN, HNSW, partial/covering indexes |
| NoSQL Patterns | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/schema-nosql.md` | Embed vs reference, document design, sharding |

## Versioning

Database version control and change management across environments.

| Rule | File | Key Pattern |
|------|------|-------------|
| Changelog | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/versioning-changelog.md` | Schema version table, semantic versioning, audit trails |
| Drift Detection | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/versioning-drift.md` | Environment sync, checksum verification, migration locks |

Rollback testing lives in `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/migration-testing.md`;
the docstring convention for lossy downgrades is in
`${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/ork-delta.md`.

## Database Selection

Decision frameworks for choosing the right database. Default: PostgreSQL.

| Rule | File | Key Pattern |
|------|------|-------------|
| Selection Guide | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/db-selection.md` | PostgreSQL-first, tier-based matrix, anti-patterns |

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
| `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/ork-delta.md` | Our corrections and house conventions. Read this first |
| `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/migration-testing.md` | Upgrade/downgrade cycle and data-integrity test harnesses |
| `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/postgres-vs-mongodb.md` | Head-to-head comparison behind the PostgreSQL-first default |
| `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/db-migration-paths.md` | Cross-engine migration risk matrix |
| `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/cost-comparison.md` | Managed database cost analysis |
| `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/references/storage-and-cms.md` | Object storage and CMS selection |
| `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/scripts` | Migration template, model change detector |

## Zero-Downtime Migration

Safe database schema changes without downtime using expand-contract pattern and online schema changes.

| Rule | File | Key Pattern |
|------|------|-------------|
| Expand-Contract | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/migration-zero-downtime.md` | Expand phase, backfill, contract phase, pgroll automation |
| Rollback & Monitoring | `${CLAUDE_PLUGIN_ROOT}/skills/database-patterns/rules/migration-rollback.md` | pgroll rollback, lock monitoring, replication lag, backfill progress |

## Related Skills

- `sqlalchemy-2-async` - Async SQLAlchemy session patterns
- `ork:testing-integration` - Integration testing patterns including migration testing
- `caching` - Cache layer design to complement database performance
- `ork:performance` - Performance optimization patterns
