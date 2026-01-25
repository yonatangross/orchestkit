# Alembic Advanced Implementation Guide

Advanced patterns for production database migrations with Alembic.

## Multi-Database Migrations

### Configuration Setup

```python
# alembic/env.py - Multi-database support
from alembic import context
from sqlalchemy import engine_from_config, pool

# Define multiple databases
DATABASES = {
    'default': 'postgresql://user:pass@localhost/main',
    'analytics': 'postgresql://user:pass@localhost/analytics',
    'audit': 'postgresql://user:pass@localhost/audit',
}

def run_migrations_online():
    """Run migrations for each database."""
    for db_name, url in DATABASES.items():
        config = context.config
        config.set_main_option('sqlalchemy.url', url)

        connectable = engine_from_config(
            config.get_section(config.config_ini_section),
            prefix='sqlalchemy.',
            poolclass=pool.NullPool,
        )

        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=get_metadata(db_name),
                version_table=f'alembic_version_{db_name}',
            )

            with context.begin_transaction():
                context.run_migrations()
```

### Per-Database Migrations

```python
# migrations/versions/abc123_add_analytics_table.py
"""Add analytics events table.

Revision ID: abc123
Database: analytics
"""
from alembic import op
import sqlalchemy as sa

revision = 'abc123'
down_revision = 'xyz789'
branch_labels = ('analytics',)  # Database-specific branch

def upgrade() -> None:
    op.create_table('events',
        sa.Column('id', sa.BigInteger, primary_key=True),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('payload', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

def downgrade() -> None:
    op.drop_table('events')
```

## Data Migrations with Batching

### Batch Processing Pattern

```python
"""Backfill user_status column with batching.

Revision ID: def456
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

BATCH_SIZE = 1000

def upgrade() -> None:
    # Phase 1: Add nullable column
    op.add_column('users', sa.Column('status', sa.String(20), nullable=True))

    # Phase 2: Backfill in batches
    conn = op.get_bind()
    session = Session(bind=conn)

    total_updated = 0
    while True:
        # Fetch batch of IDs without status
        result = conn.execute(sa.text("""
            SELECT id FROM users
            WHERE status IS NULL
            LIMIT :batch_size
            FOR UPDATE SKIP LOCKED
        """), {'batch_size': BATCH_SIZE})

        ids = [row[0] for row in result]
        if not ids:
            break

        # Update batch
        conn.execute(sa.text("""
            UPDATE users
            SET status = CASE
                WHEN is_active THEN 'active'
                ELSE 'inactive'
            END
            WHERE id = ANY(:ids)
        """), {'ids': ids})

        total_updated += len(ids)
        conn.commit()  # Commit per batch to release locks

        print(f"Backfilled {total_updated} rows...")

    # Phase 3: Add NOT NULL constraint (separate migration recommended)

def downgrade() -> None:
    op.drop_column('users', 'status')
```

## Branch Management and Merging

### Creating Migration Branches

```bash
# Create a feature branch
alembic revision --branch-label=feature_payments -m "start payments feature"

# Create revision on branch
alembic revision --head=feature_payments@head -m "add payment_methods table"

# View branch structure
alembic branches

# Merge branches before deployment
alembic merge feature_payments@head main@head -m "merge payments feature"
```

### Resolving Branch Conflicts

```python
"""Merge feature_payments and main branches.

Revision ID: merge_abc
Revises: ('abc123', 'def456')
"""
revision = 'merge_abc'
down_revision = ('abc123', 'def456')  # Tuple for merge

def upgrade() -> None:
    # No operations - just marks merge point
    pass

def downgrade() -> None:
    # Cannot downgrade past merge - requires specific branch
    raise Exception("Cannot downgrade past merge point")
```

## Online Schema Changes (CONCURRENTLY)

### Index Creation Without Locks

```python
"""Add index concurrently on large table.

Revision ID: idx123
"""
from alembic import op

# CRITICAL: Disable transaction for CONCURRENTLY operations
def upgrade() -> None:
    # Exit transaction block
    op.execute("COMMIT")

    # Create index without locking reads/writes
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_date
        ON orders (customer_id, created_at DESC)
        WHERE status != 'cancelled'
    """)

def downgrade() -> None:
    op.execute("COMMIT")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_date")
```

### Column Rename (Expand-Contract Pattern)

```python
"""Phase 1: Add new column alongside old.

Revision ID: rename_phase1
"""
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    # Add new column
    op.add_column('users', sa.Column('full_name', sa.String(255), nullable=True))

    # Create trigger to sync during transition
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_user_name()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
                NEW.full_name = COALESCE(NEW.full_name, NEW.name);
                NEW.name = COALESCE(NEW.name, NEW.full_name);
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_sync_user_name
        BEFORE INSERT OR UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION sync_user_name();
    """)

def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_sync_user_name ON users")
    op.execute("DROP FUNCTION IF EXISTS sync_user_name()")
    op.drop_column('users', 'full_name')
```

## Environment-Specific Migrations

### Conditional Migration Logic

```python
"""Add analytics index (production only).

Revision ID: prod_idx
"""
from alembic import op
import os

def upgrade() -> None:
    # Only create expensive index in production
    if os.getenv('ENVIRONMENT') == 'production':
        op.execute("COMMIT")
        op.execute("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_timestamp
            ON events (timestamp DESC)
        """)
    else:
        # Simpler non-concurrent for dev/test
        op.create_index('idx_events_timestamp', 'events', ['timestamp'])

def downgrade() -> None:
    if os.getenv('ENVIRONMENT') == 'production':
        op.execute("COMMIT")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_events_timestamp")
    else:
        op.drop_index('idx_events_timestamp', table_name='events')
```

## Migration Hooks

### Pre/Post Migration Callbacks

```python
# alembic/env.py
from alembic import context

def before_migration(ctx, revision, heads):
    """Run before each migration."""
    print(f"Starting migration: {revision}")
    # Notify monitoring, acquire locks, etc.

def after_migration(ctx, revision, heads):
    """Run after each migration."""
    print(f"Completed migration: {revision}")
    # Clear caches, notify services, etc.

context.configure(
    # ... other config ...
    on_version_apply=after_migration,
)
```
