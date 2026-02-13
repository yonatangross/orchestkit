---
title: "Alembic: Data Migration"
category: alembic
impact: CRITICAL
impactDescription: Data migrations on production tables can lock tables, cause downtime, or corrupt data if done incorrectly. Batch processing and two-phase approaches are essential.
tags: [alembic, data-migration, backfill, zero-downtime, concurrently]
---

# Alembic Data Migration Patterns

## Two-Phase NOT NULL Migration

```python
"""Add org_id column (phase 1 - nullable).

Phase 1: Add nullable column
Phase 2: Backfill data
Phase 3: Add NOT NULL (separate migration after verification)
"""
def upgrade() -> None:
    # Phase 1: Add as nullable first
    op.add_column('users', sa.Column('org_id', UUID(as_uuid=True), nullable=True))

    # Phase 2: Backfill with default org
    op.execute("""
        UPDATE users SET org_id = 'default-org-uuid' WHERE org_id IS NULL
    """)

    # Phase 3 in SEPARATE migration after app updated:
    # op.alter_column('users', 'org_id', nullable=False)

def downgrade() -> None:
    op.drop_column('users', 'org_id')
```

## Batch Processing Pattern

```python
BATCH_SIZE = 1000

def upgrade() -> None:
    op.add_column('users', sa.Column('status', sa.String(20), nullable=True))

    conn = op.get_bind()
    total_updated = 0

    while True:
        result = conn.execute(sa.text("""
            SELECT id FROM users
            WHERE status IS NULL
            LIMIT :batch_size
            FOR UPDATE SKIP LOCKED
        """), {'batch_size': BATCH_SIZE})

        ids = [row[0] for row in result]
        if not ids:
            break

        conn.execute(sa.text("""
            UPDATE users
            SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
            WHERE id = ANY(:ids)
        """), {'ids': ids})

        total_updated += len(ids)
        conn.commit()  # Commit per batch to release locks

def downgrade() -> None:
    op.drop_column('users', 'status')
```

## Concurrent Index (Zero-Downtime)

```python
def upgrade() -> None:
    # CONCURRENTLY avoids table locks on large tables
    # IMPORTANT: Cannot run inside transaction block
    op.execute("COMMIT")
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_org
        ON users (organization_id, created_at DESC)
    """)

def downgrade() -> None:
    op.execute("COMMIT")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_users_org")
```

## Running Async Code in Migrations

```python
from sqlalchemy.util import await_only

def upgrade() -> None:
    connection = op.get_bind()
    # Alembic runs in greenlet context, so await_only works
    result = await_only(
        connection.execute(text("SELECT count(*) FROM users"))
    )
```

## Backfill Size Guide

| Table Size | Strategy | Notes |
|------------|----------|-------|
| < 10K rows | Single UPDATE | Fast enough |
| 10K-1M rows | Batched UPDATE in migration | LIMIT + commit per batch |
| > 1M rows | Background script + trigger | Trigger for new rows, script for old |

## Common Mistakes

- Adding NOT NULL without two-phase approach (locks entire table)
- Using blocking index creation on large tables (use CONCURRENTLY)
- Running CONCURRENTLY inside a transaction block (fails)
- Not committing between batches (holds locks too long)
- Skipping `FOR UPDATE SKIP LOCKED` in batch queries (deadlocks)
